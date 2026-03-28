import { getDb, schema } from '../db/client.js';
import { eq, count } from 'drizzle-orm';
import chalk from 'chalk';
import Table from 'cli-table3';
import { eurCentsToDisplay } from '../utils/parse-price.js';

export async function dashboardCommand() {
  const db = getDb();

  // Count by status
  const statusCounts = await db
    .select({ status: schema.listings.status, count: count() })
    .from(schema.listings)
    .groupBy(schema.listings.status);

  // Recent listings worth contacting (analyzed, not yet contacted, recommendation ≠ avoid)
  const hotRows = await db
    .select({
      id: schema.listings.id,
      title: schema.listings.title,
      price: schema.listings.price,
      year: schema.listings.year,
      mileage: schema.listings.mileage,
      brand: schema.listings.brand,
      status: schema.listings.status,
      recommendation: schema.analyses.recommendation,
      suggestedOffer: schema.analyses.suggestedOffer,
      riskScore: schema.analyses.riskScore,
    })
    .from(schema.listings)
    .leftJoin(schema.analyses, eq(schema.analyses.listingId, schema.listings.id))
    .where(eq(schema.listings.status, 'analyzed'))
    .orderBy(schema.analyses.riskScore)
    .limit(10);

  // Active negotiations
  const negotiatingRows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.status, 'negotiating'));

  console.log(chalk.bold.white('\n╔══════════════════════════════╗'));
  console.log(chalk.bold.white('║    BAZARAKI CARS DASHBOARD   ║'));
  console.log(chalk.bold.white('╚══════════════════════════════╝\n'));

  // Status summary
  console.log(chalk.bold('Status Summary:'));
  const statusOrder = ['new', 'analyzed', 'contacted', 'negotiating', 'rejected', 'bought'];
  const colors: Record<string, (s: string) => string> = {
    new: chalk.white,
    analyzed: chalk.cyan,
    contacted: chalk.yellow,
    negotiating: chalk.magenta,
    rejected: chalk.red,
    bought: chalk.green,
  };

  for (const s of statusOrder) {
    const found = statusCounts.find((r) => r.status === s);
    if (found && found.count > 0) {
      const colorFn = colors[s] ?? chalk.white;
      console.log(`  ${colorFn(s.padEnd(12))} ${found.count}`);
    }
  }

  // Hot listings
  if (hotRows.length > 0) {
    console.log(chalk.bold('\nReady to Contact (analyzed, not yet reached):'));
    const table = new Table({
      head: ['ID', 'Title', 'Price', 'Offer', 'Risk', 'Rec'].map((h) => chalk.bold(h)),
      colWidths: [5, 36, 10, 10, 6, 12],
      style: { compact: true },
    });

    const recColor: Record<string, (s: string) => string> = {
      strong_buy: chalk.green.bold,
      buy: chalk.green,
      negotiate: chalk.yellow,
      caution: chalk.red,
      avoid: chalk.red.bold,
    };

    for (const r of hotRows) {
      if (r.recommendation === 'avoid') continue;
      table.push([
        String(r.id),
        r.title.slice(0, 34),
        r.price ? eurCentsToDisplay(r.price) : '—',
        r.suggestedOffer ? eurCentsToDisplay(r.suggestedOffer) : '—',
        r.riskScore ? `${r.riskScore}/10` : '—',
        (recColor[r.recommendation ?? ''] ?? chalk.white)(r.recommendation ?? '—'),
      ]);
    }
    console.log(table.toString());
    console.log(chalk.dim('Run: bazaraki-cars contact <id>'));
  }

  // Active negotiations
  if (negotiatingRows.length > 0) {
    console.log(chalk.bold('\nActive Negotiations:'));
    for (const r of negotiatingRows) {
      console.log(
        `  ${chalk.magenta('#' + r.id)} ${r.title.slice(0, 45)} — ${r.price ? eurCentsToDisplay(r.price) : '?'}`
      );
      console.log(chalk.dim(`         bazaraki-cars reply ${r.id}`));
    }
  }

  console.log();
}
