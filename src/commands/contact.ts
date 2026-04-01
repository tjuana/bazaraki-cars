import { getDb, schema } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { generateInitialMessage } from '../ai/generate-message.js';
import { getInitialTemplate } from '../whatsapp/templates.js';
import { generateWhatsAppLink } from '../whatsapp/link.js';
import type { Listing } from '../types/index.js';
import type { AnalysisToolOutput } from '../ai/tools.js';
import { log } from '../utils/logger.js';
import chalk from 'chalk';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VCF_DIR = join(__dirname, '../../data/contacts');

function saveAndOpenVcf(phone: string, name: string, listingId: number): void {
  mkdirSync(VCF_DIR, { recursive: true });
  const vcf = `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL;TYPE=CELL:+${phone}
NOTE:Bazaraki listing #${listingId}
END:VCARD`;
  const path = join(VCF_DIR, `bazaraki-${listingId}.vcf`);
  writeFileSync(path, vcf);
  log.info(`Контакт сохранён: ${path}`);
  try {
    execSync(`open "${path}"`);
    log.success('Контакт открыт — добавь в Контакты, потом он появится в WhatsApp.');
  } catch {
    log.dim(`Открой вручную: ${path}`);
  }
}

export async function contactCommand(id: string) {
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

  const row = rows[0];

  if (!row.phoneNormalized && !row.phoneRaw) {
    log.warn('No phone number found for this listing.');
    log.dim(`Listing URL: ${row.url}`);
    log.dim('Open the listing manually and contact via Bazaraki messenger.');
    return;
  }

  // Get analysis if available
  const analysisRows = await db
    .select()
    .from(schema.analyses)
    .where(eq(schema.analyses.listingId, listingId))
    .limit(1);

  let message: string;

  if (analysisRows.length > 0) {
    const a = analysisRows[0];
    const analysis = {
      fair_price_min_eur: (a.fairPriceMin ?? 0) / 100,
      fair_price_max_eur: (a.fairPriceMax ?? 0) / 100,
      overprice_percent: a.overpricePercent ?? 0,
      risk_score: a.riskScore ?? 5,
      risks: JSON.parse(a.risks ?? '[]'),
      recommendation: (a.recommendation as AnalysisToolOutput['recommendation']) ?? 'negotiate',
      suggested_offer_eur: (a.suggestedOffer ?? 0) / 100,
      summary: a.summary,
      questions_for_seller: JSON.parse(a.questionsForSeller ?? '[]'),
    };

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
      status: (row.status as Listing['status']) ?? 'analyzed',
    };

    log.info('Generating AI message...');
    message = await generateInitialMessage(listing, analysis);
  } else {
    log.warn('No analysis found — using template. Run `analyze` first for better messages.');
    message = getInitialTemplate({ title: row.title });
  }

  const phone = row.phoneNormalized ?? row.phoneRaw!;
  const contactName = `Bazaraki ${row.title.slice(0, 30)}`;

  // Save contact as .vcf and open it so it gets added to Contacts → WhatsApp Web
  saveAndOpenVcf(phone, contactName, listingId);

  const waLink = generateWhatsAppLink(phone, message);

  log.section('WhatsApp Message');
  console.log(chalk.white.bold('\n' + message + '\n'));
  console.log(chalk.bold('WhatsApp link:'));
  console.log(chalk.cyan(waLink));
  console.log(chalk.dim('\n1. Добавь контакт (окно уже открыто)'));
  console.log(chalk.dim('2. Обнови WhatsApp Web'));
  console.log(chalk.dim('3. Кликни ссылку выше'));

  // Save to conversations
  const now = new Date().toISOString();
  await db.insert(schema.conversations).values({
    listingId,
    direction: 'outgoing',
    message,
    whatsappLink: waLink,
    createdAt: now,
  });

  // Update listing status
  await db
    .update(schema.listings)
    .set({ status: 'contacted' })
    .where(eq(schema.listings.id, listingId));

  log.success('Message saved to conversation history.');
}
