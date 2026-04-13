import { Router } from 'express';
import { getDb, schema } from '../../db/client.js';
import { eq, and, lte, gte, desc, asc, sql, count } from 'drizzle-orm';
import { generateInitialMessage } from '../../ai/generate-message.js';
import { generateFollowUp } from '../../ai/analyze-reply.js';
import { analyzePhotos } from '../../ai/analyze-photos.js';
import type { Listing, Conversation } from '../../types/index.js';
import type { AnalysisToolOutput } from '../../ai/tools.js';

export const listingsRouter = Router();

type ListingRow = typeof schema.listings.$inferSelect;
type AnalysisRow = typeof schema.analyses.$inferSelect;

function rowToListing(row: ListingRow): Listing {
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

function rowToAnalysis(a: AnalysisRow): AnalysisToolOutput {
  return {
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
}

// GET /listings?status=&brand=&maxPrice=&minYear=&sort=risk&limit=25&offset=0
listingsRouter.get('/', async (req, res) => {
  const db = getDb();
  const {
    status, brand, maxPrice, minYear,
    sort = 'id',
    limit = '25',
    offset = '0',
  } = req.query as Record<string, string>;

  const where = and(
    status ? eq(schema.listings.status, status) : undefined,
    brand ? eq(schema.listings.brand, brand) : undefined,
    maxPrice ? lte(schema.listings.price, Number(maxPrice) * 100) : undefined,
    minYear ? gte(schema.listings.year, Number(minYear)) : undefined,
  );

  const orderBy =
    sort === 'risk'          ? asc(sql`coalesce(${schema.analyses.riskScore}, 99)`) :
    sort === 'price'         ? asc(schema.listings.price) :
    sort === 'price_desc'    ? desc(schema.listings.price) :
    sort === 'mileage'       ? asc(schema.listings.mileage) :
    sort === 'mileage_desc'  ? desc(schema.listings.mileage) :
    sort === 'year'          ? desc(schema.listings.year) :
    sort === 'year_asc'      ? asc(schema.listings.year) :
    sort === 'overprice'     ? asc(schema.analyses.overpricePercent) :
    sort === 'overprice_desc'? desc(schema.analyses.overpricePercent) :
    desc(schema.listings.id);

  const selectFields = {
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
  };

  const [rows, totalRows] = await Promise.all([
    db.select(selectFields)
      .from(schema.listings)
      .leftJoin(schema.analyses, eq(schema.analyses.listingId, schema.listings.id))
      .where(where)
      .orderBy(orderBy)
      .limit(Number(limit))
      .offset(Number(offset)),
    db.select({ total: count() })
      .from(schema.listings)
      .leftJoin(schema.analyses, eq(schema.analyses.listingId, schema.listings.id))
      .where(where),
  ]);

  res.json({ rows, total: totalRows[0].total });
});

// GET /listings/brands
listingsRouter.get('/brands', async (_req, res) => {
  const db = getDb();
  const rows = await db
    .selectDistinct({ brand: schema.listings.brand })
    .from(schema.listings)
    .where(sql`${schema.listings.brand} is not null`)
    .orderBy(asc(schema.listings.brand));
  res.json(rows.map((r) => r.brand as string));
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

  const priceHistoryRows = await db
    .select()
    .from(schema.priceHistory)
    .where(eq(schema.priceHistory.listingId, id))
    .orderBy(schema.priceHistory.changedAt);

  const conversationRows = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.listingId, id))
    .orderBy(schema.conversations.createdAt);

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
    priceHistory: priceHistoryRows,
    conversations: conversationRows,
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

  const listing = rowToListing(row);

  let message: string;
  if (analysisRows.length > 0) {
    message = await generateInitialMessage(listing, rowToAnalysis(analysisRows[0]));
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

// POST /listings/:id/reply — paste seller reply, get AI follow-up
listingsRouter.post('/:id/reply', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { sellerMessage } = req.body as { sellerMessage: string };

  if (!sellerMessage?.trim()) return res.status(400).json({ error: 'sellerMessage is required' });

  const rows = await db.select().from(schema.listings).where(eq(schema.listings.id, id)).limit(1);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const row = rows[0];

  // Save seller's message
  await db.insert(schema.conversations).values({
    listingId: id,
    direction: 'incoming',
    message: sellerMessage.trim(),
    createdAt: new Date().toISOString(),
  });

  // Load analysis
  const analysisRows = await db.select().from(schema.analyses).where(eq(schema.analyses.listingId, id)).limit(1);

  // Load conversation history
  const history: Conversation[] = (await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.listingId, id))
    .orderBy(schema.conversations.createdAt)
  ).map((c) => ({
    ...c,
    direction: c.direction as 'incoming' | 'outgoing',
  }));

  const listing = rowToListing(row);

  let reply: string;
  if (analysisRows.length > 0) {
    reply = await generateFollowUp(listing, rowToAnalysis(analysisRows[0]), history, sellerMessage.trim());
  } else {
    reply = `Thanks for the info! Is the car still available for viewing? I'm in the area and could come take a look.`;
  }

  // Save our reply
  const phone = row.phoneNormalized ?? row.phoneRaw?.replace(/\D/g, '');
  const waBase = (row as Record<string, unknown>)['whatsappUrl'] as string | null
    ?? (phone ? `https://wa.me/${phone}` : null);
  const waLink = waBase
    ? `${waBase.split('?')[0]}?text=${encodeURIComponent(reply)}`
    : null;

  await db.insert(schema.conversations).values({
    listingId: id,
    direction: 'outgoing',
    message: reply,
    whatsappLink: waLink,
    createdAt: new Date().toISOString(),
  });

  await db.update(schema.listings).set({ status: 'negotiating' }).where(eq(schema.listings.id, id));

  res.json({ reply, waLink });
});

