import { getDb, schema } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { analyzeListing } from '../ai/analyze-listing.js';
import type { Listing } from '../types/index.js';
import { log } from '../utils/logger.js';
import chalk from 'chalk';

function toListing(row: typeof schema.listings.$inferSelect): Listing {
  return {
    ...row,
    price: row.price ?? null,
    year: row.year ?? null,
    mileage: row.mileage ?? null,
    engineSize: row.engineSize ?? null,
    fuelType: row.fuelType ?? null,
    transmission: row.transmission ?? null,
    bodyType: row.bodyType ?? null,
    color: row.color ?? null,
    brand: row.brand ?? null,
    model: row.model ?? null,
    description: row.description ?? null,
    phoneRaw: row.phoneRaw ?? null,
    phoneNormalized: row.phoneNormalized ?? null,
    sellerName: row.sellerName ?? null,
    sellerType: (row.sellerType as Listing['sellerType']) ?? 'unknown',
    district: row.district ?? null,
    imageUrls: JSON.parse(row.imageUrls ?? '[]'),
    source: (row.source as Listing['source']) ?? 'bazaraki',
    status: (row.status as Listing['status']) ?? 'new',
  };
}

export async function analyzeCommand(id: string) {
  const db = getDb();
  const listingId = parseInt(id, 10);

  const rows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.id, listingId))
    .limit(1);

  if (rows.length === 0) {
    log.error(`Listing #${id} not found.`);
    process.exit(1);
  }

  const listing = toListing(rows[0]);
  log.info(`Analyzing: ${listing.title}`);

  const analysis = await analyzeListing(listing);

  // Save to DB
  const now = new Date().toISOString();
  await db.insert(schema.analyses).values({
    listingId,
    fairPriceMin: Math.round(analysis.fair_price_min_eur * 100),
    fairPriceMax: Math.round(analysis.fair_price_max_eur * 100),
    overpricePercent: Math.round(analysis.overprice_percent),
    riskScore: analysis.risk_score,
    risks: JSON.stringify(analysis.risks),
    recommendation: analysis.recommendation,
    suggestedOffer: Math.round(analysis.suggested_offer_eur * 100),
    summary: analysis.summary,
    questionsForSeller: JSON.stringify(analysis.questions_for_seller),
    rawResponse: JSON.stringify(analysis),
    analyzedAt: now,
  });

  // Update listing status
  await db
    .update(schema.listings)
    .set({ status: 'analyzed' })
    .where(eq(schema.listings.id, listingId));

  // Display results
  const recColors: Record<string, (s: string) => string> = {
    strong_buy: chalk.green.bold,
    buy: chalk.green,
    negotiate: chalk.yellow,
    caution: chalk.red,
    avoid: chalk.red.bold,
  };

  log.section('Analysis Result');
  console.log(`  Recommendation: ${(recColors[analysis.recommendation] ?? chalk.white)(analysis.recommendation.toUpperCase())}`);
  console.log(`  Fair value:     €${analysis.fair_price_min_eur.toLocaleString()} – €${analysis.fair_price_max_eur.toLocaleString()}`);
  console.log(`  Overprice:      ${analysis.overprice_percent > 0 ? chalk.red(`+${analysis.overprice_percent}%`) : chalk.green(`${analysis.overprice_percent}%`)}`);
  console.log(`  Risk score:     ${analysis.risk_score}/10`);
  console.log(`  Suggested offer: ${chalk.cyan(`€${analysis.suggested_offer_eur.toLocaleString()}`)}`);
  console.log();
  console.log(`  ${chalk.bold('Summary:')} ${analysis.summary}`);
  console.log();

  if (analysis.risks.length > 0) {
    console.log(chalk.bold('  Risks:'));
    for (const risk of analysis.risks) {
      console.log(`    ${chalk.red('•')} ${risk}`);
    }
  }

  if (analysis.questions_for_seller.length > 0) {
    console.log(chalk.bold('\n  Ask the seller:'));
    for (const q of analysis.questions_for_seller) {
      console.log(`    ${chalk.yellow('?')} ${q}`);
    }
  }
}

export async function analyzeAllCommand() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.status, 'new'));

  log.info(`Found ${rows.length} un-analyzed listings`);

  for (const row of rows) {
    try {
      await analyzeCommand(String(row.id));
    } catch (err) {
      log.error(`Failed to analyze #${row.id}: ${(err as Error).message}`);
    }
  }
}
