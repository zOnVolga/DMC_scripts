// ==UserScript==
// @name         Beeline DMC Extractor (v.7.3.3 | 2025-05-26)
// @namespace    http://tampermonkey.net/
// @version      7.3.3
// @description  Извлечение данных из Beeline DMC с возможностью автообновления и уведомлением о последнем коммите
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

    // Глобальные переменные
    let axios = null;
    let axiosLoadedPromise = null;

    // Переменные для работы модального окна
    let branchSelect; // Теперь объявлена глобально
    let confirmButton;
    let selectedFilters = []; // Также глобально

    // Функция безопасной загрузки Axios
    function loadAxios() {
        if (axiosLoadedPromise) return axiosLoadedPromise;
        axiosLoadedPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/axios@1.8.4/dist/axios.min.js';
            script.onload = () => {
                if (window.axios || unsafeWindow.axios) {
                    axios = window.axios || unsafeWindow.axios;
                    console.log('✅ Axios загружен через DOM');
                    resolve();
                } else {
                    console.warn('⚠️ Axios не найден в window, пробуем через GM_xmlhttpRequest...');
                    fallbackLoadAxios(resolve, reject);
                }
            };
            script.onerror = () => {
                console.error('❌ Ошибка загрузки Axios через DOM');
                fallbackLoadAxios(resolve, reject);
            };
            document.head.appendChild(script);
        });
        return axiosLoadedPromise;
    }

    // Резервная загрузка Axios через GM_xmlhttpRequest
    function fallbackLoadAxios(resolve, reject) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://unpkg.com/axios@1.6.7/dist/axios.min.js',
            onload: function (response) {
                try {
                    eval(response.responseText); // Внедряем Axios как глобальную переменную
                    axios = window.axios || unsafeWindow.axios;
                    console.log('✅ Axios загружен через GM_xmlhttpRequest');
                    resolve();
                } catch (e) {
                    console.error('❌ Ошибка при обработке Axios:', e);
                    reject(e);
                }
            },
            onerror: function (error) {
                console.error('❌ Ошибка загрузки Axios через GM_xmlhttpRequest:', error);
                reject(error);
            }
        });
    }

    // Фильтры по филиалам
    // ПФ (Юг): Астраханский,Волгоградский,Элистинский,Краснодарский,Ростовский-на-Дону,Сочинский
    const filter_south = "1b349473-eea7-48a0-8fd2-cfe108543bee,af71b045-5f0f-42f2-9033-1a82cdfbefb4,74ac0640-83a6-4973-a3fb-1e1b300a897c,a46571ce-4df0-4790-a09d-c733ca5dd6bc,f096da02-f05b-448f-87c6-e7d92fb65178,cb6d9423-526d-437b-8bb6-49967f4cc991";
    // ПФ (Волга): Уфимский,Чебоксарский,Саранский,Нижегородский,Пензенский,Самарский,Саратовский,Казанский,Ульяновский,Йошкар-Олинский,Сыктывкарский,Кировский,Оренбургский,Ижевский,Тольяттинский
    const filter_volga = "8ff0b9ea-ed23-4c88-b538-7decc3d0e3cf,6239e02e-d651-4ffc-9c9d-86c3ff420369,9f31d920-f48f-4794-ac4f-45ff2e1455f7,5cba0ddb-b4b5-4246-b946-822055a6788c,a534be57-c985-4493-a171-e5f9f78651be,3d429611-6fca-403d-8624-9ebb5d21ac51,4c12c603-af46-4c33-8d90-4fdb27d33df8,61274562-9acf-4563-9022-ddd026b9c7ed,663a7a85-517d-4644-a6cd-55d08d188aa5,5302af3a-93a5-4e8a-be56-51b89aa908c8,61f808ab-801d-42a7-a29d-65e891dc9094,72fc8dc9-9f76-41e4-b7e2-b6aa98aac005,e7f11972-8629-4b37-bc88-ded646c7142e,7af92d65-6933-4039-bab0-6631c8102584,cde313d6-b8e6-49ba-b47a-411a696d8b92";
    // ПФ (СЗ): Воронежский,Курский,Липецкий,Тамбовский
    const filter_sz = "5abafa24-b2a5-4ed6-bbb9-702778773663,34e24448-708b-4606-8dc7-49c58e887308,bd1cce4a-3eb0-4004-bc2a-7dc3d2569951,b86a2dc6-c290-4d4a-a99f-defb4afe48f5";
    // ПФ (СК): Махачкалинский,Назрановский,Нальчикский,Черкесский,Владикавказский,Ставропольский,Грозненский
    const filter_sk = "a6330853-dd85-421b-a13d-5f954bf8f0ff,41ef1d31-0cc7-47c1-9885-22983f4b13f2,9916d45b-2c4c-4a28-8b31-e142e182715d,9e109fa5-4427-440c-a703-e331f43c9b90,9df71af9-2ecb-4dd8-aef8-7744a372fc63,5c9c8af3-c27f-41ea-baf5-7d916af0935c,f2dc5d51-0ca9-4e51-b188-138d817ce8e4";
    // ДВФ: Амурский,Камчатский,Хабаровский,Южно-Сахалинский,Читинский,Приморский,Магаданский,Бурятский,Якутский,Чукотский
    const filter_dvf = "22aaa0d7-d39d-498d-8d94-12b3a631c5f6,244ae786-bf7e-4d88-9667-fc42eccd49c6,ddb5d219-c34f-4db8-acf0-0c6d4b2c5a8e,ec6def4d-2c06-47aa-b79c-f05d324f61be,ee5d2b0e-66d5-4d6c-9642-574575c0230f,99bb02b0-e333-4ab9-9a1a-efe1cbabc1ca,4bf06635-0c97-42fa-b18f-8aae186f59bf,6607e1ab-640c-46b6-9a78-dc28bea3d8d7,108fc08e-2b36-43c9-ad69-5ea886233e41,a890f02a-8542-4f95-bc87-5ef671ed5ec0";
    // СФ: Барнаульский,Кемеровский,Красноярский,Новосибирский,Омский,Томский,Абаканский,Иркутский
    const filter_sf = "6454b42b-b856-4cc5-aa21-cecd357fd41b,e97e5621-ec86-4ad8-ab63-8f9ef558e2af,ae0f7de5-fdb7-49c1-8696-216943275649,c7bb04c5-ad71-4ade-9fc9-dd8fe77b7992,9962c13d-cb2e-4ca1-a306-1adf07d17fa4,50d241d4-749b-46a7-9b9a-ca6cc98a06b6,12ec9341-2316-4fbc-9e02-f8aa1a2f9dac,323a9787-32fd-45c2-a467-d97f8874af1b";
    // УФ: Курганский,Пермский,Екатеринбургский,Тюменский,Челябинский,Сургутский
    const filter_uf = "6cb300b7-2cad-40c5-81d0-375eabfefad8,ea690087-5d28-4f9a-9ed2-a77370eaa92a,271a4a4f-bf46-4c9a-ac6d-a7397a101bca,7726a822-aa5c-477e-8420-b93cfb67f8ce,af9013c0-0d0d-4759-8e1d-9d40211bcabe,04488b8c-5d90-408a-8f87-a820055e20db";
    // ЦФ: Владимирский,Ивановский,Калужский,Костромской,Рязанский,Смоленский,Тверской,Тульский,Ярославский,Архангельский,Вологодский,Калининградский,Петрозаводский,Мурманский,Новгородский,Псковский,Санкт-Петербургский,Московский,Брянский,Белгородский,Орловский
    const filter_cf = "1303c814-1bc4-4a6a-8e5d-322ec02b2117,7bb8eba0-75cf-4486-a2dd-1e68cf33e36c,9d3b14d5-6f00-4634-ad74-9a1d322aee44,8f59abf2-1f2e-4dc5-94bf-7f115d2c5e19,4c7e3066-9cbf-4e44-b17a-6f1f8a68b3dc,e9319736-9f61-4aa8-9a15-9820bceb734c,cf7aa0c6-5778-416e-a316-01087727b781,e22593af-4efe-49bd-a7e3-ad88a285bc48,82ae4e80-e0c0-4edd-a315-1f5b188b6087,7c2aa57f-2205-461a-9e41-eea2ef5b77f5,fcfeebb4-48e7-4c18-815f-b8e861a812a5,815ba103-8861-48a7-bc26-a6b5be533543,d780bab4-2539-440d-b865-2d37e398c771,15ab0108-e6e7-461c-9ed4-53563d8fde3c,dbcea987-f90f-4d3b-aab4-5b9e2f70bb44,135c8dec-360d-42f0-87ad-b0487a937889,1a84442b-f104-41fd-9dff-70e3488fbf3b,7244fcb6-45ab-409d-abb3-01cf03a4c680,8d6b1b0f-f6f9-4d3d-97ae-d8b3c42b3269,a9ff0ff4-988b-4ee0-9b2a-d0f11cf9ae9c,bfd1f7ec-c876-4bb9-9c23-d8379e30e3ca";

    // Координаты филиалов
    const branchCoordinates = {
        "Барнаульский": { delivery: "55.007251, 82.535672", survey: "53.3565,83.7636" },
        "Кемеровский": { delivery: "55.007251, 82.535672", survey: "55.3546,86.0473" },
        "Красноярский": { delivery: "55.007251, 82.535672", survey: "56.0147,92.8934" },
        "Новосибирский": { delivery: "55.007251, 82.535672", survey: "55.0083,82.9357" },
        "Омский": { delivery: "55.007251, 82.535672", survey: "54.9678,73.3821" },
        "Томский": { delivery: "55.007251, 82.535672", survey: "56.4846,84.9476" },
        "Абаканский": { delivery: "55.007251, 82.535672", survey: "53.7150,91.4290" },
        "Амурский": { delivery: "48.404489, 135.159911", survey: "50.2267,136.8994" },
        "Камчатский": { delivery: "53.093684, 158.633801", survey: "53.0195,158.6468" },
        "Хабаровский": { delivery: "48.404489, 135.159911", survey: "48.4802,135.0719" },
        "Южно-Сахалинский": { delivery: "46.992572, 142.731195", survey: "46.9597,142.7313" },
        "Иркутский": { delivery: "", survey: "52.2896,104.2806" },
        "Читинский": { delivery: "", survey: "52.0333,113.5000" },
        "Приморский": { delivery: "43.117214, 131.949957", survey: "43.1155,131.8855" },
        "Магаданский": { delivery: "59.596941, 150.837473", survey: "59.5612,150.8301" },
        "Бурятский": { delivery: "52.353463, 104.168533", survey: "51.8333,107.6000" },
        "Якутский": { delivery: "62.106471, 129.770024", survey: "62.0273,129.7319" },
        "Чукотский": { delivery: "48.404489, 135.159911", survey: "64.7333,177.5000" },
        "Владимирский": { delivery: "", survey: "56.1290,40.4063" },
        "Ивановский": { delivery: "", survey: "56.9972,40.9714" },
        "Калужский": { delivery: "", survey: "54.5293,36.2754" },
        "Костромской": { delivery: "", survey: "57.7665,40.9269" },
        "Рязанский": { delivery: "", survey: "54.6269,39.6916" },
        "Смоленский": { delivery: "", survey: "54.7826,32.0453" },
        "Тверской": { delivery: "", survey: "56.8586,35.9176" },
        "Тульский": { delivery: "", survey: "54.1931,37.6173" },
        "Ярославский": { delivery: "", survey: "57.6261,39.8845" },
        "Архангельский": { delivery: "", survey: "64.5393,40.5188" },
        "Вологодский": { delivery: "", survey: "59.2183,39.8886" },
        "Калининградский": { delivery: "", survey: "54.7104,20.4522" },
        "Петрозаводский": { delivery: "", survey: "61.7849,34.3469" },
        "Мурманский": { delivery: "", survey: "68.9696,33.0745" },
        "Новгородский": { delivery: "", survey: "58.5213,31.2710" },
        "Псковский": { delivery: "", survey: "57.8193,28.3344" },
        "Санкт-Петербургский": { delivery: "", survey: "59.9343,30.3351" },
        "Московский": { delivery: "", survey: "55.7558,37.6173" },
        "Уфимский": { delivery: "55.920003,49.115999", survey: "54.735152,55.958736" },
        "Чебоксарский": { delivery: "55.920003,49.115999", survey: "56.139918,47.247728" },
        "Саранский": { delivery: "55.920003,49.115999", survey: "54.187433,45.183938" },
        "Нижегородский": { delivery: "55.920003,49.115999", survey: "56.326797,44.006516" },
        "Пензенский": { delivery: "55.920003,49.115999", survey: "53.195042,45.018316" },
        "Самарский": { delivery: "55.920003,49.115999", survey: "53.195878,50.100202" },
        "Саратовский": { delivery: "55.920003,49.115999", survey: "51.533338,46.034176" },
        "Казанский": { delivery: "55.920003,49.115999", survey: "55.796127,49.106414" },
        "Ульяновский": { delivery: "55.920003,49.115999", survey: "54.314192,48.403132" },
        "Йошкар-Олинский": { delivery: "55.920003,49.115999", survey: "56.6316,47.886178" },
        "Сыктывкарский": { delivery: "55.920003,49.115999", survey: "61.668797,50.836497" },
        "Кировский": { delivery: "55.920003,49.115999", survey: "59.875330,30.981457" },
        "Курганский": { delivery: "56.749333,60.757527", survey: "55.4408,65.3411" },
        "Пермский": { delivery: "", survey: "58.0105,56.2294" },
        "Екатеринбургский": { delivery: "56.749333,60.757527", survey: "56.8389,60.6057" },
        "Тюменский": { delivery: "56.749333,60.757527", survey: "57.1530,65.3411" },
        "Ижевский": { delivery: "55.920003,49.115999", survey: "56.845096,53.188089" },
        "Челябинский": { delivery: "56.749333,60.757527", survey: "55.1599,61.4026" },
        "Тольяттинский": { delivery: "55.920003,49.115999", survey: "53.507852,49.420411" },
        "Сургутский": { delivery: "56.749333,60.757527", survey: "61.2540,73.3962" },
        "Брянский": { delivery: "", survey: "53.2436,34.3634" },
        "Белгородский": { delivery: "51.811241,39.202998", survey: "50.595414,36.587277" },
        "Воронежский": { delivery: "51.811241,39.202998", survey: "51.660781,39.200296" },
        "Курский": { delivery: "51.811241,39.202998", survey: "51.7304,36.1926" },
        "Липецкий": { delivery: "51.811241,39.202998", survey: "52.6088,39.5992" },
        "Орловский": { delivery: "", survey: "52.9703,36.0635" },
        "Тамбовский": { delivery: "51.811241,39.202998", survey: "52.7212,41.4523" },
        "Астраханский": { delivery: "45.060946,41.999728", survey: "46.3477,48.0304" },
        "Волгоградский": { delivery: "47.338143,39.730760", survey: "48.7080,44.5133" },
        "Махачкалинский": { delivery: "45.060946,41.999728", survey: "43.2167,47.5047" },
        "Назрановский": { delivery: "45.060946,41.999728", survey: "43.2167,44.7667" },
        "Нальчикский": { delivery: "45.060946,41.999728", survey: "43.4853,43.6071" },
        "Элистинский": { delivery: "47.338143,39.730760", survey: "46.3078,44.2558" },
        "Черкесский": { delivery: "45.060946,41.999728", survey: "44.2233,42.0578" },
        "Краснодарский": { delivery: "47.338143,39.730760", survey: "45.0355,38.9753" },
        "Ростовский-на-Дону": { delivery: "47.338143,39.730760", survey: "47.2221,39.7203" },
        "Владикавказский": { delivery: "45.060946,41.999728", survey: "43.0246,44.6818" },
        "Ставропольский": { delivery: "45.060946,41.999728", survey: "45.0433,41.9691" },
        "Грозненский": { delivery: "45.060946,41.999728", survey: "43.3180,45.6982" },
        "Сочинский": { delivery: "47.338143,39.730760", survey: "43.5855,39.7231" }
    };

    // Проверка токена
    function isToken(value) {
        return typeof value === 'string' && value.split('.').length === 3;
    }

    // Поиск токена
    function findToken() {
        for (const key in localStorage) {
            const value = localStorage.getItem(key);
            if (isToken(value)) return value;
        }
        for (const key in sessionStorage) {
            const value = sessionStorage.getItem(key);
            if (isToken(value)) return value;
        }
        return getCookie('token');
    }

    // Получение cookie
    function getCookie(name) {
        const matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    // Создание кнопки
    function createButton() {
        const button = document.createElement('button');
        button.textContent = '📋 Копировать данные в буфер обмена';
        button.style.position = 'fixed';
        button.style.top = '10px';
        button.style.left = '50%';
        button.style.transform = 'translateX(-50%)';
        button.style.zIndex = '1000';
        button.style.padding = '10px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.fontSize = '20px';
        button.addEventListener('click', showModal);
        document.body.appendChild(button);
    }

    // Безопасный showModal
    async function showModal() {
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.backgroundColor = '#fff';
        modal.style.padding = '20px';
        modal.style.borderRadius = '10px';
        modal.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        modal.style.zIndex = '10000';
        modal.style.width = '300px';
        modal.style.textAlign = 'center';

        const title = document.createElement('h3');
        title.textContent = 'Выберите фильтры';
        modal.appendChild(title);

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        modal.appendChild(container);

        // Функция создания переключателя
        const createSwitch = (id, value, label, isChecked = false) => {
            const switchContainer = document.createElement('label');
            switchContainer.style.display = 'flex';
            switchContainer.style.alignItems = 'center';
            switchContainer.style.gap = '10px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = id;
            checkbox.value = value;
            checkbox.checked = isChecked;
            checkbox.style.display = 'none';

            const slider = document.createElement('span');
            slider.style.position = 'relative';
            slider.style.width = '40px';
            slider.style.height = '20px';
            slider.style.backgroundColor = isChecked ? '#4CAF50' : '#ccc';
            slider.style.borderRadius = '20px';
            slider.style.cursor = 'pointer';
            slider.style.transition = 'background-color 0.3s';

            const circle = document.createElement('span');
            circle.style.position = 'absolute';
            circle.style.width = '16px';
            circle.style.height = '16px';
            circle.style.backgroundColor = '#fff';
            circle.style.borderRadius = '50%';
            circle.style.top = '2px';
            circle.style.left = isChecked ? '22px' : '2px';
            circle.style.transition = 'left 0.3s';

            slider.appendChild(circle);
            checkbox.addEventListener('change', () => {
                slider.style.backgroundColor = checkbox.checked ? '#4CAF50' : '#ccc';
                circle.style.left = checkbox.checked ? '22px' : '2px';
            });

            const labelElement = document.createElement('span');
            labelElement.textContent = label;
            labelElement.style.fontSize = '14px';
            labelElement.style.color = '#333';

            switchContainer.appendChild(checkbox);
            switchContainer.appendChild(slider);
            switchContainer.appendChild(labelElement);

            // Добавляем ссылки для удобства
            switchContainer.checkbox = checkbox;
            switchContainer.switchContainer = switchContainer;

            return switchContainer;
        };

        // Переключатель "Выбрать филиал"
        const selectBranchSwitch = createSwitch('selectBranch', 'true', 'Выбрать филиал');
        container.appendChild(selectBranchSwitch);

        // Переключатели регионов
        const southSwitch = createSwitch('south', filter_south, 'ПФ (Юг)');
        const volgaSwitch = createSwitch('volga', filter_volga, 'ПФ (Волга)');
        const szSwitch = createSwitch('sz', filter_sz, 'ПФ (СЗ)');
        const skSwitch = createSwitch('sk', filter_sk, 'ПФ (СК)');
        const dvfSwitch = createSwitch('dvf', filter_dvf, 'ДВФ');
        const sfSwitch = createSwitch('sf', filter_sf, 'СФ');
        const ufSwitch = createSwitch('uf', filter_uf, 'УФ');
        const cfSwitch = createSwitch('cf', filter_cf, 'ЦФ');

        container.appendChild(volgaSwitch);
        container.appendChild(southSwitch);
        container.appendChild(szSwitch);
        container.appendChild(skSwitch);
        container.appendChild(dvfSwitch);
        container.appendChild(sfSwitch);
        container.appendChild(ufSwitch);
        container.appendChild(cfSwitch);

        // Контейнер выпадающего списка филиалов
        const branchSelectContainer = document.createElement('div');
        branchSelectContainer.style.display = 'none';
        const branchSelectLabel = document.createElement('span');
        branchSelectLabel.textContent = 'Выберите филиалы:';
        branchSelectLabel.style.fontSize = '14px';
        branchSelectLabel.style.color = '#333';
        branchSelectLabel.style.marginBottom = '5px';
        branchSelectContainer.appendChild(branchSelectLabel);

        branchSelect = document.createElement('select'); // без const/let
        branchSelect.multiple = true;
        branchSelect.size = 8;
        branchSelect.style.width = '100%';
        branchSelect.style.padding = '5px';
        branchSelect.style.border = '1px solid #ccc';
        branchSelect.style.borderRadius = '5px';
        branchSelectContainer.appendChild(branchSelect);

        container.appendChild(branchSelectContainer);

        // Логика отображения/скрытия филиалов
        selectBranchSwitch.querySelector('input').addEventListener('change', () => {
            const isChecked = selectBranchSwitch.querySelector('input').checked;
            if (isChecked) {
                southSwitch.style.display = 'none';
                volgaSwitch.style.display = 'none';
                szSwitch.style.display = 'none';
                skSwitch.style.display = 'none';
                dvfSwitch.style.display = 'none';
                sfSwitch.style.display = 'none';
                ufSwitch.style.display = 'none';
                cfSwitch.style.display = 'none';
                branchSelectContainer.style.display = 'block';
                loadBranches();
            } else {
                southSwitch.style.display = 'flex';
                volgaSwitch.style.display = 'flex';
                szSwitch.style.display = 'flex';
                skSwitch.style.display = 'flex';
                dvfSwitch.style.display = 'flex';
                sfSwitch.style.display = 'flex';
                ufSwitch.style.display = 'flex';
                cfSwitch.style.display = 'flex';
                branchSelectContainer.style.display = 'none';
            }
        });

        // --- Кнопка "Только незавершенные" (только на странице задач) ---
        let uncompletedTasksSwitch = null;
        if (window.location.href.includes('/processes')) {
            uncompletedTasksSwitch = createSwitch('uncompleted', 'true', 'Только незавершенные');
            container.appendChild(uncompletedTasksSwitch);
        }

        // --- Кнопка "Подтвердить" ---
        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Подтвердить';
        confirmButton.style.padding = '10px 20px';
        confirmButton.style.backgroundColor = '#4CAF50';
        confirmButton.style.color = 'white';
        confirmButton.style.border = 'none';
        confirmButton.style.borderRadius = '5px';
        confirmButton.style.cursor = 'pointer';
        confirmButton.style.fontSize = '16px';
        confirmButton.style.marginTop = '20px';
        confirmButton.disabled = true; // По умолчанию отключена

        // --- Кнопка "Отмена" ---
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Отмена';
        cancelButton.style.padding = '10px 20px';
        cancelButton.style.backgroundColor = '#f44336';
        cancelButton.style.color = 'white';
        cancelButton.style.border = 'none';
        cancelButton.style.borderRadius = '5px';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.fontSize = '16px';
        cancelButton.style.marginTop = '20px';
        cancelButton.style.marginLeft = '10px';

        // --- Контейнер для кнопок ---
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(cancelButton);
        modal.appendChild(buttonContainer);

        // Добавляем модальное окно на страницу
        document.body.appendChild(modal);

        // --- Обработчики событий для обновления состояния кнопки "Подтвердить" ---
        function updateConfirmButtonState() {
            const hasSelection =
                selectBranchSwitch.querySelector('input').checked ||
                southSwitch.querySelector('input').checked ||
                volgaSwitch.querySelector('input').checked ||
                szSwitch.querySelector('input').checked ||
                skSwitch.querySelector('input').checked ||
                dvfSwitch.querySelector('input').checked ||
                sfSwitch.querySelector('input').checked ||
                ufSwitch.querySelector('input').checked ||
                cfSwitch.querySelector('input').checked;

            confirmButton.disabled = !hasSelection;
        }

        [southSwitch, volgaSwitch, szSwitch, skSwitch, dvfSwitch, sfSwitch, ufSwitch, cfSwitch, selectBranchSwitch].forEach(switchEl => {
            switchEl.querySelector('input').addEventListener('change', updateConfirmButtonState);
        });

        // --- Обработчик кнопки "Подтвердить" ---
        confirmButton.addEventListener('click', () => {
            selectedFilters = [];

            if (selectBranchSwitch.querySelector('input').checked) {
                const selectedBranches = Array.from(branchSelect.selectedOptions).map(option => option.value);
                if (selectedBranches.length > 0) {
                    selectedFilters.push(selectedBranches.join(','));
                } else {
                    alert('Выберите хотя бы один филиал');
                    return;
                }
            } else {
                if (southSwitch.querySelector('input').checked) selectedFilters.push(southSwitch.querySelector('input').value);
                if (volgaSwitch.querySelector('input').checked) selectedFilters.push(volgaSwitch.querySelector('input').value);
                if (szSwitch.querySelector('input').checked) selectedFilters.push(szSwitch.querySelector('input').value);
                if (skSwitch.querySelector('input').checked) selectedFilters.push(skSwitch.querySelector('input').value);
                if (dvfSwitch.querySelector('input').checked) selectedFilters.push(dvfSwitch.querySelector('input').value);
                if (sfSwitch.querySelector('input').checked) selectedFilters.push(sfSwitch.querySelector('input').value);
                if (ufSwitch.querySelector('input').checked) selectedFilters.push(ufSwitch.querySelector('input').value);
                if (cfSwitch.querySelector('input').checked) selectedFilters.push(cfSwitch.querySelector('input').value);
            }

            const uncompletedTasks = uncompletedTasksSwitch?.querySelector('input').checked || false;
            console.log(`🔍 Выбран фильтр "Только незавершенные": ${uncompletedTasks}`);
            document.body.removeChild(modal);
            extractData(uncompletedTasks);
        });

        // --- Обработчик кнопки "Отмена" ---
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    // Функция для извлечения данных в зависимости от URL
    function extractData(uncompletedTasks) {
        if (window.location.href.includes('/projects')) {
            extractProjectData();
        } else if (window.location.href.includes('/processes')) {
            extractTaskData(uncompletedTasks);
        } else {
            alert('❌ Неизвестная страница. Скрипт работает только на /projects или /processes.');
        }
    }

    // Функция для получения количества проектов
    async function extractProjectData() {
        if (!axios) {
            console.error('❌ Axios не загружен');
            alert('Axios не загружен');
            return;
        }

        const filter_branch = selectedFilters.join(',').replace(/,$/, '');
        const url = `https://dmc.beeline.ru/api/projects/projects/?page=1&page_size=1&branch=${filter_branch}`;
        const token = findToken();

        if (!token) {
            console.error('❌ Токен не найден');
            alert('Токен не найден');
            return;
        }

        try {
            const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const totalItems = response.data.count;
            console.log(`🔍 Найдено ${totalItems} проектов`);
            fetchProjects(totalItems);
        } catch (error) {
            console.error('❌ Ошибка при получении количества проектов:', error);
            alert('Не удалось получить количество проектов');
        }
    }

    // Функция для получения количества задач
    async function extractTaskData(uncompletedTasks) {
        if (!axios) {
            console.error('❌ Axios не загружен');
            alert('Axios не загружен');
            return;
        }

        const filter_branch = selectedFilters.join(',').replace(/,$/, '');
        const url = `https://dmc.beeline.ru/api/processes/tasks/?gpo=&page=1&page_size=1&branch=${filter_branch}&uncompleted_tasks=${uncompletedTasks}`;
        const token = findToken();

        if (!token) {
            console.error('❌ Токен не найден');
            alert('Токен не найден');
            return;
        }

        try {
            const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const totalItems = response.data.count;
            console.log(`🔍 Найдено ${totalItems} задач (${uncompletedTasks ? 'только незавершенные' : 'все'})`);
            fetchTasks(totalItems, uncompletedTasks);
        } catch (error) {
            console.error('❌ Ошибка при получении количества задач:', error);
            alert('Не удалось получить количество задач');
        }
    }

    // Функция для получения всех проектов
    async function fetchProjects(totalItems) {
        const token = findToken();
        if (!token) return console.error('❌ Токен не найден');

        const filter_branch = selectedFilters.join(',').replace(/,$/, '');
        const url = `https://dmc.beeline.ru/api/projects/projects/?page=1&page_size=${totalItems}&branch=${filter_branch}`;

        console.log(`🚀 Запрашиваем проекты: ${url}`);

        try {
            const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = response.data.results;

            if (data && data.length > 0) {
                console.log(`✅ Данные о проектах получены (${data.length} записей)`);
                const tableHTML = createTableFromData(data, 'project');
                const processedTableHTML = processTable(tableHTML, 'project');
                copyToClipboard(processedTableHTML);
                alert('📋 Данные скопированы в буфер обмена. Вставьте их в Excel.');
            } else {
                alert('⚠️ Нет данных для отображения.');
            }
        } catch (error) {
            console.error('❌ Ошибка при получении данных о проектах:', error);
            alert('Не удалось получить данные о проектах');
        }
    }

    // Функция для получения всех задач
    async function fetchTasks(totalItems, uncompletedTasks) {
        const token = findToken();
        if (!token) return console.error('❌ Токен не найден');

        const filter_branch = selectedFilters.join(',').replace(/,$/, '');
        const url = `https://dmc.beeline.ru/api/processes/tasks/?gpo=&page=1&page_size=${totalItems}&branch=${filter_branch}&uncompleted_tasks=${uncompletedTasks}`;

        console.log(`🚀 Запрашиваем задачи: ${url}`);

        try {
            const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = response.data.results;

            if (data && data.length > 0) {
                console.log(`✅ Данные о задачах получены (${data.length} записей)`);
                const tableHTML = createTableFromData(data, 'task');
                const processedTableHTML = processTable(tableHTML, 'task');
                copyToClipboard(processedTableHTML);
                alert('📋 Данные скопированы в буфер обмена. Вставьте их в Excel.');
            } else {
                alert('⚠️ Нет данных для отображения.');
            }
        } catch (error) {
            console.error('❌ Ошибка при получении данных о задачах:', error);
            alert('Не удалось получить данные о задачах');
        }
    }

    // Функция для создания таблицы из данных
function createTableFromData(data, type) {
    const table = document.createElement('table');
    table.setAttribute('cellspacing', '0');
    table.setAttribute('class', 'style__TableStyled-sc-1c82g3t-0 cobzxA');

    let headers = [];

    if (type === 'project') {
        headers = [
            'region',
            'branch',
            'project_ext_id',
            'id',
            'bs_number',
            'bs_name',
            'address',
            'types_project',
            'types_places_hardware',
            'places_hardware',
            'places_antenna',
            'capex',
            'hight_object',
            'open_date',
            'years',
            'bs_gfk',
            'rru_gfk',
            'geo',
            'route_LL',
            'route_PPO',
            'statuses_project',
            'pos_code',
            'prime_contractors',
            'comment'
        ];
    } else if (type === 'task') {
        headers = [
            'name',
            'number',
            'replay',
            'object_number',
            'object_name',
            'object_status_name',
            'created_at',
            'user_position',
            'user_short_name',
            'project_number',
            'bs_number',
            'bs_name',
            'bs_address',
            'project_type',
            'gfk',
            'branch',
            'region',
            'status'
        ];
    }

    const headerRow = document.createElement('tr');
    headerRow.setAttribute('class', 'style__TableStringStyled-sc-1c82g3t-1 hwrWAV');

    headers.forEach(header => {
        const th = document.createElement('td');
        th.setAttribute('width', 'calc(110 / 1900 * 100%)');
        th.setAttribute('class', 'style__TableCellStyled-sc-1c82g3t-3 euagwJ');
        const div = document.createElement('div');
        div.setAttribute('class', 'style__TableHeadStyled-sc-1c82g3t-4 cjYqEH');
        const span = document.createElement('span');
        span.setAttribute('class', 'dsb_typography dsb_typography__subtitle3');
        span.textContent = header;
        div.appendChild(span);
        th.appendChild(div);
        headerRow.appendChild(th);
    });

    table.appendChild(headerRow);

    data.forEach(item => {
        const row = document.createElement('tr');
        row.setAttribute('class', 'style__TableStringStyled-sc-1c82g3t-1 hwrWAV style__ProjectString-sc-hfirfp-1 hNFYXu');

        headers.forEach(header => {
            const td = document.createElement('td');
            td.setAttribute('class', 'style__TableCellStyled-sc-1c82g3t-3 lguZrP');
            const div = document.createElement('div');
            div.setAttribute('class', 'style__TableCellContentStyled-sc-1c82g3t-5 ePYmXN');
            const span = document.createElement('span');

            if (type === 'project') {
                if (header === 'id') {
                    const link = document.createElement('a');
                    link.href = `https://dmc.beeline.ru/projects/${item.id}`;
                    link.textContent = ' 🔗 '; //item.id;
                    span.appendChild(link);
                } else if (header === 'geo') {
                    const match = item[header]?.match(/\(([^)]+)\)/);
                    if (match) {
                        const coords = match[1].split(' ');
                        const lat = coords[0];
                        const lng = coords[1];
                        const link = document.createElement('a');
                        link.href = `https://yandex.ru/maps/?pt=${lat},${lng}&z=16&l=skl`;
                        link.textContent = `${lat}, ${lng}`;
                        span.appendChild(link);
                    } else {
                        span.textContent = item[header] || '';
                    }
                } else if (header === 'route_LL' || header === 'route_PPO') {
                    const branchName = item.branch;
                    const branchCoords = branchCoordinates[branchName];
                    const geoMatch = item.geo?.match(/\(([^)]+)\)/);
                    let projectCoords = '';
                    if (geoMatch) {
                        const coords = geoMatch[1].split(' ');
                        const lat = coords[0];
                        const lng = coords[1];
                        projectCoords = `${lng},${lat}`;
                    }

                    if (header === 'route_LL') {
                        if (branchCoords && branchCoords.delivery && projectCoords) {
                            const deliveryCoords = branchCoords.delivery.split(',').map(c => c.trim());
                            const url = `https://yandex.ru/maps/?rtext=${deliveryCoords[0]},${deliveryCoords[1]}~${projectCoords}&mode=routes&routes%5Bavoid%5D=tolls%2Cunpaved%2Cpoor_condition&rtm=atm&rtt=auto&ruri=~`;
                            const link = document.createElement('a');
                            link.href = url;
                            link.textContent = '🔗 🚛 '//'Доставка ->>>';
                            link.target = '_blank';
                            span.appendChild(link);
                        } else {
                            span.textContent = '';
                        }
                    } else if (header === 'route_PPO') {
                        if (branchCoords && branchCoords.survey && projectCoords) {
                            const surveyCoords = branchCoords.survey.split(',').map(c => c.trim());
                            const url = `https://yandex.ru/maps/?rtext=${surveyCoords[0]},${surveyCoords[1]}~${projectCoords}&mode=routes&routes%5Bavoid%5D=tolls%2Cunpaved%2Cpoor_condition&rtm=atm&rtt=auto&ruri=~`;
                            const link = document.createElement('a');
                            link.href = url;
                            link.textContent = '🔗 🔍 '//'Обследование ->>>';
                            link.target = '_blank';
                            span.appendChild(link);
                        } else {
                            span.textContent = '';
                        }
                    } else {
                        span.textContent = item[header] || '';
                    }
                } else if (header === 'hight_object') {
                    span.textContent = item[header] ? item[header].toString().replace('.', ',') : '';
                } else {
                    span.textContent = item[header] || '';
                }
            } else {
                span.textContent = item[header] || '';
            }

            div.appendChild(span);
            td.appendChild(div);
            row.appendChild(td);
        });

        table.appendChild(row);
    });

    return table.outerHTML;
}

    // Функция для обработки таблицы перед копированием
    function processTable(tableHTML, type) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(tableHTML, 'text/html');
        const table = doc.querySelector('table');

        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (type === 'project') {
                for (let i = 24; i < cells.length; i++) {
                    if (cells[i]) cells[i].remove();
                }
            }
        });

        const headerRow = table.querySelector('tr');
        const headerCells = headerRow.querySelectorAll('td');

        const newHeaders = type === 'project' ? [
            'Регион',
            'Филиал',
            'Проект',
            'Ссылка',
            'Номер БС',
            'Наименование БС',
            'Адрес',
            'Тип проекта',
            'Размещение оборудования',
            'Площадка оборудования',
            'Размещение антенн',
            'Размещение БС',
            'Высота объекта',
            'Дата открытия',
            'Год ПРС',
            'Код ГФК',
            'Код ГФК транспорт',
            'Координаты',
            'Доставка',
            'Обследование',
            'Статус',
            'Номер позиции',
            'Основной ГПО',
            'Комментарий'
        ] : [
            'Задача',
            '№ Задачи',
            'Повтор задачи',
            '№ Документа',
            'Тип документа',
            'Статус документа',
            'Создано',
            'Должность исполнителя',
            'Исполнитель',
            '№ проекта',
            '№ БС',
            'Название БС',
            'Адрес БС',
            'Тип проекта',
            'Код ГФК',
            'Филиал',
            'Регион',
            'Статус'
        ];

        headerCells.forEach((cell, index) => {
            if (index < newHeaders.length) {
                const span = cell.querySelector('span');
                if (span) span.textContent = newHeaders[index];
            }
        });

        return table.outerHTML;
    }

    // Функция для копирования текста в буфер обмена
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('📋 Текст скопирован в буфер обмена');
        }).catch(err => {
            console.error('❌ Ошибка при копировании в буфер обмена:', err);
        });
    }

    // Функция для загрузки списка филиалов через API
    async function loadBranches() {
        const token = findToken();
        if (!token) {
            console.error('❌ Токен не найден');
            alert('Токен не найден');
            return;
        }

        try {
            const response = await axios.get('https://dmc.beeline.ru/api/catalogs/branches/?region=', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const branches = response.data;

            branchSelect.innerHTML = ''; // Очистка предыдущих опций

            branches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.id;
                option.textContent = branch.name;
                branchSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Ошибка при загрузке филиалов:', error);
            alert('Не удалось загрузить список филиалов');
        }
    }

    // Создание кнопки и запуск скрипта
    loadAxios()
        .then(() => {
            createButton();
        })
        .catch(err => {
            console.error('❌ Axios не загружен:', err);
            alert('Не удалось загрузить библиотеку Axios. Скрипт не может работать.');
        });
})();
