# Clean AutoPR in Avito Stash

Chrome-расширение для дашборда Avito Stash (`https://stash.msk.avito.ru/dashboard`).
Выносит автоматические PR (AutoPR от Service Generator) из списка **Pull requests to review (N)**
в отдельную секцию **Pull requests to review (AutoPRs) (N)**, которая стоит под **Your pull requests**.

## Как работает

- **Поиск AutoPR.** AutoPR определяются по regex заголовка, без учёта регистра. По умолчанию
  `^\s*\[AutoPR\]|AUTOPR-\d+`.
- **Полный список.** Список PR на ревью расширение берёт из REST API Stash
  (`/rest/api/latest/dashboard/pull-requests?state=OPEN&role=REVIEWER`, все страницы) под вашей
  текущей сессией. Поэтому в секцию AutoPRs попадают все AutoPR, в том числе скрытые под «Show more»,
  и N в её заголовке точный.
- **Статус билдов** берётся из `/rest/build-status/latest/commits/stats/{commit}`.
- **Основной список.** AutoPR из «Pull requests to review» скрываются через CSS, DOM Stash не
  трогается. Заголовок «Pull requests to review (N)» остаётся как в Stash: N включает AutoPR.
- **Если API недоступно,** секция собирается из копий видимых строк. Тогда в ней только AutoPR, уже
  показанные на странице; после «Show more» новые подхватываются автоматически. Причина пишется в
  консоль страницы с префиксом `[Clean AutoPR in Avito Stash]`.
- **Ревьюеры.** Показываются первые три, у «+N» есть всплывающая подсказка со списком остальных.
- **Пустая секция.** Если AutoPR нет, секция не показывается.

## Установка

Нужен Chrome (или другой Chromium-браузер) и доступ к Stash, то есть корпоративный VPN.

1. Получить папку расширения: склонировать репозиторий или скопировать папку
   `~/projects/clean-auto-pr-in-avito-stash-extention`.
2. Открыть в Chrome `chrome://extensions`.
3. Включить **Developer mode** (переключатель справа вверху).
4. Нажать **Load unpacked** и выбрать папку расширения (ту, где лежит `manifest.json`).
5. Открыть или обновить `https://stash.msk.avito.ru/dashboard`.

Папку после установки не удалять и не перемещать: Chrome загружает расширение прямо из неё.

### Обновление

После изменения файлов (например, `git pull`) нажать ⟳ на карточке расширения в
`chrome://extensions` и обновить вкладку Stash.

### Проверка, что API доступно

Открыть в браузере
`https://stash.msk.avito.ru/rest/api/latest/dashboard/pull-requests?state=OPEN&role=REVIEWER&limit=5`.
Если вернулся JSON со списком PR (`values`), расширение будет работать через API.

## Настройка regex

`chrome://extensions` → Clean AutoPR in Avito Stash → **Details** → **Extension options**.
Изменения применяются к открытым вкладкам сразу, без перезагрузки.

## Разработка

```bash
npm install
npm test
```

Тесты написаны на `node:test` + `jsdom`, фикстура синтетическая и повторяет разметку дашборда Stash.

### Структура

- `manifest.json` — манифест Chrome-расширения (MV3).
- `src/AutoPrSettings.js` — хранение regex в `chrome.storage.sync`.
- `src/AutoPrMatcher.js` — сопоставление заголовка с regex.
- `src/ReviewDashboard.js` — доступ к DOM дашборда Stash (селекторы).
- `src/StashPullRequestApi.js` — загрузка PR на ревью и статусов билдов из REST API Stash.
- `src/PullRequestRowRenderer.js` — отрисовка строки PR по данным API в разметке Stash.
- `src/AutoPrSection.js` — вставка секции AutoPRs и скрытие AutoPR в основном списке.
- `src/AutoPrController.js` — `MutationObserver`, загрузка данных и перерисовка.
- `src/content.js` — точка входа content script.
- `options/` — страница настроек.
