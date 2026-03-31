import type { RawListingCard, RawListingDetail } from '../types/index.js';
import { parsePrice } from '../utils/parse-price.js';
import { parseMileage } from '../utils/parse-mileage.js';
import { normalizeCyprusPhone } from '../whatsapp/phone.js';

export interface NormalizedListing {
  externalId: string;
  url: string;
  title: string;
  price: number | null;
  year: number | null;
  mileage: number | null;
  engineSize: number | null;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  color: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  sellerName: string | null;
  sellerType: string;
  imageUrls: string;   // JSON
}

const BRAND_PATTERNS: [RegExp, string][] = [
  [/toyota/i, 'Toyota'],
  [/honda/i, 'Honda'],
  [/nissan/i, 'Nissan'],
  [/mazda/i, 'Mazda'],
  [/mitsubishi/i, 'Mitsubishi'],
  [/suzuki/i, 'Suzuki'],
  [/subaru/i, 'Subaru'],
  [/lexus/i, 'Lexus'],
  [/bmw/i, 'BMW'],
  [/mercedes|benz/i, 'Mercedes-Benz'],
  [/volkswagen|vw\b/i, 'Volkswagen'],
  [/audi/i, 'Audi'],
  [/ford/i, 'Ford'],
  [/hyundai/i, 'Hyundai'],
  [/kia/i, 'Kia'],
  [/opel/i, 'Opel'],
  [/peugeot/i, 'Peugeot'],
  [/renault/i, 'Renault'],
  [/citroen/i, 'Citroen'],
  [/volvo/i, 'Volvo'],
];

function extractBrand(title: string): string | null {
  for (const [pattern, brand] of BRAND_PATTERNS) {
    if (pattern.test(title)) return brand;
  }
  return null;
}

function extractYear(params: Record<string, string>, title: string): number | null {
  // Try params first: "year", "έτος", "год"
  for (const key of ['year', 'year of manufacture', 'έτος', 'registration year']) {
    const val = params[key];
    if (val) {
      const y = parseInt(val, 10);
      if (y > 1990 && y <= new Date().getFullYear() + 1) return y;
    }
  }
  // Fallback: extract 4-digit year from title
  const match = title.match(/\b(199\d|20[012]\d)\b/);
  return match ? parseInt(match[1], 10) : null;
}

function extractEngineSize(params: Record<string, string>): number | null {
  for (const key of ['engine size', 'engine', 'cc', 'displacement']) {
    const val = params[key];
    if (!val) continue;
    // Handle "1600cc" or "1.6L" or "1,5L" or "1600"
    const ccMatch = val.match(/(\d{3,4})\s*cc/i);
    if (ccMatch) return Math.round(parseInt(ccMatch[1]) / 100) / 10;
    const lMatch = val.match(/(\d+[.,]\d+)\s*[lL]/);
    if (lMatch) return parseFloat(lMatch[1].replace(',', '.'));
    // Bare "1,5L" or "1.5L" without space
    const bareMatch = val.match(/(\d+[.,]\d+)/);
    if (bareMatch) return parseFloat(bareMatch[1].replace(',', '.'));
  }
  return null;
}

function extractFuelType(params: Record<string, string>): string | null {
  for (const key of ['fuel type', 'fuel', 'καύσιμο']) {
    const val = params[key]?.toLowerCase();
    if (!val) continue;
    if (val.includes('petrol') || val.includes('gasoline') || val.includes('βενζίν')) return 'petrol';
    if (val.includes('diesel') || val.includes('πετρέλ')) return 'diesel';
    if (val.includes('hybrid')) return 'hybrid';
    if (val.includes('electric') || val.includes('ηλεκτρ')) return 'electric';
    if (val.includes('lpg') || val.includes('gas')) return 'lpg';
  }
  return null;
}

export function normalizeListing(
  card: RawListingCard,
  detail: RawListingDetail
): NormalizedListing {
  const title = detail.title || card.title;
  const priceText = detail.priceText || card.priceText;

  const mileageText =
    detail.params['mileage (in km)'] ??
    detail.params['mileage'] ??
    detail.params['kilometres'] ??
    detail.params['km'] ??
    detail.params['χιλιόμετρα'] ??
    '';

  const phoneNormalized = detail.phoneRaw
    ? normalizeCyprusPhone(detail.phoneRaw)
    : null;

  return {
    externalId: card.externalId,
    url: card.url,
    title,
    price: parsePrice(priceText),
    year: extractYear(detail.params, title),
    mileage: parseMileage(mileageText),
    engineSize: extractEngineSize(detail.params),
    fuelType: extractFuelType(detail.params),
    transmission: (detail.params['gearbox'] ?? detail.params['transmission'])?.toLowerCase() ?? null,
    bodyType: (detail.params['body type'] ?? detail.params['bodytype'])?.toLowerCase() ?? null,
    color: detail.params['colour'] ?? detail.params['color'] ?? null,
    brand: extractBrand(title),
    model: null,  // TODO: more sophisticated model extraction
    description: detail.description || null,
    phoneRaw: detail.phoneRaw || null,
    phoneNormalized,
    sellerName: detail.sellerName || null,
    sellerType: detail.sellerType,
    imageUrls: JSON.stringify(detail.imageUrls),
  };
}
