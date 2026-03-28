import { getDb, schema } from '../db/client.js';
import { and, lte, gte, eq, like } from 'drizzle-orm';
import Table from 'cli-table3';
import chalk from 'chalk';
import { eurCentsToDisplay } from '../utils/parse-price.js';

const STATUS_COLORS: Record<string, (s: string) => string> = {
  new: chalk.white,
  analyzed: chalk.cyan,
  contacted: chalk.yellow,
  negotiating: chalk.magenta,
  rejected: chalk.red,
  bought: chalk.green,
};

export async function listCommand(opts: {
  status?: string;
  brand?: string;
  maxPrice?: string;
  limit?: string;
}) {
  const db = getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];
  if (opts.status) conditions.push(eq(schema.listings.status, opts.status));
  if (opts.brand) conditions.push(like(schema.listings.brand, `%${opts.brand}%`));
  if (opts.maxPrice) {
    conditions.push(lte(schema.listings.price, parseInt(opts.maxPrice, 10) * 100));
  }

  const rows = await db
    .select()
    .from(schema.listings)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(schema.listings.scrapedAt)
    .limit(opts.limit ? parseInt(opts.limit, 10) : 50);

  if (rows.length === 0) {
    console.log(chalk.dim('No listings found.'));
    return;
  }

  const table = new Table({
    head: ['ID', 'Title', 'Price', 'Year', 'Km', 'Brand', 'Status', 'Phone'].map((h) =>
      chalk.bold(h)
    ),
    colWidths: [5, 38, 10, 6, 8, 12, 12, 14],
    style: { compact: true },
  });

  for (const row of rows) {
    const colorFn = STATUS_COLORS[row.status ?? 'new'] ?? chalk.white;
    table.push([
      String(row.id),
      row.title.slice(0, 36),
      row.price ? eurCentsToDisplay(row.price) : '—',
      row.year ? String(row.year) : '—',
      row.mileage ? `${Math.round(row.mileage / 1000)}k` : '—',
      row.brand ?? '—',
      colorFn(row.status ?? 'new'),
      row.phoneNormalized ? `+${row.phoneNormalized}` : chalk.dim('no phone'),
    ]);
  }

  console.log(table.toString());
  console.log(chalk.dim(`\n${rows.length} listing(s) shown.`));
}
