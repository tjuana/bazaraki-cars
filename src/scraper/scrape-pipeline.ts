import type { Page } from 'playwright';
import { getBrowser, closeBrowser } from './browser.js';
import { parseSearchPage, hasNextPage } from './search-page.js';
import { parseListingPage } from './listing-page.js';
import { normalizeListing } from './normalize.js';
import { randomDelay } from './rate-limit.js';
import { DISTRICTS, type DistrictKey } from './selectors.js';
import { getDb, schema } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { loadConfig, type Config } from '../config.js';
import { log } from '../utils/logger.js';
import chalk from 'chalk';

/** Navigate with retry on transient network errors */
async function safeGoto(page: Page, url: string, timeout = 45000, retries = 2): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      return;
    } catch (err) {
      const msg = (err as Error).message;
      const transient = msg.includes('ERR_NETWORK') || msg.includes('Timeout') || msg.includes('ERR_CONNECTION');
      if (!transient || attempt === retries) throw err;
      log.warn(`  Сеть: retry ${attempt + 1}/${retries} через 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

export interface ScrapeOptions {
  maxPages?: number;
  district?: DistrictKey;
}

// ── Year → Bazaraki value mapping ────────────────────────────────────────────
// Bazaraki uses non-linear IDs for years. Derived from their <select> options.
const YEAR_TO_VALUE: Record<number, string> = {};
// 1950..2013 → value = year - 1949 (1950→1, 1951→2, ..., 2013→64)
for (let y = 1950; y <= 2013; y++) YEAR_TO_VALUE[y] = String(y - 1949);
// 2014..2021 → value = year - 1949 (2014→65, 2015→66, ..., 2021→75 — but 2020 is 71)
// Actually the mapping from the live site:
Object.assign(YEAR_TO_VALUE, {
  2014: '65', 2015: '66', 2016: '67', 2017: '68', 2018: '69',
  2019: '70', 2020: '71', 2021: '75', 2022: '76', 2023: '77',
  2024: '78', 2025: '79', 2026: '80',
});

// ── Fuel type mapping ────────────────────────────────────────────────────────
const FUEL_TYPE_VALUES: Record<string, string[]> = {
  petrol:   ['7'],            // Petrol
  diesel:   ['2'],            // Diesel
  hybrid:   ['20', '15', '30', '13'], // Hybrid Petrol, Plug-In Hybrid Petrol, Hybrid Diesel, Plug-In Hybrid Diesel
  electric: ['10'],           // Electric
  lpg:      ['5'],            // LPG
};

// ── Brand → URL slug ─────────────────────────────────────────────────────────
const BRAND_SLUGS: Record<string, string> = {
  toyota: 'toyota', honda: 'honda', mazda: 'mazda', nissan: 'nissan',
  mitsubishi: 'mitsubishi', suzuki: 'suzuki', subaru: 'subaru', lexus: 'lexus',
  bmw: 'bmw', 'mercedes-benz': 'mercedes', mercedes: 'mercedes',
  volkswagen: 'volkswagen', vw: 'volkswagen', audi: 'audi', ford: 'ford',
  hyundai: 'hyundai', kia: 'kia', opel: 'opel', peugeot: 'peugeot',
  renault: 'renault', citroen: 'citroen', volvo: 'volvo',
};

// Model slug: brand-model (e.g. "toyota-yaris")
const MODEL_SLUGS: Record<string, string> = {
  yaris: 'toyota-yaris', corolla: 'toyota-corolla', rav4: 'toyota-rav4',
  'c-hr': 'toyota-c-hr', camry: 'toyota-camry', auris: 'toyota-auris',
  aygo: 'toyota-aygo', prius: 'toyota-prius',
  civic: 'honda-civic', jazz: 'honda-jazz', fit: 'honda-fit', 'hr-v': 'honda-hr-v',
  mazda3: 'mazda-mazda3', mazda2: 'mazda-mazda2', cx5: 'mazda-cx-5', cx3: 'mazda-cx-3',
  note: 'nissan-note', juke: 'nissan-juke', qashqai: 'nissan-qashqai',
};

// Gearbox: 1=automatic, 2=manual
const GEARBOX_VALUES: Record<string, string> = {
  automatic: '1', manual: '2',
};

function buildSearchUrl(config: Config, brand?: string, model?: string, district?: DistrictKey, page?: number): string {
  const parts = ['https://www.bazaraki.com/car-motorbikes-boats-and-parts/cars-trucks-and-vans'];

  // Brand in path
  if (brand) {
    const slug = BRAND_SLUGS[brand.toLowerCase()] ?? brand.toLowerCase();
    parts.push(slug);
  }

  // Model in path (e.g. /toyota/toyota-yaris/)
  if (model) {
    const modelSlug = MODEL_SLUGS[model.toLowerCase()] ?? `${brand?.toLowerCase() ?? ''}-${model.toLowerCase()}`;
    parts.push(modelSlug);
  }

  // District in path
  if (district && DISTRICTS[district]) {
    parts.push(DISTRICTS[district]);
  }

  const base = parts.join('/') + '/';

  // Query params from config
  const params = new URLSearchParams();

  // Price range
  if (config.budget.min) params.set('price_min', String(config.budget.min));
  if (config.budget.max) params.set('price_max', String(config.budget.max));

  // Year range
  if (config.minYear && YEAR_TO_VALUE[config.minYear]) {
    params.set('attrs__year_min', YEAR_TO_VALUE[config.minYear]);
  }
  if (config.maxYear && YEAR_TO_VALUE[config.maxYear]) {
    params.set('attrs__year_max', YEAR_TO_VALUE[config.maxYear]);
  }

  // Max mileage
  if (config.maxMileage) {
    params.set('attrs__mileage_max', String(config.maxMileage));
  }

  // Transmission
  if (config.transmission && GEARBOX_VALUES[config.transmission.toLowerCase()]) {
    params.set('attrs__gearbox', GEARBOX_VALUES[config.transmission.toLowerCase()]);
  }

  // Fuel types
  if (config.fuelTypes.length > 0) {
    const fuelValues: string[] = [];
    for (const ft of config.fuelTypes) {
      const vals = FUEL_TYPE_VALUES[ft.toLowerCase()];
      if (vals) fuelValues.push(...vals);
    }
    for (const v of fuelValues) {
      params.append('attrs__fuel-type', v);
    }
  }

  // Page
  if (page && page > 1) {
    params.set('page', String(page));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function findListing(externalId: string): Promise<{ id: number; price: number | null } | null> {
  const db = getDb();
  const result = await db
    .select({ id: schema.listings.id, price: schema.listings.price })
    .from(schema.listings)
    .where(eq(schema.listings.externalId, externalId))
    .limit(1);
  return result[0] ?? null;
}

/** Returns id (new), 0 (price updated), -1 (unchanged/skip) */
async function saveListing(data: ReturnType<typeof normalizeListing>): Promise<{ id: number; priceChanged: boolean }> {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = await findListing(data.externalId);
  if (existing) {
    if (existing.price !== data.price && data.price !== null) {
      await db
        .update(schema.listings)
        .set({ price: data.price, scrapedAt: now })
        .where(eq(schema.listings.id, existing.id));
      return { id: existing.id, priceChanged: true };
    }
    return { id: -1, priceChanged: false };
  }

  const result = await db
    .insert(schema.listings)
    .values({ ...data, scrapedAt: now })
    .returning({ id: schema.listings.id });
  return { id: result[0].id, priceChanged: false };
}

/** Показывает countdown чтобы было видно что приложение не зависло */
async function waitWithCountdown(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs);
  const secs = Math.ceil(ms / 1000);
  for (let i = secs; i > 0; i--) {
    process.stdout.write(`\r${chalk.dim(`  ⏳ Пауза ${i}s (anti-bot)...   `)}`);
    await new Promise((r) => setTimeout(r, Math.min(1000, ms - (secs - i) * 1000)));
  }
  process.stdout.write('\r' + ' '.repeat(40) + '\r');
}

async function scrapeBrand(
  page: Page,
  config: Config,
  brand: string,
  model: string | undefined,
  maxPages: number,
  district?: DistrictKey
): Promise<{ saved: number; skipped: number; failed: number }> {
  let saved = 0, skipped = 0, failed = 0;
  let currentPage = 1;
  const label = model ? `${brand}/${model}`.toUpperCase() : brand.toUpperCase();

  while (currentPage <= maxPages) {
    const url = buildSearchUrl(config, brand, model, district, currentPage);

    log.section(`📄 ${chalk.bold(label)} — стр. ${currentPage}/${maxPages}`);
    log.dim(`  ${url}`);

    await safeGoto(page, url);
    await randomDelay(1500, 2500);

    const cards = await parseSearchPage(page);

    if (cards.length === 0) {
      if (currentPage === 1) {
        log.warn(`  Нет объявлений для ${label} с текущими фильтрами.`);
      } else {
        log.info(`  Страниц больше нет для ${label}.`);
      }
      break;
    }

    log.success(`  Найдено ${cards.length} объявлений`);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const num = `[${i + 1}/${cards.length}]`;

      await waitWithCountdown(config.scrapeDelayMs.min, config.scrapeDelayMs.max);

      log.info(`  ${num} Открываю: ${card.title.slice(0, 55)}`);

      try {
        const detail = await parseListingPage(page, card.url);
        const normalized = normalizeListing(card, detail);

        const { id, priceChanged } = await saveListing(normalized);
        if (id === -1) { skipped++; log.dim(`  ${num} Без изменений: ${card.title.slice(0, 50)}`); continue; }
        saved++;

        const price = normalized.price ? chalk.green(`€${normalized.price / 100}`) : chalk.dim('цена?');
        const km = normalized.mileage ? chalk.cyan(`${normalized.mileage.toLocaleString()}km`) : chalk.dim('пробег?');
        const phone = normalized.phoneNormalized ? chalk.yellow(`📞 +${normalized.phoneNormalized}`) : chalk.red('❌ нет телефона');
        const tag = priceChanged ? chalk.magenta(' [цена обновлена!]') : '';

        log.success(`  ${num} #${id}: ${normalized.title.slice(0, 40)} — ${price} ${km} ${phone}${tag}`);
      } catch (err) {
        failed++;
        log.error(`  ${num} Ошибка парсинга: ${(err as Error).message.slice(0, 80)}`);
      }

      // Возврат на страницу поиска
      log.dim(`  ${num} Возвращаюсь на страницу поиска...`);
      try {
        await safeGoto(page, url);
      } catch {
        log.warn(`  ${num} Не удалось вернуться на поиск — пропускаю остальные на этой странице`);
        break;
      }
      await randomDelay(800, 1500);
    }

    const more = await hasNextPage(page);
    if (!more) {
      log.info(`  Следующей страницы нет для ${label}.`);
      break;
    }

    currentPage++;
    await waitWithCountdown(config.scrapeDelayMs.min, config.scrapeDelayMs.max);
  }

  return { saved, skipped, failed };
}

