import { Router } from 'express';
import { runScrapePipeline } from '../../scraper/scrape-pipeline.js';

export const scrapeRouter = Router();

let scraping = false;
let lastResult: { saved: number; skipped: number; failed: number; finishedAt: string } | null = null;

// GET /scrape/status
scrapeRouter.get('/status', (_req, res) => {
  res.json({ scraping, lastResult });
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
