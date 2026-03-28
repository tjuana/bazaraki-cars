import type { Page } from 'playwright';
import * as cheerio from 'cheerio';
import { SELECTORS } from './selectors.js';
import type { RawListingDetail } from '../types/index.js';
import { log } from '../utils/logger.js';

export async function parseListingPage(page: Page, url: string): Promise<RawListingDetail> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // ── Try to reveal phone number ───────────────────────────────────────────
  let phoneRaw = '';

  try {
    // Method 1: click the "show phone" button and intercept the response
    const phoneResponsePromise = page.waitForResponse(
      (res) => res.url().includes('phone') && res.status() === 200,
      { timeout: 4000 }
    ).catch(() => null);

    const phoneBtn = await page.$(SELECTORS.phoneButton);
    if (phoneBtn) {
      await phoneBtn.click();
      const phoneResponse = await phoneResponsePromise;

      if (phoneResponse) {
        try {
          const json = await phoneResponse.json();
          phoneRaw = json?.phone ?? json?.phone_number ?? json?.data?.phone ?? '';
        } catch {
          // not JSON
        }
      }

      // Method 2: read from DOM after click
      if (!phoneRaw) {
        await page.waitForTimeout(1500);
        phoneRaw = await page.$eval(
          SELECTORS.phoneNumber,
          (el) => el.textContent?.trim() ?? ''
        ).catch(() => '');
      }
    }
  } catch {
    log.dim(`  Phone not found on ${url}`);
  }

  // ── Parse full page HTML ────────────────────────────────────────────────
  const html = await page.content();
  const $ = cheerio.load(html);

  const title = $(SELECTORS.detailTitle).first().text().trim();
  const priceText = $(SELECTORS.detailPrice).first().text().trim();
  const description = $(SELECTORS.detailDescription).first().text().trim();

  // Key/value characteristics (year, mileage, engine, etc.)
  const params: Record<string, string> = {};
  $(SELECTORS.detailParams).each((_, el) => {
    const key = $(el).find(SELECTORS.paramKey).text().trim().toLowerCase();
    const val = $(el).find(SELECTORS.paramValue).text().trim();
    if (key && val) params[key] = val;
  });

  const sellerName = $(SELECTORS.sellerName).first().text().trim();
  const isDealer = $(SELECTORS.sellerTypeDealer).length > 0;

  const imageUrls: string[] = [];
  $(SELECTORS.imageGallery).each((_, img) => {
    const src = $(img).attr('src') ?? $(img).attr('data-src') ?? '';
    if (src && !src.includes('placeholder') && !imageUrls.includes(src)) {
      imageUrls.push(src);
    }
  });

  return {
    title,
    priceText,
    description,
    params,
    phoneRaw,
    sellerName,
    sellerType: isDealer ? 'dealer' : sellerName ? 'private' : 'unknown',
    imageUrls,
  };
}
