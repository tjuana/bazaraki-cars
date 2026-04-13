import { getBrowser, closeBrowser } from './browser.js';
import { randomDelay } from './rate-limit.js';
import { getDb, schema } from '../db/client.js';
import { eq, inArray } from 'drizzle-orm';
import { log } from '../utils/logger.js';
import chalk from 'chalk';

export interface RefreshResult {
  checked: number;
  expired: number;
  priceChanged: number;
  errors: number;
}

/** Light check: is listing still active? And what's the current price? */
async function checkListing(
  page: import('playwright').Page,
  url: string
): Promise<{ active: boolean; price: number | null }> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {
    // Timeout or network error — treat as unknown, skip
    return { active: true, price: null };
  }

  // Bazaraki redirects expired listings away from the original URL
  const finalUrl = page.url();
  if (!finalUrl.includes(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '__never__')) {
    return { active: false, price: null };
  }

  // Check for "The ad expired" banner
  const expiredBanner = await page.$eval(
    'body',
    (body) => body.textContent?.includes('The ad expired') ?? false
  ).catch(() => false);
  if (expiredBanner) return { active: false, price: null };

  // Check if the listing title element exists — if not, listing is gone/expired
  const hasTitle = await page.$('h1.title-announcement, h1[itemprop="name"]').then((el) => !!el);
  if (!hasTitle) return { active: false, price: null };

  // Parse current price from meta tag (most reliable)
  const priceMeta = await page
    .$eval('meta[itemprop="price"]', (el) => el.getAttribute('content') ?? '')
    .catch(() => '');

  let price: number | null = null;
  if (priceMeta) {
    const euros = Math.round(parseFloat(priceMeta));
    if (!isNaN(euros) && euros > 0) price = euros * 100; // store as cents
  }

  if (!price) {
    // Fallback: text price
    const priceText = await page
      .$eval('.announcement-price__cost', (el) => el.textContent?.trim() ?? '')
      .catch(() => '');
    if (priceText) {
      const digits = priceText.replace(/[^\d]/g, '');
      if (digits) price = parseInt(digits, 10) * 100;
    }
  }

  return { active: true, price };
}

export async function runRefreshPipeline(): Promise<RefreshResult> {
  const db = getDb();

  // Get all non-terminal listings
  const activeStatuses = ['new', 'analyzed', 'contacted', 'negotiating'];
  const listings = await db
    .select({ id: schema.listings.id, url: schema.listings.url, price: schema.listings.price, title: schema.listings.title })
    .from(schema.listings)
    .where(inArray(schema.listings.status, activeStatuses));

  if (listings.length === 0) {
    log.info('Нет активных листингов для проверки.');
    return { checked: 0, expired: 0, priceChanged: 0, errors: 0 };
  }

  log.section(`🔄 Refresh — проверяю ${listings.length} листингов`);

  const { context } = await getBrowser();
  const page = await context.newPage();

  let expired = 0;
  let priceChanged = 0;
  let errors = 0;
  const now = new Date().toISOString();

  try {
    for (let i = 0; i < listings.length; i++) {
      const { id, url, price: oldPrice, title } = listings[i];
      const num = `[${i + 1}/${listings.length}]`;
      const shortTitle = title.slice(0, 45);

      await randomDelay(1500, 3000);
      log.dim(`  ${num} ${shortTitle}`);

      try {
        const { active, price: newPrice } = await checkListing(page, url);

        if (!active) {
          expired++;
          await db.update(schema.listings).set({ status: 'expired' }).where(eq(schema.listings.id, id));
          log.warn(`  ${num} ❌ Снято с продажи: ${shortTitle}`);
          continue;
        }

        if (newPrice !== null && newPrice !== oldPrice) {
          priceChanged++;
          const oldEur = oldPrice ? `€${oldPrice / 100}` : '?';
          const newEur = `€${newPrice / 100}`;
          await db
            .update(schema.listings)
            .set({ price: newPrice, scrapedAt: now })
            .where(eq(schema.listings.id, id));
          await db.insert(schema.priceHistory).values({
            listingId: id,
            oldPrice: oldPrice ?? null,
            newPrice,
            source: 'refresh',
            changedAt: now,
          });
          log.success(`  ${num} 💰 Цена изменилась: ${shortTitle} ${chalk.dim(oldEur)} → ${chalk.green(newEur)}`);
        } else {
          log.dim(`  ${num} ✓ Без изменений`);
        }
      } catch (err) {
        errors++;
        log.error(`  ${num} Ошибка: ${(err as Error).message.slice(0, 60)}`);
      }
    }
  } finally {
    await page.close();
    await closeBrowser();
  }

  log.section('✅ Refresh завершён');
  console.log(`  Проверено:      ${chalk.cyan(listings.length)}`);
  console.log(`  Снято с продажи:${chalk.red(expired)}`);
  console.log(`  Цена изменилась:${chalk.yellow(priceChanged)}`);
  if (errors > 0) console.log(`  Ошибок:         ${chalk.red(errors)}`);

  return { checked: listings.length, expired, priceChanged, errors };
}
