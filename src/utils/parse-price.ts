/**
 * Parse price text from Bazaraki into EUR cents.
 * Handles: "€12,500", "12 500 €", "12.500", "12500 EUR", "POA", "---"
 */
export function parsePrice(text: string): number | null {
  if (!text) return null;
  const clean = text.replace(/[€$£EUReur\s]/g, '').replace(/,/g, '').replace(/\./g, '');
  const num = parseInt(clean, 10);
  if (isNaN(num) || num <= 0) return null;
  return num * 100; // store as cents
}

export function eurCentsToDisplay(cents: number): string {
  return `€${(cents / 100).toLocaleString('en-US')}`;
}
