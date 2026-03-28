/**
 * Parse mileage text into km integer.
 * Handles: "85,000 km", "85 000 km", "85000km", "85.000 km", "miles"
 */
export function parseMileage(text: string): number | null {
  if (!text) return null;
  const lc = text.toLowerCase();

  const hasMiles = lc.includes('mile');
  const clean = lc.replace(/[km\smiles]/g, '').replace(/[,.]/g, '');
  const num = parseInt(clean, 10);
  if (isNaN(num) || num <= 0) return null;

  // Convert miles → km if needed
  return hasMiles ? Math.round(num * 1.60934) : num;
}

/**
 * Sanity-check mileage for a given year.
 * Average in Cyprus ~15,000 km/year.
 * Returns true if mileage seems plausible.
 */
export function isMileageSane(mileage: number, year: number): boolean {
  const age = new Date().getFullYear() - year;
  if (age <= 0) return mileage < 30000;
  const avgPerYear = mileage / age;
  // Flag if avg > 40k/year (suspiciously high) or < 2k/year (suspiciously low for old car)
  return avgPerYear >= 2000 && avgPerYear <= 40000;
}
