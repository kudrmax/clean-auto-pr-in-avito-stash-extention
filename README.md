# Stash AutoPR Section

Chrome-расширение для дашборда `https://stash.msk.avito.ru/dashboard`: убирает AutoPR из списка
**Pull requests to review (N)** и показывает их отдельной секцией
**Pull requests to review (AutoPRs) (N)** под **Your pull requests**.

- AutoPR определяется по regex заголовка. По умолчанию `^\s*\[AutoPR\]|AUTOPR-\d+` (без учёта регистра).
- Счётчик в заголовке «Pull requests to review» уменьшается на число AutoPR.
- Оригинальные строки не переносятся, а скрываются через CSS. В секции показываются их копии, поэтому
  React-рендер Stash не ломается. Ссылки в копиях работают, а поповер «+N» у ревьюеров — нет.
- Если AutoPR нет, секция не показывается.

## Установка

1. Склонировать или скопировать репозиторий, например в `~/projects/stash-autopr-section`.
2. Открыть в Chrome `chrome://extensions`.
3. Включить **Developer mode** (справа вверху).
4. Нажать **Load unpacked** и выбрать папку репозитория (ту, где лежит `manifest.json`).
5. Открыть или обновить `https://stash.msk.avito.ru/dashboard`.

Обновление: `git pull`, затем на карточке расширения в `chrome://extensions` нажать ⟳ и обновить вкладку Stash.

## Настройка regex

`chrome://extensions` → Stash AutoPR Section → **Details** → **Extension options**. Изменения применяются
к открытым вкладкам сразу, без перезагрузки.

## Разработка

```bash
npm install
npm test
```

Структура:

- `src/AutoPrSettings.js` — хранение regex в `chrome.storage.sync`.
- `src/AutoPrMatcher.js` — сопоставление заголовка с regex.
- `src/ReviewDashboard.js` — доступ к DOM дашборда Stash (селекторы).
- `src/AutoPrSection.js` — рендер секции, скрытие оригиналов, пересчёт заголовка.
- `src/AutoPrController.js` — `MutationObserver` и перерисовка при изменениях страницы.
- `src/content.js` — точка входа content script.
- `options/` — страница настроек.
