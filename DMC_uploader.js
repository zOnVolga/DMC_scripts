// ==UserScript==
// @name         PDF Classifier (upload files) Stable v1.5.4
// @namespace    http://tampermonkey.net/
// @version      1.5.4
// @description  Drag-and-drop загрузка и классификация PDF с улучшенным выводом этапов
// @author       zOnVolga + GPT
// @match        https://dmc.beeline.ru/projects*
// @grant        GM_xmlhttpRequest
// @connect      cdn.jsdelivr.net
// @connect      dmc.beeline.ru
// @grant        unsafeWindow
// @grant        GM_addStyle
// @downloadURL  https://github.com/zOnVolga/DMC_scripts/raw/refs/heads/main/DMC_uploader.js
// @updateURL    https://github.com/zOnVolga/DMC_scripts/raw/refs/heads/main/DMC_uploader.js
// @icon         https://images.icon-icons.com/217/PNG/512/Package-upload_25335.png
// ==/UserScript==

(function () {
    'use strict';

    const PDFJS_VERSION = '3.10.111';
    const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;
    let pdfjsLoaded = false;

    const representativeMapping = {
        'SKorobkin': 'Отдел строительства',
        'DVSalikov': 'Отдел строительства',
        'Нуксунов Наран Игоревич': 'Отдел строительства',
        'AlASergeev': 'Отдел эксплуатации',
        'ASSuyazov': 'Отдел эксплуатации',
        'EvAKucherenko': 'Отдел эксплуатации',
        'Мухлаев Эльвик Эрдниевич': 'Отдел эксплуатации',
        'ANeryupov': 'Отдел эксплуатации',
        'Евстифеев Олег Анатольевич': 'Исполнитель (ГПО)'
    };

    const documentTypeMapping = {
        'АТП': 'Акт технической приемки объекта связи',
        'ПЗ': 'Протокол замечаний по результатам проверки документации и строительно-монтажных работ объекта связи',
        'ПЗППД': 'Протокол замечаний по результатам проверки документации и строительно-монтажных работ объекта связи',
        'ИД': 'Исполнительная документация БС'
    };

    const TOKEN_KEYS = ['token', 'authToken', 'accessToken'];

    function findToken() {
        for (const s of [localStorage, sessionStorage]) {
            for (const k of TOKEN_KEYS) {
                const t = s.getItem(k);
                if (t && t.split('.').length === 3) return t;
            }
        }
        const m = document.cookie.match(/(?:^|; )token=([^;]+)/);
        return m ? m[1] : null;
    }

    function navigateTo(path) {
        const url = new URL(path, location.origin).href;
        history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }
    if (typeof unsafeWindow !== 'undefined') unsafeWindow.navigateTo = navigateTo;

    function loadPdfJS() {
        return new Promise((res, rej) => {
            if (pdfjsLoaded) return res();
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${PDFJS_BASE}/pdf.min.js`,
                responseType: 'blob',
                onload: function(resp) {
                    if (resp.status !== 200) return rej(resp);
                    const blob = new Blob([resp.response], { type: 'application/javascript' });
                    const u = URL.createObjectURL(blob);
                    const s = document.createElement('script');
                    s.src = u;
                    s.onload = () => {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
                        pdfjsLoaded = true;
                        res();
                    };
                    s.onerror = rej;
                    document.head.appendChild(s);
                },
                onerror: rej
            });
        });
    }

    function formatDate(d) {
        return `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}`;
    }

    function extract(re, text) {
        const m = re.exec(text);
        return m ? m[1] : null;
    }

    function decodeUTF16BE(str) {
        const bytes = [0xFE, 0xFF, ...str.split('').map(c => c.charCodeAt(0))];
        return new TextDecoder('utf-16be').decode(new Uint8Array(bytes));
    }

    function searchAndExtractData(searchType, searchValue, token, callback) {
        const url = `https://dmc.beeline.ru/api/projects/projects/?page=1&page_size=10&search=${searchType}:${searchValue}`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            headers: { 'Authorization': 'Bearer ' + token },
            onload: function(resp) {
                if (resp.status === 200) {
                    const data = JSON.parse(resp.responseText);
                    if (data.count === 0) {
                        console.error('Проект не найден');
                        return;
                    }
                    const project = data.results[0];
                    callback(project);
                } else {
                    console.error(`Ошибка ${resp.status}`);
                }
            },
            onerror: () => {
                console.error('Сетевая ошибка');
            }
        });
    }

    GM_addStyle(`
        #vm-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            background: #1a73e8;
            color: #fff;
            border: none;
            border-radius: 50%;
            width: 48px;
            height: 48px;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        }
        #vm-panel {
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 99999;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
            display: none;
            flex-direction: column;
            padding: 10px;
            font-family: sans-serif;
            width: auto;
            max-width: none;
            min-width: 300px;
            max-height: 80vh;
            overflow: auto;
        }
        .vm-drop {
            padding: 20px;
            border: 2px dashed #ccc;
            border-radius: 6px;
            text-align: center;
            color: #555;
            min-height: 100px;
            transition: background .2s;
        }
        .vm-drop.dragover {
            background: #f0f8ff;
            border-color: #1a73e8;
        }
        .vm-status {
            margin: 5px 0;
            font-size: 14px;
        }
        #vm-output {
            background: #f9f9f9;
            padding: 10px;
            max-height: 300px;
            overflow-y: auto;
            font-size: 12px;
            border-top: 1px solid #ddd;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 10px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 4px;
            text-align: center;
        }
        th {
            background: #f2f2f2;
        }
        .vm-error {
            color: red;
            font-weight: bold;
        }
        .vm-choice {
            margin: 2px;
            padding: 4px 8px;
            background: #e0e0e0;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .vm-choice:hover {
            background: #d0d0d0;
        }
    `);

    const btn = document.createElement('button');
    btn.id = 'vm-toggle';
    btn.textContent = '📁';
    btn.title = 'Загрузить PDF';

    const panel = document.createElement('div');
    panel.id = 'vm-panel';

    const drop = document.createElement('div');
    drop.className = 'vm-drop';
    drop.textContent = 'Перетащите сюда PDF или кликните';

    const status = document.createElement('div');
    status.className = 'vm-status';

    const output = document.createElement('div');
    output.id = 'vm-output';

    panel.append(drop, status, output);
    document.body.append(btn, panel);

    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.pdf';
    inp.style.display = 'none';
    document.body.append(inp);

    btn.addEventListener('click', () => {
        const show = panel.style.display !== 'flex';
        panel.style.display = show ? 'flex' : 'none';
        if (show) {
            status.textContent = '';
            output.innerHTML = '';
            drop.style.display = 'block';
            inp.value = '';
        }
    });

    let dc = 0;
    drop.addEventListener('click', () => inp.click());
    drop.addEventListener('dragenter', e => {
        e.preventDefault();
        dc++;
        drop.classList.add('dragover');
    });
    drop.addEventListener('dragleave', e => {
        dc--;
        if (dc === 0) drop.classList.remove('dragover');
    });
    drop.addEventListener('dragover', e => e.preventDefault());
    drop.addEventListener('drop', e => {
        e.preventDefault();
        dc = 0;
        drop.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    inp.addEventListener('change', () => {
        if (inp.files.length) handleFile(inp.files[0]);
    });

    async function handleFile(file) {
        status.textContent = '';
        output.innerHTML = '';
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            status.textContent = 'Ошибка: файл не PDF.';
            return;
        }
        status.textContent = `Файл принят: ${file.name}`;
        await loadPdfJS();

        // Получаем ArrayBuffer из файла
        const ab = await file.arrayBuffer();

        // Создаем Blob из ArrayBuffer
        const blob = new Blob([ab], { type: 'application/pdf' });

        // Сохраняем Blob и имя файла в глобальных переменных
        window.currentFileBlob = blob;
        window.currentFileName = file.name;

        await processPDF(file, status, output);
        drop.style.display = 'none';
    }


    async function processPDF(file, statusEl, outputEl) {
        try {
            const ab = await file.arrayBuffer();
            const data = new Uint8Array(ab);
            const pdfString = new TextDecoder('latin1').decode(data);
            const sigs = [];
            const re = /\/Filter\/(Adobe\.PPKLite|CryptoPro#20PDF)\/M\(D:(\d{14})\+\d{2}'\d{2}'\)\/Name\(([^)]+)\)\/Prop_Build/g;
            let m;
            while ((m = re.exec(pdfString))) {
                let [, filter, date, name] = m;
                if (filter === 'CryptoPro#20PDF') name = decodeUTF16BE(name).slice(1);
                sigs.push({ filter, date, name });
            }

            const counts = {}, datesMap = {};
            sigs.forEach(s => {
                const rep = representativeMapping[s.name] || 'Неизвестный';
                counts[rep] = (counts[rep] || 0) + 1;
                if (!datesMap[rep]) datesMap[rep] = [];
                datesMap[rep].push(s.date);
            });

            const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
            const page = await pdf.getPage(1);
            const txt = await page.getTextContent();
            const text = txt.items.map(i => i.str).join(' ');

            const fn = file.name;
            const proj = extract(/ID\s+(\d{6})/, text) || 'не найден';

            let bsNumberFromFileName = 'не найден';
            const bsMatchFromFileName = /(\d{5})/.exec(file.name);
            if (bsMatchFromFileName && bsMatchFromFileName[1]) {
                bsNumberFromFileName = bsMatchFromFileName[1];
            }

            let bsNumberFromText = 'не найден';
            const bsMatchFromText = /БС\s+(\d{5})/.exec(text);
            if (bsMatchFromText && bsMatchFromText[1]) {
                bsNumberFromText = bsMatchFromText[1];
            }

            let bsNumberFromMRB = 'не найден';
            const mrbMatch = /(?:No)?MRB[0-9A-Z]{7}([A-Z]{3}\d{5})/.exec(text);
            if (mrbMatch && mrbMatch[1]) {
                bsNumberFromMRB = mrbMatch[1].substring(3);
            }

            let bs = bsNumberFromFileName !== 'не найден' ? bsNumberFromFileName :
                    bsNumberFromText !== 'не найден' ? bsNumberFromText :
                    bsNumberFromMRB;

            let branch = '';
            const dtKey = Object.keys(documentTypeMapping).find(k => fn.includes(k));

            const reps = ['Отдел строительства', 'Отдел эксплуатации', 'Исполнитель (ГПО)'];
            let html = `<table>` +
                `<tr><th>Файл</th><td colspan=3>${fn}</td></tr>` +
                `<tr><th>Проект</th><td>${proj}</td><th>БС</th><td>${bs}</td></tr>` +
                `<tr><th>Регион</th><td id="vm-region" colspan=3>${branch}</td></tr>` +
                `<tr><th>Тип документа</th><td colspan=3>${dtKey ? documentTypeMapping[dtKey] : 'неизвестный'}</td></tr>` +
                `<tr><th>Статус</th><td colspan=3 id="vm-status"></td></tr>` +
                `<tr><th>Представители</th>` + reps.map(r => `<th>${r}</th>`).join('') + `</tr>`;

            if (dtKey === 'ИД') {
                const hasConstructionSignature = datesMap['Отдел строительства'] && datesMap['Отдел строительства'].length > 0;
                const hasGPOSignature = datesMap['Исполнитель (ГПО)'] && datesMap['Исполнитель (ГПО)'].length > 0;

                let statusText = '❌ Не подписан';
                if (hasConstructionSignature && hasGPOSignature) {
                    statusText = '✅ Подписан';
                }

                // Определяем заголовок для подписей
                let signatureHeader = 'Подписи';
                if (fn.includes('АФУ')) {
                    signatureHeader = 'Подписи АФУ';
                } else if (fn.includes('РРС')) {
                    signatureHeader = 'Подписи РРС';
                }

                html = html.replace(/id="vm-status"><\/td>/, `id="vm-status">${statusText}</td>`);

                html += `<tr><td>${signatureHeader}</td>` +
                    `<td>${hasConstructionSignature ? '✅ ' + formatDate(datesMap['Отдел строительства'][0]) : '❌'}</td>` +
                    `<td>⊟ Не требуется</td>` +
                    `<td>${hasGPOSignature ? '✅ ' + formatDate(datesMap['Исполнитель (ГПО)'][0]) : '❌'}</td></tr>`;
            } else {
                html += `<tr><td>Технический запуск</td>` + reps.map(r => {
                    const has = datesMap[r] && datesMap[r][0];
                    const d = has ? formatDate(datesMap[r][0]) : '';
                    return `<td>${has ? '✅ ' + d : '❌'}</td>`;
                }).join('') + `</tr>`;

                html += `<tr><td>Замечания устранены</td>` + reps.map(r => {
                    const has2 = datesMap[r] && datesMap[r][1];
                    const d2 = has2 ? formatDate(datesMap[r][1]) : '';
                    return `<td>${has2 ? '✅ ' + d2 : '❌'}</td>`;
                }).join('') + `</tr>`;
            }

            html += `</table>`;
            outputEl.innerHTML = html;

            let systemDocTitle = '';
            if (fn.includes('АТП')) {
                systemDocTitle = (stageText === 'Замечания устранены')
                    ? 'Акт технической приёмки объекта связи (по результатам устранения замечаний)'
                    : 'Акт технической приемки объекта связи (Технический запуск)';
            } else if (fn.includes('ПЗ') || fn.includes('ПЗППД')) {
                systemDocTitle = (stageText === 'Замечания устранены')
                    ? 'Протокол замечаний по результатам проверки документации и строительно-монтажных работ объекта связи с отметками об устранении'
                    : 'Протокол замечаний по результатам проверки документации и строительно-монтажных работ объекта связи (Технический запуск)';
            } else if (fn.includes('ИД') && fn.includes('МОД')) {
                systemDocTitle = 'Исполнительная документация БС';
            }

            console.log('[PDF Classifier] Название документа:', systemDocTitle);

            const token = findToken();
            if (proj !== 'не найден') {
                autoNavigateByProject(proj, token, statusEl, outputEl, systemDocTitle);
            } else if (bs !== 'не найден') {
                autoNavigateByBs(bs, token, statusEl, outputEl, systemDocTitle);
            }

        } catch (e) {
            console.error('Ошибка:', e);
            statusEl.textContent = 'Ошибка чтения PDF.';
        }
    }

    function autoNavigateByProject(projectNumber, token, statusEl, outputEl, systemDocTitle) {
        searchAndExtractData('proj', projectNumber, token, (project) => {
            const regionCell = document.getElementById('vm-region');
            if (regionCell && project.branch) regionCell.textContent = project.branch;
            statusEl.innerHTML = `<strong>${project.project_ext_id} | ${project.types_project} | ${project.open_date}</strong>`;
            setTimeout(() => {
                navigateTo(`/projects/${project.id}/document-creation`);
                selectDocumentType(systemDocTitle);
            }, 500);
        });
    }

    function autoNavigateByBs(bsNumber, token, statusEl, outputEl, systemDocTitle) {
        const url = `https://dmc.beeline.ru/api/projects/projects/?page=1&page_size=10&search=bs:${bsNumber}`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            headers: { 'Authorization': 'Bearer ' + token },
            onload: function(resp) {
                if (resp.status === 200) {
                    const data = JSON.parse(resp.responseText);
                    if (data.count === 0) {
                        statusEl.textContent = 'Проекты не найдены';
                        return;
                    }

                    let projects = data.results;
                    if (systemDocTitle === 'Исполнительная документация БС') {
                        projects = projects.filter(project => project.types_project === 'Модернизация БС');
                    }

                    if (projects.length === 1) {
                        const project = projects[0];
                        const regionCell = document.getElementById('vm-region');
                        if (regionCell && project.branch) regionCell.textContent = project.branch;
                        statusEl.innerHTML = `<strong>${project.project_ext_id} | ${project.types_project} | ${project.open_date}</strong>`;
                        setTimeout(() => {
                            navigateTo(`/projects/${project.id}/document-creation`);
                            selectDocumentType(systemDocTitle);
                        }, 500);
                    } else {
                        statusEl.textContent = 'Выберите проект:';
                        const container = document.createElement('div');
                        projects.forEach(project => {
                            const button = document.createElement('button');
                            button.textContent = `${project.project_ext_id} | ${project.types_project} | ${project.open_date}`;
                            button.className = 'vm-choice';
                            button.onclick = () => {
                                const regionCell = document.getElementById('vm-region');
                                if (regionCell && project.branch) regionCell.textContent = project.branch;
                                statusEl.innerHTML = `<strong>${project.project_ext_id} | ${project.types_project} | ${project.open_date}</strong>`;
                                container.remove();
                                setTimeout(() => {
                                    navigateTo(`/projects/${project.id}/document-creation`);
                                    selectDocumentType(systemDocTitle);
                                }, 500);
                            };
                            container.appendChild(button);
                        });
                        outputEl.appendChild(container);
                    }
                } else {
                    statusEl.textContent = `Ошибка ${resp.status}`;
                }
            },
            onerror: () => {
                statusEl.textContent = 'Сетевая ошибка';
            }
        });
    }


    function selectDocumentType(systemDocTitle) {
        const observer = new MutationObserver((mutations, obs) => {
            const inputElement = document.querySelector('input[data-testid="Autocomplete-search-input"]');
            if (inputElement) {
                inputElement.focus();
                inputElement.value = systemDocTitle;

                const inputEvent = new Event('input', { bubbles: true });
                inputElement.dispatchEvent(inputEvent);

                setTimeout(() => {
                    const dropdownOptions = document.querySelectorAll('.dsb__autocomplete__options__item');
                    dropdownOptions.forEach(option => {
                        const optionText = option.querySelector('p.dsb_typography.dsb_typography__body1').textContent;
                        if (optionText === systemDocTitle) {
                            option.click();
                            obs.disconnect();

                            setTimeout(() => {
                                const fileInput = document.querySelector('.FileUploaderText_file_input__WbIDl');
                                if (fileInput) {
                                    const dataTransfer = new DataTransfer();
                                    const file = new File([window.currentFileBlob], window.currentFileName, { type: 'application/pdf' });
                                    dataTransfer.items.add(file);
                                    fileInput.files = dataTransfer.files;

                                    // Создаем и отправляем событие изменения
                                    const event = new Event('change', { bubbles: true });
                                    fileInput.dispatchEvent(event);
                                }
                            }, 1000);
                        }
                    });
                }, 1000);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
