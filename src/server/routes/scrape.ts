import { Router } from 'express';
import { runScrapePipeline } from '../../scraper/scrape-pipeline.js';
import { runRefreshPipeline, type RefreshResult } from '../../scraper/refresh-pipeline.js';

export const scrapeRouter = Router();

let scraping = false;
let lastResult: { saved: number; skipped: number; failed: number; finishedAt: string } | null = null;

let refreshing = false;
let lastRefreshResult: (RefreshResult & { finishedAt: string }) | null = null;

// GET /scrape/status
scrapeRouter.get('/status', (_req, res) => {
  res.json({ scraping, lastResult, refreshing, lastRefreshResult });
});

// POST /scrape/refresh
scrapeRouter.post('/refresh', async (_req, res) => {
  if (refreshing) return res.status(409).json({ error: 'Refresh already running' });
  if (scraping) return res.status(409).json({ error: 'Scrape is running, wait for it to finish' });

  refreshing = true;
  res.json({ ok: true, message: 'Refresh started' });

  (async () => {
    try {
      const result = await runRefreshPipeline();
      lastRefreshResult = { ...result, finishedAt: new Date().toISOString() };
    } catch (err) {
      console.error('Refresh error:', (err as Error).message);
    } finally {
      refreshing = false;
    }
  })();
});

// POST /scrape
scrapeRouter.post('/', async (req, res) => {
  if (scraping) {
    return res.status(409).json({ error: 'Scrape already running' });
  }

  const { pages } = req.body as { pages?: number };
  scraping = true;

  res.json({ ok: true, message: 'Scrape started' });

  // Run in background
  (async () => {
    try {
      await runScrapePipeline({ maxPages: pages ?? 5 });
      lastResult = {
        saved: 0, skipped: 0, failed: 0,
        finishedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('Scrape error:', (err as Error).message);
    } finally {
      scraping = false;
    }
  })();
});
