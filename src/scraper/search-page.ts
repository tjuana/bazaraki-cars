import type { Page } from 'playwright';
import * as cheerio from 'cheerio';
import { SELECTORS } from './selectors.js';
import type { RawListingCard } from '../types/index.js';

export async function parseSearchPage(page: Page): Promise<RawListingCard[]> {
  await page.waitForLoadState('domcontentloaded');

  // Brief wait to let dynamic content settle
  await page.waitForTimeout(1500);

  const html = await page.content();
  const $ = cheerio.load(html);

  const cards: RawListingCard[] = [];

  $(SELECTORS.listingCard).each((_, el) => {
    const card = $(el);

    const linkEl = card.find(SELECTORS.listingLink).first();
    const href = linkEl.attr('href') ?? '';
    const fullUrl = href.startsWith('http') ? href : `https://www.bazaraki.com${href}`;

    // Extract external ID from URL path: /adv/12345678_.../ or /adv/12345678/
    const idMatch = fullUrl.match(/\/adv\/(\d+)/);
    if (!idMatch) return;

    const externalId = idMatch[1];
    const title = card.find(SELECTORS.listingTitle).text().trim();
    const priceText = card.find(SELECTORS.listingPrice).text().trim();
    const metaText = card.find(SELECTORS.listingMeta).text().trim();

    if (!externalId || !title) return;

    cards.push({ externalId, url: fullUrl, title, priceText, metaText });
  });

  return cards;
}

/**
 * Check if there's a next page link.
 */
export async function hasNextPage(page: Page): Promise<boolean> {
  const html = await page.content();
  const $ = cheerio.load(html);
  return $(SELECTORS.nextPageLink).length > 0;
}
