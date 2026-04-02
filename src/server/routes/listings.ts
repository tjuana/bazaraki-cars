import { Router } from 'express';
import { getDb, schema } from '../../db/client.js';
import { eq, and, lte, gte, desc, asc, sql } from 'drizzle-orm';
import { generateInitialMessage } from '../../ai/generate-message.js';
import { analyzePhotos } from '../../ai/analyze-photos.js';
import type { Listing } from '../../types/index.js';
import type { AnalysisToolOutput } from '../../ai/tools.js';

export const listingsRouter = Router();

// GET /listings?status=&brand=&maxPrice=&minYear=&sort=risk&limit=50
listingsRouter.get('/', async (req, res) => {
  const db = getDb();
  const { status, brand, maxPrice, minYear, sort = 'id', limit = '100' } = req.query as Record<string, string>;

  const rows = await db
    .select({
      id: schema.listings.id,
      title: schema.listings.title,
      price: schema.listings.price,
      year: schema.listings.year,
      mileage: schema.listings.mileage,
      fuelType: schema.listings.fuelType,
      transmission: schema.listings.transmission,
      brand: schema.listings.brand,
      model: schema.listings.model,
      district: schema.listings.district,
      sellerType: schema.listings.sellerType,
      phoneNormalized: schema.listings.phoneNormalized,
      status: schema.listings.status,
      url: schema.listings.url,
      scrapedAt: schema.listings.scrapedAt,
      riskScore: schema.analyses.riskScore,
      recommendation: schema.analyses.recommendation,
      suggestedOffer: schema.analyses.suggestedOffer,
      overpricePercent: schema.analyses.overpricePercent,
      fairPriceMin: schema.analyses.fairPriceMin,
      fairPriceMax: schema.analyses.fairPriceMax,
    })
    .from(schema.listings)
    .leftJoin(schema.analyses, eq(schema.analyses.listingId, schema.listings.id))
    .where(
      and(
        status ? eq(schema.listings.status, status) : undefined,
        brand ? eq(schema.listings.brand, brand) : undefined,
        maxPrice ? lte(schema.listings.price, Number(maxPrice) * 100) : undefined,
        minYear ? gte(schema.listings.year, Number(minYear)) : undefined,
      )
    )
    .orderBy(
      sort === 'risk' ? asc(sql`coalesce(${schema.analyses.riskScore}, 99)`) :
      sort === 'price' ? asc(schema.listings.price) :
      sort === 'price_desc' ? desc(schema.listings.price) :
      sort === 'mileage' ? asc(schema.listings.mileage) :
      desc(schema.listings.id)
    )
    .limit(Number(limit));

  res.json(rows);
});

// GET /listings/:id
listingsRouter.get('/:id', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  const rows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.id, id))
    .limit(1);

  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const listing = rows[0];

  const analysisRows = await db
    .select()
    .from(schema.analyses)
    .where(eq(schema.analyses.listingId, id))
    .limit(1);

  const callNotesRows = await db
    .select()
    .from(schema.callNotes)
    .where(eq(schema.callNotes.listingId, id))
    .limit(1);

  res.json({
    listing: {
      ...listing,
      imageUrls: JSON.parse(listing.imageUrls ?? '[]'),
    },
    analysis: analysisRows[0]
      ? {
          ...analysisRows[0],
          risks: JSON.parse(analysisRows[0].risks ?? '[]'),
          questionsForSeller: JSON.parse(analysisRows[0].questionsForSeller ?? '[]'),
        }
      : null,
    callNotes: callNotesRows[0]
      ? {
          ...callNotesRows[0],
          checkedQuestions: JSON.parse(callNotesRows[0].checkedQuestions ?? '[]'),
        }
      : null,
  });
});

// PATCH /listings/:id/status
listingsRouter.patch('/:id/status', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { status } = req.body as { status: string };

  await db
    .update(schema.listings)
    .set({ status })
    .where(eq(schema.listings.id, id));

  res.json({ ok: true });
});

