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

    // External ID from data-id attribute
    const externalId = card.attr('data-id') ?? '';
    if (!externalId) return;

    // Title and URL from the title link
    const titleEl = card.find(SELECTORS.listingTitle).first();
    const title = titleEl.text().trim();
    const href = titleEl.attr('href') ?? '';
    const fullUrl = href.startsWith('http') ? href : `https://www.bazaraki.com${href}`;

    // Price text
    const priceText = card.find(SELECTORS.listingPrice).first().text().trim();

    // Features (mileage, transmission, fuel) joined as meta text
    const features: string[] = [];
    card.find(SELECTORS.listingFeature).each((_, feat) => {
      const text = $(feat).text().trim();
      if (text) features.push(text);
    });
    const metaText = features.join(' · ');

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
