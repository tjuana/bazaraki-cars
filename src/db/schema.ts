import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const listings = sqliteTable('listings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  externalId: text('external_id').notNull().unique(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  price: integer('price'),                   // EUR cents
  currency: text('currency').default('EUR'),
  year: integer('year'),
  mileage: integer('mileage'),               // km
  engineSize: real('engine_size'),
  fuelType: text('fuel_type'),
  transmission: text('transmission'),
  bodyType: text('body_type'),
  color: text('color'),
  brand: text('brand'),
  model: text('model'),
  description: text('description'),
  phoneRaw: text('phone_raw'),
  phoneNormalized: text('phone_normalized'),
  sellerName: text('seller_name'),
  sellerType: text('seller_type').default('unknown'),
  district: text('district'),
  imageUrls: text('image_urls').default('[]'),   // JSON array
  scrapedAt: text('scraped_at').notNull(),
  source: text('source').notNull().default('bazaraki'),
  status: text('status').notNull().default('new'),
});

export const analyses = sqliteTable('analyses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id),
  fairPriceMin: integer('fair_price_min'),
  fairPriceMax: integer('fair_price_max'),
  overpricePercent: integer('overprice_percent'),
  riskScore: integer('risk_score'),
  risks: text('risks').default('[]'),            // JSON array
  recommendation: text('recommendation'),
  suggestedOffer: integer('suggested_offer'),
  summary: text('summary').notNull(),
  questionsForSeller: text('questions_for_seller').default('[]'), // JSON array
  rawResponse: text('raw_response'),
  analyzedAt: text('analyzed_at').notNull(),
});

export const conversations = sqliteTable('conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id),
  direction: text('direction').notNull(),        // outgoing | incoming
  message: text('message').notNull(),
  whatsappLink: text('whatsapp_link'),
  createdAt: text('created_at').notNull(),
});

export const callNotes = sqliteTable('call_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listingId: integer('listing_id')
    .notNull()
    .references(() => listings.id),
  notes: text('notes').default(''),
  checkedQuestions: text('checked_questions').default('[]'), // JSON array of checked indices
  calledAt: text('called_at'),
  outcome: text('outcome'),                      // interested | too_expensive | not_responding | rejected
  savedAt: text('saved_at').notNull(),
});

export const configs = sqliteTable('configs', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),                // JSON value
  updatedAt: text('updated_at').notNull(),
});
