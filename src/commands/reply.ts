import { getDb, schema } from '../db/client.js';
import { eq, asc } from 'drizzle-orm';
import { generateFollowUp } from '../ai/analyze-reply.js';
import { generateWhatsAppLink } from '../whatsapp/link.js';
import type { Listing, Conversation } from '../types/index.js';
import type { AnalysisToolOutput } from '../ai/tools.js';
import { log } from '../utils/logger.js';
import chalk from 'chalk';

export async function replyCommand(id: string) {
  const db = getDb();
  const listingId = parseInt(id, 10);

  // Load listing
  const listingRows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.id, listingId))
    .limit(1);

  if (listingRows.length === 0) {
    log.error(`Listing #${id} not found.`);
    process.exit(1);
  }

  const row = listingRows[0];

  if (!row.phoneNormalized && !row.phoneRaw) {
    log.error('No phone number for this listing — cannot generate WhatsApp link.');
    process.exit(1);
  }

  // Load analysis
  const analysisRows = await db
    .select()
    .from(schema.analyses)
    .where(eq(schema.analyses.listingId, listingId))
    .limit(1);

  if (analysisRows.length === 0) {
    log.warn('No analysis found. Run `analyze` first for context-aware replies.');
  }

  // Load conversation history
  const historyRows = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.listingId, listingId))
    .orderBy(asc(schema.conversations.createdAt));

  // Show conversation history
  log.section(`Conversation — ${row.title}`);
  for (const msg of historyRows) {
    const prefix = msg.direction === 'outgoing' ? chalk.cyan('YOU  ') : chalk.yellow('SELLER');
    console.log(`${prefix}: ${msg.message}`);
    console.log();
  }

  // Prompt for seller's reply
  const { input } = await import('@inquirer/prompts');
  const sellerReply = await input({
    message: chalk.yellow('Paste seller\'s reply (or press Enter to skip):'),
  });

  if (!sellerReply.trim()) {
    log.dim('No reply entered. Exiting.');
    return;
  }

  // Save seller's reply
  const now = new Date().toISOString();
  await db.insert(schema.conversations).values({
    listingId,
    direction: 'incoming',
    message: sellerReply.trim(),
    whatsappLink: null,
    createdAt: now,
  });

  // Build objects for AI
  const listing: Listing = {
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
    status: (row.status as Listing['status']) ?? 'contacted',
  };

  const a = analysisRows[0];
  const analysis = a
    ? {
        fair_price_min_eur: (a.fairPriceMin ?? 0) / 100,
        fair_price_max_eur: (a.fairPriceMax ?? 0) / 100,
        overprice_percent: a.overpricePercent ?? 0,
        risk_score: a.riskScore ?? 5,
        risks: JSON.parse(a.risks ?? '[]') as string[],
        recommendation: (a.recommendation as AnalysisToolOutput['recommendation']) ?? 'negotiate',
        suggested_offer_eur: (a.suggestedOffer ?? 0) / 100,
        summary: a.summary,
        questions_for_seller: JSON.parse(a.questionsForSeller ?? '[]') as string[],
      }
    : {
        fair_price_min_eur: 0,
        fair_price_max_eur: 0,
        overprice_percent: 0,
        risk_score: 5,
        risks: [] as string[],
        recommendation: 'negotiate' as AnalysisToolOutput['recommendation'],
        suggested_offer_eur: listing.price ? (listing.price / 100) * 0.85 : 0,
        summary: '',
        questions_for_seller: [] as string[],
      };

  const history: Conversation[] = historyRows.map((h) => ({
    id: h.id,
    listingId: h.listingId,
    direction: h.direction as Conversation['direction'],
    message: h.message,
    whatsappLink: h.whatsappLink ?? null,
    createdAt: h.createdAt,
  }));

  log.info('Generating follow-up...');
  const suggested = await generateFollowUp(listing, analysis, history, sellerReply.trim());

  const phone = row.phoneNormalized ?? row.phoneRaw!;
  const waLink = generateWhatsAppLink(phone, suggested);

  log.section('Suggested Reply');
  console.log(chalk.white.bold('\n' + suggested + '\n'));
  console.log(chalk.bold('WhatsApp link:'));
  console.log(chalk.cyan(waLink));

  // Save outgoing follow-up
  const now2 = new Date().toISOString();
  await db.insert(schema.conversations).values({
    listingId,
    direction: 'outgoing',
    message: suggested,
    whatsappLink: waLink,
    createdAt: now2,
  });

  // Update status to negotiating
  await db
    .update(schema.listings)
    .set({ status: 'negotiating' })
    .where(eq(schema.listings.id, listingId));

  log.success('Conversation updated.');
}
