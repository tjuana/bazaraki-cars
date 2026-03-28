import type { Page } from 'playwright';
import { getBrowser, closeBrowser } from './browser.js';
import { parseSearchPage, hasNextPage } from './search-page.js';
import { parseListingPage } from './listing-page.js';
import { normalizeListing } from './normalize.js';
import { randomDelay } from './rate-limit.js';
import { DISTRICTS, type DistrictKey } from './selectors.js';
import { getDb, schema } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { loadConfig } from '../config.js';
import { log } from '../utils/logger.js';
import chalk from 'chalk';

export interface ScrapeOptions {
  maxPages?: number;
  district?: DistrictKey;
}

function buildSearchUrl(district?: DistrictKey): string {
  const base = 'https://www.bazaraki.com/car-motorbikes-boats-and-parts/cars-trucks-and-vans/';
  if (district && DISTRICTS[district]) {
    return `${base}${DISTRICTS[district]}/`;
  }
  return base;
}

async function listingExists(externalId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .select({ id: schema.listings.id })
    .from(schema.listings)
    .where(eq(schema.listings.externalId, externalId))
    .limit(1);
  return result.length > 0;
}

async function saveListing(data: ReturnType<typeof normalizeListing>): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = await db
    .insert(schema.listings)
    .values({ ...data, scrapedAt: now })
    .returning({ id: schema.listings.id });
  return result[0].id;
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

export async function runScrapePipeline(options: ScrapeOptions = {}): Promise<void> {
  const config = loadConfig();
  const maxPages = options.maxPages ?? config.scrapeMaxPages;

  log.section(`Scraping Bazaraki — до ${maxPages} страниц`);
  log.dim(`Бюджет: €${config.budget.min}–€${config.budget.max} | Бренды: ${config.brands.join(', ')} | Макс пробег: ${config.maxMileage}km`);

  log.info('Открываю браузер...');
  const { context } = await getBrowser();
  const page: Page = await context.newPage();
  log.success('Браузер готов.');

  let currentPage = 1;
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  const baseUrl = buildSearchUrl(options.district);

  try {
    while (currentPage <= maxPages) {
      const url = currentPage === 1 ? baseUrl : `${baseUrl}?page=${currentPage}`;

      log.section(`📄 Страница ${currentPage}/${maxPages}`);
      log.info(`Загружаю: ${url}`);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await randomDelay(1500, 2500);

      const cards = await parseSearchPage(page);

      if (cards.length === 0) {
        log.warn('Листинги не найдены. Возможно, сломались селекторы или Cloudflare блокирует.');
        log.dim('Попробуй: npx tsx src/index.ts login — и скрейпни заново.');
        break;
      }

      log.success(`Найдено ${cards.length} объявлений на странице ${currentPage}`);

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const num = `[${i + 1}/${cards.length}]`;

        if (await listingExists(card.externalId)) {
          totalSkipped++;
          log.dim(`  ${num} Уже в базе: ${card.title.slice(0, 50)}`);
          continue;
        }

        await waitWithCountdown(config.scrapeDelayMs.min, config.scrapeDelayMs.max);

        log.info(`  ${num} Открываю: ${card.title.slice(0, 55)}`);

        try {
          const detail = await parseListingPage(page, card.url);
          const normalized = normalizeListing(card, detail);

          const id = await saveListing(normalized);
          totalSaved++;

          const price = normalized.price ? chalk.green(`€${normalized.price / 100}`) : chalk.dim('цена?');
          const km = normalized.mileage ? chalk.cyan(`${normalized.mileage.toLocaleString()}km`) : chalk.dim('пробег?');
          const phone = normalized.phoneNormalized ? chalk.yellow(`📞 +${normalized.phoneNormalized}`) : chalk.red('❌ нет телефона');

          log.success(`  ${num} #${id}: ${normalized.title.slice(0, 40)} — ${price} ${km} ${phone}`);
        } catch (err) {
          totalFailed++;
          log.error(`  ${num} Ошибка парсинга: ${(err as Error).message.slice(0, 80)}`);
        }

        // Возврат на страницу поиска
        log.dim(`  ${num} Возвращаюсь на страницу поиска...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await randomDelay(800, 1500);
      }

      const more = await hasNextPage(page);
      if (!more) {
        log.info('Следующей страницы нет — парсинг завершён.');
        break;
      }

      currentPage++;
      await waitWithCountdown(config.scrapeDelayMs.min, config.scrapeDelayMs.max);
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
