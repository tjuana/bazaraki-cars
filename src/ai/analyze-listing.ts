import { getClient } from './client.js';
import { ANALYST_SYSTEM } from './prompts.js';
import type { AnalysisToolOutput } from './tools.js';
import type { Listing } from '../types/index.js';
import { eurCentsToDisplay } from '../utils/parse-price.js';
import { isMileageSane } from '../utils/parse-mileage.js';
import { SchemaType } from '@google/generative-ai';

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    fair_price_min_eur: { type: SchemaType.NUMBER },
    fair_price_max_eur: { type: SchemaType.NUMBER },
    overprice_percent: { type: SchemaType.NUMBER },
    risk_score: { type: SchemaType.NUMBER },
    risks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    recommendation: { type: SchemaType.STRING },
    suggested_offer_eur: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
    questions_for_seller: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: [
    'fair_price_min_eur', 'fair_price_max_eur', 'overprice_percent',
    'risk_score', 'risks', 'recommendation', 'suggested_offer_eur',
    'summary', 'questions_for_seller',
  ],
};

export async function analyzeListing(listing: Listing): Promise<AnalysisToolOutput> {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA as never,
    },
    systemInstruction: ANALYST_SYSTEM,
  });

  const priceDisplay = listing.price ? eurCentsToDisplay(listing.price) : 'not specified';
  const mileageDisplay = listing.mileage ? `${listing.mileage.toLocaleString()} km` : 'not specified';
  const mileageSanity =
    listing.mileage && listing.year
      ? isMileageSane(listing.mileage, listing.year)
        ? 'seems plausible'
        : '⚠ SUSPICIOUS for this age'
      : 'unknown';

  const prompt = `Analyze this car listing from Bazaraki.com Cyprus:

Title: ${listing.title}
Asking price: ${priceDisplay}
Year: ${listing.year ?? 'unknown'}
Mileage: ${mileageDisplay} (${mileageSanity})
Engine: ${listing.engineSize ? `${listing.engineSize}L` : '?'} ${listing.fuelType ?? ''}
Transmission: ${listing.transmission ?? 'unknown'}
Seller type: ${listing.sellerType}
District: ${listing.district ?? 'unknown'}
Description: ${listing.description ?? '(none)'}

Return JSON analysis. recommendation must be one of: strong_buy, buy, negotiate, caution, avoid.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as AnalysisToolOutput;
}
