# schedule-ICT

Расписание групп ИВТ-11МО и ПИЭ-13МО: статичный сайт (React + Vite) с подпиской на календарь.

## Как это работает

- Источник — xlsx «Осень 2026 (26-27 уч.г)» на публичном Яндекс Диске.
- `npm run data` скачивает файл через публичный API Диска, разбирает лист «Бакалавры и магистры» (`shared/parse-xlsx.ts`)
  и пишет `public/data/schedule.json` и `public/ics/<группа>/<вариант>.ics` — по одному файлу на каждую комбинацию
  настроек (выбор к.в., показ факультативов).
- GitHub Actions (`.github/workflows/update-schedule.yml`) делает это каждые 3 часа и коммитит изменения; пуш в `main`
  запускает пересборку на Timeweb Apps.
- Страница читает `schedule.json`, хранит настройки в localStorage и собирает ссылку `webcal://…/ics/<группа>/<вариант>.ics`.

## Команды

```
npm install
npm run data          # скачать таблицу и сгенерировать данные
npm run data:local    # то же из tests/fixtures/schedule.xlsx
npm run dev           # локальный сервер
npm run build         # сборка в dist/
npm test              # vitest
```

## Ручные правки парсинга

`data/overrides.json` — объект с ключами `"<группа>/<день 0-5>/<пара>"` (или с суффиксом `/odd`, `/even`), значения:

```json
{
  "pie-13mo/0/5": {
    "options": [{ "title": "Управление ИТ-проектами", "teacher": "Ерофеев А.А.", "online": true }],
    "excludeDates": ["2026-09-14"],
    "note": "14.09 пары не будет"
  },
  "ivt-11mo/0/5": { "remove": true }
}
```

## Timeweb Apps

Тип приложения — Frontend (React / Vite), Node 22, команда сборки `npm run build`, директория `dist`, автодеплой из ветки `main`.
