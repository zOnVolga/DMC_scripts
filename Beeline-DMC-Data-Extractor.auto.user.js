// ==UserScript==
// @name         Beeline DMC Data Extractor + AutoUpdater
// @namespace    http://tampermonkey.net/
// @version      7.1.3
// @description  Извлечение данных из Beeline DMC с автоапдейтером
// @author       zOnVolga
// @match        https://dmc.beeline.ru/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// @downloadURL  https://raw.githubusercontent.com/zOnVolga/DMC_scripts/main/Beeline_DMC_Data_Extractor.js
// @updateURL    https://raw.githubusercontent.com/zOnVolga/DMC_scripts/main/Beeline_DMC_Data_Extractor.js
// @icon         https://raw.githubusercontent.com/zOnVolga/DMC_scripts/main/icon-beeline-yellow.svg
// ==/UserScript==

(function () {
    'use strict';

    console.log("✅ Beeline DMC Data Extractor запущен");

    const SCRIPT_URL = "https://raw.githubusercontent.com/zOnVolga/DMC_scripts/main/Beeline_DMC_Data_Extractor.js";

    // Подгружаем оригинальный скрипт
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    (document.head || document.documentElement).appendChild(script);

    // === [Автоапдейтер] ===
    (function checkForUpdates() {
        const repoOwner = 'zOnVolga';
        const repoName = 'DMC_scripts';
        const filePath = 'Beeline_DMC_Data_Extractor.js';
        const rawUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${filePath}`;
        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/commits?path=${encodeURIComponent(filePath)}&page=1&per_page=1`;

        function getVersionFromString(content) {
            const versionMatch = content.match(/\/\/\s*@version\s*([0-9.\-]+)/);
            return versionMatch ? versionMatch[1].trim() : null;
        }

        function compareVersions(v1, v2) {
            const parts1 = v1.split('.').map(Number);
            const parts2 = v2.split('.').map(Number);
            for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
                if ((parts1[i] || 0) > (parts2[i] || 0)) return 1;
                if ((parts1[i] || 0) < (parts2[i] || 0)) return -1;
            }
            return 0;
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: rawUrl,
            onload: function (response) {
                if (response.status === 200 && response.responseText) {
                    const remoteVersion = getVersionFromString(response.responseText);
                    const localVersion = GM_getValue('localVersion', '0.0.0');

                    if (!remoteVersion) {
                        console.error('❌ Версия в удаленном скрипте не найдена');
                        return;
                    }

                    if (compareVersions(remoteVersion, localVersion) > 0) {
                        console.log(`🔔 Доступна новая версия: ${remoteVersion} (твоя: ${localVersion})`);

                        fetch(apiUrl)
                            .then(res => res.json())
                            .then(commits => {
                                if (commits.length > 0) {
                                    const commit = commits[0];
                                    const message = commit.commit.message;
                                    const author = commit.author?.login || commit.commit.author.name;
                                    const date = new Date(commit.commit.author.date).toLocaleString();

                                    GM_notification({
                                        title: 'Обновление доступно',
                                        text: `${script.name} v${remoteVersion}\n\n"${message}"\nАвтор: ${author}\nДата: ${date}\n→ Нажми, чтобы обновить`,
                                        timeout: 15,
                                        onclick: () => window.open(rawUrl)
                                    });

                                    GM_setValue('localVersion', remoteVersion);
                                }
                            })
                            .catch(err => {
                                console.error('Ошибка при получении информации о коммите:', err);
                            });
                    } else {
                        console.log(`✅ Текущая версия актуальна: ${localVersion}`);
                    }
                }
            },
            onerror: function (err) {
                console.error('❌ Ошибка при проверке обновления:', err);
            }
        });

        const thisScriptVersion = getVersionFromString(document.currentScript.textContent);
        if (thisScriptVersion && thisScriptVersion !== localVersion) {
            GM_setValue('localVersion', thisScriptVersion.trim());
            console.log(`💾 Локальная версия обновлена до: ${thisScriptVersion}`);
        }

        setTimeout(checkForUpdates, 6 * 60 * 60 * 1000);
    })();
})();
