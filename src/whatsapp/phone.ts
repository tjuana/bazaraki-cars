/**
 * Normalize Cyprus phone numbers to wa.me format (no +, no spaces).
 * Cyprus country code: +357
 * Mobile: 9XXXXXXX or 7XXXXXXX (8 digits)
 * Fixed: 2XXXXXXX (8 digits)
 */
export function normalizeCyprusPhone(raw: string): string | null {
  if (!raw) return null;

  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, '');

  if (!digits) return null;

  // Already full international: 35799123456 (11 digits, starts with 357)
  if (digits.startsWith('357') && digits.length === 11) {
    return digits;
  }

  // With 00 prefix: 0035799123456
  if (digits.startsWith('00357') && digits.length === 13) {
    return digits.slice(2);
  }

  // Local 8-digit number
  if (digits.length === 8) {
    return `357${digits}`;
  }

  // Might be a Greek or other EU number scraped by mistake
  if (digits.startsWith('30') && digits.length === 12) return digits; // Greece
  if (digits.startsWith('44') && digits.length === 12) return digits; // UK

  return null;
}

export function formatPhoneDisplay(normalized: string): string {
  if (normalized.startsWith('357') && normalized.length === 11) {
    const local = normalized.slice(3);
    return `+357 ${local.slice(0, 2)} ${local.slice(2)}`;
  }
  return `+${normalized}`;
}
