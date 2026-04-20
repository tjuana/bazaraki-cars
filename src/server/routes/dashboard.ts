import { Router } from 'express';
import { getDb, schema } from '../../db/client.js';
import { eq, count, and, lte, isNotNull, sql } from 'drizzle-orm';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (_req, res) => {
  const db = getDb();

  const [statusCounts, hotDeals, recentlyAnalyzed, riskRows, priceChanges, expirations] = await Promise.all([
    db.select({ status: schema.listings.status, count: count() })
      .from(schema.listings)
      .groupBy(schema.listings.status),

    db.select({
      id: schema.listings.id,
      title: schema.listings.title,
      price: schema.listings.price,
      year: schema.listings.year,
      mileage: schema.listings.mileage,
      fuelType: schema.listings.fuelType,
      district: schema.listings.district,
      phoneNormalized: schema.listings.phoneNormalized,
      status: schema.listings.status,
      url: schema.listings.url,
      riskScore: schema.analyses.riskScore,
      recommendation: schema.analyses.recommendation,
      suggestedOffer: schema.analyses.suggestedOffer,
      overpricePercent: schema.analyses.overpricePercent,
      fairPriceMin: schema.analyses.fairPriceMin,
      fairPriceMax: schema.analyses.fairPriceMax,
      summary: schema.analyses.summary,
    })
      .from(schema.listings)
      .leftJoin(schema.analyses, eq(schema.analyses.listingId, schema.listings.id))
      .where(
        and(
          eq(schema.listings.status, 'analyzed'),
          lte(schema.analyses.riskScore, 4),
        )
      )
      .orderBy(schema.analyses.riskScore)
      .limit(10),

    db.select({
      id: schema.listings.id,
      title: schema.listings.title,
      status: schema.listings.status,
      riskScore: schema.analyses.riskScore,
      recommendation: schema.analyses.recommendation,
      analyzedAt: schema.analyses.analyzedAt,
    })
      .from(schema.listings)
      .leftJoin(schema.analyses, eq(schema.analyses.listingId, schema.listings.id))
      .where(eq(schema.listings.status, 'analyzed'))
      .orderBy(schema.analyses.analyzedAt)
      .limit(5),

    db.select({ score: schema.analyses.riskScore, count: count() })
      .from(schema.analyses)
      .where(isNotNull(schema.analyses.riskScore))
      .groupBy(schema.analyses.riskScore),

    db.select({
      date: sql<string>`date(${schema.priceHistory.changedAt})`.as('date'),
      count: count(),
    })
      .from(schema.priceHistory)
      .where(sql`${schema.priceHistory.changedAt} >= date('now', '-30 days')`)
      .groupBy(sql`date(${schema.priceHistory.changedAt})`),

    db.select({
      date: sql<string>`date(${schema.listings.scrapedAt})`.as('date'),
      count: count(),
    })
      .from(schema.listings)
      .where(and(
        eq(schema.listings.status, 'expired'),
        sql`${schema.listings.scrapedAt} >= date('now', '-30 days')`,
      ))
      .groupBy(sql`date(${schema.listings.scrapedAt})`),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.count]));
  const total = statusCounts.reduce((s, r) => s + r.count, 0);
  const riskDistribution = Object.fromEntries(riskRows.map((r) => [r.score!, r.count]));

  res.json({
    total,
    byStatus,
    hotDeals,
    recentlyAnalyzed,
    riskDistribution,
    priceChanges,
    expirations,
  });
});
