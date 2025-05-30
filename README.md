# DMC Scripts

![Beeline DMC Script Icon](https://raw.githubusercontent.com/zOnVolga/DMC_scripts/main/icon-beeline-yellow.svg)  
Сборник полезных скриптов для работы с DMC (Data Management Console) от Beeline и других сервисов.

Все скрипты оптимизированы под использование в расширениях:
- ✅ [Tampermonkey](https://www.tampermonkey.net/)
- ✅ [Violentmonkey](https://violentmonkey.github.io/) *(рекомендуется)*

---

## 🧩 Скрипты

### 📥 Beeline DMC Data Extractor + Auto-Updater

> Извлечение данных из интерфейса Beeline DMC с возможностью автоматического обновления при появлении новой версии на GitHub.

#### 🔧 Возможности:
- Удобное копирование данных без лишних кликов
- Поддержка автообновления (раз в 6 часов)
- Уведомление о новых версиях с информацией о коммите

#### 📦 Версия: `7.1.3`

#### 🖱️ Установка:
[![Install Script](https://img.shields.io/badge/-Установить-success)](https://raw.githubusercontent.com/zOnVolga/DMC_scripts/main/Beeline%20DMC%20Data%20Extractor.js)

👉 После установки скрипт будет автоматически проверять наличие обновлений раз в 6 часов.

---

## 🔄 Как обновлять скрипты

При каждом коммите изменений:
1. Обнови версию в `@version` внутри скрипта.
2. Залей обновлённый файл в репозиторий.
3. Пользователи получат уведомление через 6 часов или при следующей загрузке страницы.

Пример строки версии:
```js
// @version      7.1.3
