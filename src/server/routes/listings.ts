import { Router } from 'express';
import { getDb, schema } from '../../db/client.js';
import { eq, and, lte, gte, desc, asc, sql } from 'drizzle-orm';

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
