import { chromium, type Browser, type BrowserContext } from 'playwright';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_PATH = join(__dirname, '../../data/cookies.json');
const DATA_DIR = join(__dirname, '../../data');

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

export async function getBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  if (_browser && _context) return { browser: _browser, context: _context };

  mkdirSync(DATA_DIR, { recursive: true });

  _browser = await chromium.launch({
    headless: false, // headed mode bypasses Cloudflare detection
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
    ],
    slowMo: 50,
  });

  const storageState = existsSync(COOKIES_PATH)
    ? JSON.parse(readFileSync(COOKIES_PATH, 'utf-8'))
    : undefined;

  _context = await _browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'Asia/Nicosia',
    storageState,
  });

  // Remove webdriver fingerprint
  await _context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });

  if (storageState) {
    log.dim('Loaded saved cookies.');
  } else {
    log.warn('No saved cookies — browser will open. If you see a CAPTCHA, solve it manually.');
  }

  return { browser: _browser, context: _context };
}

export async function saveCookies(): Promise<void> {
  if (!_context) return;
  const state = await _context.storageState();
  writeFileSync(COOKIES_PATH, JSON.stringify(state, null, 2));
  log.dim('Cookies saved to data/cookies.json');
}

export async function closeBrowser(): Promise<void> {
  await saveCookies();
  await _context?.close();
  await _browser?.close();
  _context = null;
  _browser = null;
}
