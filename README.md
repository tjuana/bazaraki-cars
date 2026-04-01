# bazaraki-cars

CLI-помощник для покупки б/у авто на Кипре. Скрейпит объявления с Bazaraki.com, анализирует через AI, генерит сообщения продавцам в WhatsApp.

## Что делает

1. **Scrape** — собирает объявления с Bazaraki с фильтрами (бренд, модель, цена, год, пробег, КПП, топливо)
2. **Analyze** — AI оценивает каждое объявление: справедливая цена, риски, рекомендация (buy/negotiate/avoid)
3. **Contact** — генерирует WhatsApp-сообщение продавцу, сохраняет .vcf контакт, открывает его в Contacts
4. **Reply** — помогает вести переговоры: вставляешь ответ продавца, получаешь свой следующий ход
5. **Dashboard** — сводка: сколько объявлений, горячие варианты, активные переговоры

## Быстрый старт

```bash
# 1. Установить зависимости
npm install
npx playwright install chromium

# 2. Настроить .env
cp .env.example .env
# Добавить GROQ_API_KEY (бесплатно на groq.com) или GEMINI_API_KEY

# 3. Создать базу данных
npx drizzle-kit push

# 4. Залогиниться на Bazaraki (сохраняет cookies)
npx tsx src/index.ts login

# 5. Собрать объявления
npx tsx src/index.ts scrape --pages 5

# 6. Проанализировать AI
npx tsx src/index.ts analyze-all

# 7. Посмотреть результаты
npx tsx src/index.ts dashboard
npx tsx src/index.ts list --status analyzed

# 8. Написать продавцу
npx tsx src/index.ts contact <id>

# 9. Продолжить переговоры
npx tsx src/index.ts reply <id>
```

## Команды

| Команда | Что делает |
|---------|-----------|
| `login` | Открывает браузер для входа на Bazaraki, сохраняет куки |
| `scrape -p <N> -d <district>` | Скрейпит объявления. `-p` — кол-во страниц, `-d` — район |
| `list -s <status> -b <brand>` | Показать объявления из базы с фильтрами |
| `analyze <id>` | AI-анализ одного объявления |
| `analyze-all` | Анализ всех новых (status=new) |
| `contact <id>` | Сгенерить WhatsApp сообщение + .vcf контакт |
| `reply <id>` | Вставить ответ продавца, получить AI-ответ для торга |
| `dashboard` | Сводка: статусы, горячие варианты, переговоры |

## Конфиг

Файл `bazaraki-cars.config.json`:

```json
{
  "budget": { "min": 9000, "max": 14000 },
  "brands": ["toyota"],
  "models": ["yaris"],
  "districts": [],
  "maxMileage": 120000,
  "minYear": 2021,
  "maxYear": null,
  "fuelTypes": ["petrol", "hybrid"],
  "transmission": "automatic",
  "excludeDealers": false,
  "scrapeMaxPages": 20,
  "scrapeDelayMs": { "min": 3000, "max": 8000 },
  "whatsappRateLimit": { "maxPerHour": 8 }
}
```

### Параметры

- **budget** — диапазон цен в EUR
- **brands** — марки авто (toyota, honda, bmw, и др.)
- **models** — конкретные модели (yaris, corolla, civic, и др.)
- **districts** — районы: nicosia, limassol, larnaca, paphos, famagusta
- **maxMileage** — максимальный пробег в км
- **minYear / maxYear** — диапазон годов выпуска
- **fuelTypes** — типы топлива: petrol, diesel, hybrid, electric, lpg
- **transmission** — automatic или manual
- **scrapeDelayMs** — задержка между запросами (anti-bot)

## AI-провайдеры

Поддерживаются два провайдера. Используется тот, чей ключ есть в `.env` (Groq в приоритете):

| Провайдер | Модель | Бесплатный лимит | Переменная |
|-----------|--------|-----------------|------------|
| **Groq** | Llama 3.3 70B | ~14,400 req/day, 30 RPM | `GROQ_API_KEY` |
| **Gemini** | gemini-2.0-flash | 1,500 req/day, 15 RPM | `GEMINI_API_KEY` |

Получить ключи:
- Groq: [console.groq.com](https://console.groq.com)
- Gemini: [aistudio.google.com](https://aistudio.google.com)

## Структура проекта

```
src/
  index.ts              # CLI entry point (commander)
  config.ts             # Загрузка конфига + .env
  ai/
    client.ts           # AI клиенты (Groq / Gemini)
    analyze-listing.ts  # AI анализ объявления
    generate-message.ts # Генерация WhatsApp сообщений
    analyze-reply.ts    # AI помощь в переговорах
    prompts.ts          # Системные промпты
    tools.ts            # Типы для AI output
  scraper/
    browser.ts          # Playwright browser + cookies
    scrape-pipeline.ts  # Оркестрация скрейпинга + URL фильтры
    search-page.ts      # Парсинг страницы поиска
    listing-page.ts     # Парсинг страницы объявления
    selectors.ts        # CSS селекторы Bazaraki
    normalize.ts        # Нормализация данных
    rate-limit.ts       # Задержки между запросами
  commands/             # Обработчики CLI команд
  db/
    client.ts           # SQLite через Drizzle ORM
    schema.ts           # Схема базы данных
  whatsapp/
    link.ts             # Генерация wa.me ссылок
    templates.ts        # Шаблоны сообщений
  types/                # TypeScript типы
  utils/                # Утилиты (logger, parse-price, parse-mileage)
data/
  bazaraki.db           # SQLite база данных
  cookies.json          # Сохранённые куки Bazaraki
  contacts/             # .vcf файлы контактов
```

## Флоу покупки

```
login → scrape → analyze-all → dashboard → contact <id> → reply <id>
  │        │          │             │            │             │
  │        │          │             │            │             └─ Торг через WhatsApp
  │        │          │             │            └─ .vcf + WhatsApp ссылка
  │        │          │             └─ Смотришь горячие варианты
  │        │          └─ AI оценивает: цена, риски, рекомендация
  │        └─ Собирает объявления с фильтрами в БД
  └─ Сохраняет cookies для авторизации
```

## Особенности рынка Кипра

- Японские импорты доминируют (Toyota, Honda, Nissan)
- **Аукционный лист** — главный документ, подтверждает пробег и историю
- Скручивание пробега — распространённая проблема
- Средний пробег: 12-15к км/год
- Двигатели 1.0-1.6L — дешевле налог и страховка
- Продавцы завышают цену на 10-30%, торг обязателен

## .env пример

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxx
```
