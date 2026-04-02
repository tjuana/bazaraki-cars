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
  let whatsappUrl = '';

  try {
    // Click the "Call" / phone button and wait for the phone_check response
    const phoneResponsePromise = page.waitForResponse(
      (res) => res.url().includes('phone_check') && res.status() === 200,
      { timeout: 5000 }
    ).catch(() => null);

    const phoneBtn = await page.$(SELECTORS.phoneButton);
    if (phoneBtn) {
      await phoneBtn.click();
      const phoneResponse = await phoneResponsePromise;

      if (phoneResponse) {
        try {
          // The phone_check endpoint may return HTML with a dialog containing the phone
          const body = await phoneResponse.text();
          const telMatch = body.match(/href="tel:([^"]+)"/);
          if (telMatch) {
            phoneRaw = telMatch[1];
          } else {
            // Try JSON format
            try {
              const json = JSON.parse(body);
              phoneRaw = json?.phone ?? json?.phone_number ?? json?.data?.phone ?? '';
            } catch {
              // not JSON — try extracting digits
              const digitMatch = body.match(/(\+?357\d{8})/);
              if (digitMatch) phoneRaw = digitMatch[1];
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      // Fallback: look for tel link in dialog that appeared after click
      if (!phoneRaw) {
        await page.waitForTimeout(1500);
        phoneRaw = await page.$eval(
          SELECTORS.phoneDialog,
          (el) => el.getAttribute('href')?.replace('tel:', '') ?? el.textContent?.trim() ?? ''
        ).catch(() => '');
      }
    }

    // Fallback: any tel: link on the page (skip site phone in header)
    if (!phoneRaw) {
      const telLinks = await page.$$eval('a[href^="tel:"]', (els) =>
        els.map((el) => el.getAttribute('href')?.replace('tel:', '') ?? '').filter(Boolean)
      );
      // The listing phone is usually the last tel link (header phone comes first)
      if (telLinks.length > 0) {
        phoneRaw = telLinks[telLinks.length - 1];
      }
    }

    // Grab WhatsApp link if visible after phone reveal
    whatsappUrl = await page.$eval(
      SELECTORS.whatsappLink,
      (el) => el.getAttribute('href') ?? ''
    ).catch(() => '');
  } catch {
    log.dim(`  Phone not found on ${url}`);
  }

  // ── Parse full page HTML ────────────────────────────────────────────────
  const html = await page.content();
  const $ = cheerio.load(html);

  const title = $(SELECTORS.detailTitle).first().text().trim();

  // Price: prefer meta tag for clean numeric value (e.g. "13300.00")
  const priceMeta = $(SELECTORS.detailPriceMeta).attr('content') ?? '';
  let priceText: string;
  if (priceMeta) {
    // Meta content is like "13300.00" — convert to integer string to avoid parsePrice issues
    const euros = Math.round(parseFloat(priceMeta));
    priceText = isNaN(euros) ? $(SELECTORS.detailPrice).first().text().trim() : String(euros);
  } else {
    priceText = $(SELECTORS.detailPrice).first().text().trim();
  }

  // Description: prefer .js-description (actual text), fall back to container
  let description = $(SELECTORS.detailDescription).first().text().trim();
  if (!description) {
    description = $(SELECTORS.detailDescriptionFallback).first().text().trim();
  }

  // Key/value characteristics (year, mileage, engine, etc.)
  const params: Record<string, string> = {};
  $(SELECTORS.detailCharsList).each((_, el) => {
    const key = $(el).find(SELECTORS.paramKey).text().trim().toLowerCase().replace(/:$/, '');
    const val = $(el).find(SELECTORS.paramValue).text().trim();
    if (key && val) params[key] = val;
  });

  // Seller: on the detail page, check for dealer shop link
  const sellerName = $('.announcement-author__name, .shop-name, .advert__header-name span').first().text().trim();
  const isDealer = $('a.advert__header-logo, a[href^="/c/"]').length > 0;

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
    whatsappUrl,
    sellerName,
    sellerType: isDealer ? 'dealer' : sellerName ? 'private' : 'unknown',
    imageUrls,
  };
}
