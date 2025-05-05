// ==UserScript==
// @name         Beeline DMC Data Extractor + AutoUpdater
// @namespace    http://tampermonkey.net/
// @version      7.1.7
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
    
    // Переменная для хранения Axios
    let axios = null;
    let axiosLoadedPromise = null;
    
    // Функция для безопасной загрузки Axios
    function loadAxios() {
        if (axiosLoadedPromise) return axiosLoadedPromise;
        
        axiosLoadedPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/axios@0.21.1/dist/axios.min.js';
            script.onload = () => {
                if (window.axios) {
                    axios = window.axios;
                    console.log('✅ Axios успешно загружен');
                    resolve();
                } else {
                    console.error('❌ Axios не найден в window');
                    reject(new Error('Axios не загружен'));
                }
            };
            script.onerror = () => {
                console.error('❌ Ошибка загрузки Axios');
                reject(new Error('Ошибка загрузки Axios'));
            };
            document.head.appendChild(script);
        });
        
        return axiosLoadedPromise;
    }

    // Фильтры по регионам (остались без изменений)
    const filter_south = "1b349473-eea7-42a0-8fd2-cfe108543bee,af71b045-5f0f-42f2-9033-1a82cdfbefb4,74ac0640-83a6-4973-a3fb-1e1b300a897c,a46571ce-4df0-4790-a09d-c733ca5dd6bc,f096da02-f05b-448f-87c6-e7d92fb65178,cb6d9423-526d-437b-8bb6-49967f4cc991";
    const filter_volga = "8ff0b9ea-ed23-4c88-b538-7decc3d0e3cf,6239e02e-d651-4ffc-9c9d-86c3ff420369,9f31d920-f48f-4794-ac4f-45ff2e1455f7,5cba0ddb-b4b5-4246-b946-822055a6788c,a534be57-c985-4493-a171-e5f9f78651be,3d429611-6fca-403d-8624-9ebb5d21ac51,4c12c603-af46-4c33-8d90-4fdb27d33df8,61274562-9acf-4563-9022-ddd026b9c7ed,663a7a85-517d-4644-a6cd-55d08d188aa5,5302af3a-93a5-4e8a-be56-51b89aa908c8,61f808ab-801d-42a7-a29d-65e891dc9094,72fc8dc9-9f76-41e4-b7e2-b6aa98aac005,e7f11972-8629-4b37-bc88-ded646c7142e,7af92d65-6933-4039-bab0-6631c8102584,cde313d6-b8e6-49ba-b47a-411a696d8b92";
    // ... (остальные фильтры без изменений)

    // Координаты филиалов (остались без изменений)
    const branchCoordinates = {
        "Барнаульский": { delivery: "55.007251, 82.535672", survey: "53.3565,83.7636" },
        // ... (остальные координаты без изменений)
    };

    // Функция для проверки токена
    function isToken(value) {
        return typeof value === 'string' && value.split('.').length === 3;
    }

    // Функция для поиска токена
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

    // Функция для создания кнопки
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

    // Загрузка Axios и создание кнопки
    loadAxios()
        .then(() => {
            createButton();
        })
        .catch(err => {
            console.error('❌ Axios не загружен:', err);
            alert('Не удалось загрузить необходимую библиотеку Axios. Проверьте подключение к интернету.');
        });

    // Безопасный showModal
    async function showModal() {
        if (!axios) {
            console.log('⏳ Ожидание загрузки Axios...');
            try {
                await loadAxios();
                // Рекурсивный вызов после загрузки Axios
                return showModal();
            } catch (error) {
                console.error('❌ Axios не загружен:', error);
                alert('Не удалось загрузить Axios. Скрипт не может работать.');
                return;
            }
        }

        // Основная логика модального окна
        const modal = document.createElement('div');
        // ... (остальной код модального окна без изменений)
        
        // Добавлены проверки на наличие axios в функциях:
        async function loadBranches() {
            if (!axios) {
                console.error('❌ Axios не загружен');
                alert('Axios не загружен');
                return;
            }
            // ... (остальной код загрузки филиалов)
        }

        // Аналогично для extractProjectData и extractTaskData
    }

    // Функции extractData и вспомогательные функции (без изменений)
    function extractData(uncompletedTasks) {
        if (window.location.href.includes('/projects')) {
            extractProjectData();
        } else if (window.location.href.includes('/processes')) {
            extractTaskData(uncompletedTasks);
        }
    }

    async function extractProjectData() {
        if (!axios) {
            console.error('❌ Axios не загружен');
            alert('Axios не загружен');
            return;
        }
        // ... (остальной код)
    }

    async function extractTaskData(uncompletedTasks) {
        if (!axios) {
            console.error('❌ Axios не загружен');
            alert('Axios не загружен');
            return;
        }
        // ... (остальной код)
    }

    // ... (остальной код скрипта без изменений)
})();