// GET /listings/:id/photo-analysis — return cached result
listingsRouter.get('/:id/photo-analysis', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);

  const rows = await db
    .select()
    .from(schema.photoAnalyses)
    .where(eq(schema.photoAnalyses.listingId, id))
    .limit(1);

  if (rows.length === 0) return res.json(null);

  const row = rows[0];
  res.json({
    overallCondition: row.overallCondition,
    issues: JSON.parse(row.issues ?? '[]'),
    positives: JSON.parse(row.positives ?? '[]'),
    accidentSuspicion: row.accidentSuspicion,
    summary: row.summary,
    auctionSheet: row.auctionSheet ? JSON.parse(row.auctionSheet) : null,
    analyzedAt: row.analyzedAt,
  });
});

// POST /listings/:id/analyze-photos
listingsRouter.post('/:id/analyze-photos', async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const force = req.query.force === '1';

  // Return cached result if exists (unless force refresh)
  if (!force) {
    const cached = await db
      .select()
      .from(schema.photoAnalyses)
      .where(eq(schema.photoAnalyses.listingId, id))
      .limit(1);

    if (cached.length > 0) {
      const row = cached[0];
      return res.json({
        overallCondition: row.overallCondition,
        issues: JSON.parse(row.issues ?? '[]'),
        positives: JSON.parse(row.positives ?? '[]'),
        accidentSuspicion: row.accidentSuspicion,
        summary: row.summary,
        auctionSheet: row.auctionSheet ? JSON.parse(row.auctionSheet) : null,
        cached: true,
      });
    }
  }

  const rows = await db
    .select({ imageUrls: schema.listings.imageUrls })
    .from(schema.listings)
    .where(eq(schema.listings.id, id))
    .limit(1);

  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const imageUrls: string[] = JSON.parse(rows[0].imageUrls ?? '[]');
  if (imageUrls.length === 0) return res.status(400).json({ error: 'No photos for this listing' });

  // Fetch images server-side and convert to base64 data URLs
  // (Groq can't access localhost or Bazaraki directly)
  const dataUrls: string[] = [];
  for (const url of imageUrls) {
    try {
      const imgRes = await fetch(url, {
        headers: {
          'Referer': 'https://www.bazaraki.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      if (!imgRes.ok) continue;
      const buffer = await imgRes.arrayBuffer();
      const mime = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const b64 = Buffer.from(buffer).toString('base64');
      dataUrls.push(`data:${mime};base64,${b64}`);
    } catch { /* skip failed images */ }
  }

  if (dataUrls.length === 0) {
    return res.status(400).json({ error: 'Could not fetch any photos from Bazaraki' });
  }

  try {
    const result = await analyzePhotos(dataUrls);

    // Save to DB (upsert)
    const now = new Date().toISOString();
    const record = {
      listingId: id,
      overallCondition: result.overallCondition,
      issues: JSON.stringify(result.issues),
      positives: JSON.stringify(result.positives),
      accidentSuspicion: result.accidentSuspicion,
      summary: result.summary,
      auctionSheet: result.auctionSheet ? JSON.stringify(result.auctionSheet) : null,
      analyzedAt: now,
    };

    await db.insert(schema.photoAnalyses)
      .values(record)
      .onConflictDoUpdate({
        target: schema.photoAnalyses.listingId,
        set: record,
      });

    res.json({ ...result, cached: false });
  } catch (err) {
    const e = err as Error & { status?: number; error?: { message?: string } };
    const message = e.error?.message ?? e.message ?? 'Unknown error';
    console.error('[analyze-photos]', message);
    res.status(500).json({ error: message });
  }
});
