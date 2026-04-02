import { Router } from 'express';
import { getDb, schema } from '../../db/client.js';
import { eq } from 'drizzle-orm';
import { analyzeListing } from '../../ai/analyze-listing.js';
import type { Listing } from '../../types/index.js';

export const analyzeRouter = Router();

function toListingType(row: typeof schema.listings.$inferSelect): Listing {
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

async function runAnalyze(id: number): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();

  const rows = await db.select().from(schema.listings).where(eq(schema.listings.id, id)).limit(1);
  if (rows.length === 0) return { ok: false, error: 'Not found' };

  const listing = toListingType(rows[0]);
  const analysis = await analyzeListing(listing);
  const now = new Date().toISOString();

  // Upsert
  const existing = await db
    .select({ id: schema.analyses.id })
    .from(schema.analyses)
    .where(eq(schema.analyses.listingId, id))
    .limit(1);

  const values = {
    listingId: id,
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
  };

  if (existing.length > 0) {
    await db.update(schema.analyses).set(values).where(eq(schema.analyses.listingId, id));
  } else {
    await db.insert(schema.analyses).values(values);
  }

  await db.update(schema.listings).set({ status: 'analyzed' }).where(eq(schema.listings.id, id));

  return { ok: true };
}

// POST /analyze/all  — must be before /:id to avoid being caught as id="all"
analyzeRouter.post('/all', async (_req, res) => {
  const db = getDb();
  const rows = await db
    .select({ id: schema.listings.id })
    .from(schema.listings)
    .where(eq(schema.listings.status, 'new'));

  // Fire and forget — return immediately with count
  const total = rows.length;
  res.json({ ok: true, queued: total });

  // Run in background
  (async () => {
    for (const row of rows) {
      try {
        await runAnalyze(row.id);
        await new Promise((r) => setTimeout(r, 2000));
      } catch {
        // continue on error
      }
    }
  })();
});

// POST /analyze/:id  — after /all to avoid route conflict
analyzeRouter.post('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await runAnalyze(id);
    if (!result.ok) return res.status(404).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
