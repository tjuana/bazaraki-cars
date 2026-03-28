import { runScrapePipeline } from '../scraper/scrape-pipeline.js';
import type { DistrictKey } from '../scraper/selectors.js';
import { log } from '../utils/logger.js';

export async function scrapeCommand(opts: { pages?: string; district?: string }) {
  const maxPages = opts.pages ? parseInt(opts.pages, 10) : undefined;
  const district = opts.district as DistrictKey | undefined;

  try {
    await runScrapePipeline({ maxPages, district });
  } catch (err) {
    log.error(`Scrape failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