// POST /listings/:id/call-notes
listingsRouter.post('/:id/call-notes', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { notes, checkedQuestions, outcome, calledAt } = req.body as {
    notes?: string;
    checkedQuestions?: number[];
    outcome?: string;
    calledAt?: string;
  };

  const now = new Date().toISOString();
  const existing = await db
    .select({ id: schema.callNotes.id })
    .from(schema.callNotes)
    .where(eq(schema.callNotes.listingId, id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.callNotes)
      .set({
        notes: notes ?? '',
        checkedQuestions: JSON.stringify(checkedQuestions ?? []),
        outcome: outcome ?? null,
        calledAt: calledAt ?? null,
        savedAt: now,
      })
      .where(eq(schema.callNotes.listingId, id));
  } else {
    await db.insert(schema.callNotes).values({
      listingId: id,
      notes: notes ?? '',
      checkedQuestions: JSON.stringify(checkedQuestions ?? []),
      outcome: outcome ?? null,
      calledAt: calledAt ?? null,
      savedAt: now,
    });
  }

  // Update listing status if outcome provided
  if (outcome) {
    const statusMap: Record<string, string> = {
      interested: 'negotiating',
      too_expensive: 'negotiating',
      rejected: 'rejected',
    };
    const newStatus = statusMap[outcome];
    if (newStatus) {
      await db.update(schema.listings).set({ status: newStatus }).where(eq(schema.listings.id, id));
    }
  }

  res.json({ ok: true });
});

// POST /listings/:id/whatsapp-message — generate AI message and return wa.me link
listingsRouter.post('/:id/whatsapp-message', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  const rows = await db.select().from(schema.listings).where(eq(schema.listings.id, id)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const row = rows[0];

  const analysisRows = await db.select().from(schema.analyses).where(eq(schema.analyses.listingId, id)).limit(1);

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
    status: (row.status as Listing['status']) ?? 'new',
  };

  let message: string;
  if (analysisRows.length > 0) {
    const a = analysisRows[0];
    const analysis: AnalysisToolOutput = {
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
    message = await generateInitialMessage(listing, analysis);
  } else {
    message = `Hi, I saw your ${row.title} on Bazaraki. Is it still available? Could you share the auction sheet and the exact trim level?`;
  }

  const phone = row.phoneNormalized ?? row.phoneRaw?.replace(/\D/g, '');
  const waBase = (row as Record<string, unknown>)['whatsappUrl'] as string | null
    ?? (phone ? `https://wa.me/${phone}` : null);

  const waLink = waBase
    ? `${waBase.split('?')[0]}?text=${encodeURIComponent(message)}`
    : null;

  await db.insert(schema.conversations).values({
    listingId: id,
    direction: 'outgoing',
    message,
    whatsappLink: waLink,
    createdAt: new Date().toISOString(),
  });

  await db.update(schema.listings).set({ status: 'contacted' }).where(eq(schema.listings.id, id));

  res.json({ message, waLink });
});

// POST /listings/:id/analyze-photos
listingsRouter.post('/:id/analyze-photos', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  const rows = await db
    .select({ imageUrls: schema.listings.imageUrls })
    .from(schema.listings)
    .where(eq(schema.listings.id, id))
    .limit(1);

  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const imageUrls: string[] = JSON.parse(rows[0].imageUrls ?? '[]');
  if (imageUrls.length === 0) return res.status(400).json({ error: 'No photos for this listing' });

  // Proxy URLs through our server so Groq can fetch them (Bazaraki blocks external referers)
  const PORT = process.env.PORT ?? 3001;
  const proxiedUrls = imageUrls.slice(0, 6).map(
    (url) => `http://localhost:${PORT}/proxy/image?url=${encodeURIComponent(url)}`
  );

  try {
    const result = await analyzePhotos(proxiedUrls);
    res.json(result);
  } catch (err) {
    const e = err as Error & { status?: number; error?: { message?: string } };
    const message = e.error?.message ?? e.message ?? 'Unknown error';
    console.error('[analyze-photos]', message);
    res.status(500).json({ error: message });
  }
});