export async function runScrapePipeline(options: ScrapeOptions = {}): Promise<void> {
  const config = loadConfig();
  const maxPages = options.maxPages ?? config.scrapeMaxPages;
  // Build list of (brand, model) pairs to scrape
  const targets: Array<{ brand: string; model?: string }> = [];
  if (config.models && config.models.length > 0) {
    // Models specified — scrape each model (brand is inferred or first brand)
    const defaultBrand = config.brands[0] ?? '';
    for (const model of config.models) {
      targets.push({ brand: defaultBrand, model });
    }
  } else if (config.brands.length > 0) {
    for (const brand of config.brands) {
      targets.push({ brand });
    }
  } else {
    targets.push({ brand: '' });
  }

  const targetLabel = targets.map(t => t.model ? `${t.brand}/${t.model}` : t.brand).join(', ') || 'все';
  log.section(`Scraping Bazaraki — ${targets.length} запрос(ов), до ${maxPages} стр. каждый`);
  log.dim(`Бюджет: €${config.budget.min}–€${config.budget.max} | ${targetLabel} | Год: ${config.minYear ?? '?'}+ | КПП: ${config.transmission ?? 'все'} | Макс пробег: ${config.maxMileage}km | Топливо: ${config.fuelTypes.join(', ') || 'все'}`);

  log.info('Открываю браузер...');
  const { context } = await getBrowser();
  const page: Page = await context.newPage();
  log.success('Браузер готов.');

  let totalSaved = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    for (let i = 0; i < targets.length; i++) {
      const { brand, model } = targets[i];
      const result = await scrapeBrand(page, config, brand, model, maxPages, options.district);
      totalSaved += result.saved;
      totalSkipped += result.skipped;
      totalFailed += result.failed;

      if (i < targets.length - 1) {
        await waitWithCountdown(config.scrapeDelayMs.min, config.scrapeDelayMs.max);
      }
    }
  } finally {
    await page.close();
    await closeBrowser();
  }

  log.section('✅ Готово!');
  console.log(`  Сохранено:  ${chalk.green(totalSaved)}`);
  console.log(`  Пропущено:  ${chalk.dim(totalSkipped)} (уже в базе)`);
  if (totalFailed > 0) console.log(`  Ошибок:     ${chalk.red(totalFailed)}`);
  console.log();
  console.log(chalk.dim('Следующий шаг:'));
  console.log(chalk.cyan('  npx tsx src/index.ts analyze-all   ') + chalk.dim('# AI анализ всех новых'));
  console.log(chalk.cyan('  npx tsx src/index.ts dashboard      ') + chalk.dim('# смотреть результаты'));
}
