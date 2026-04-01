import { getClient, getGroqClient, getProvider, GEMINI_MODEL, GROQ_MODEL } from './client.js';
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

function buildPrompt(listing: Listing): string {
  const priceDisplay = listing.price ? eurCentsToDisplay(listing.price) : 'not specified';
  const mileageDisplay = listing.mileage ? `${listing.mileage.toLocaleString()} km` : 'not specified';
  const mileageSanity =
    listing.mileage && listing.year
      ? isMileageSane(listing.mileage, listing.year)
        ? 'seems plausible'
        : '⚠ SUSPICIOUS for this age'
      : 'unknown';

  return `Analyze this car listing from Bazaraki.com Cyprus:

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
}

async function analyzeWithGemini(listing: Listing): Promise<AnalysisToolOutput> {
  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA as never,
    },
    systemInstruction: ANALYST_SYSTEM,
  });

  const result = await model.generateContent(buildPrompt(listing));
  return JSON.parse(result.response.text()) as AnalysisToolOutput;
}

async function analyzeWithGroq(listing: Listing): Promise<AnalysisToolOutput> {
  const groq = getGroqClient();

  const jsonSpec = `
Respond with a JSON object with EXACTLY these keys:
{
  "fair_price_min_eur": <number>,
  "fair_price_max_eur": <number>,
  "overprice_percent": <number>,
  "risk_score": <number 1-10>,
  "risks": [<string>, ...],
  "recommendation": "<strong_buy|buy|negotiate|caution|avoid>",
  "suggested_offer_eur": <number>,
  "summary": "<string: 2-3 sentence analysis>",
  "questions_for_seller": [<string>, ...]
}`;

  const result = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: ANALYST_SYSTEM + '\n\n' + jsonSpec },
      { role: 'user', content: buildPrompt(listing) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const text = result.choices[0]?.message?.content ?? '{}';
  const raw = JSON.parse(text);

  // Normalize — Llama sometimes uses different key names
  return {
    fair_price_min_eur: raw.fair_price_min_eur ?? raw.fairPriceMinEur ?? 0,
    fair_price_max_eur: raw.fair_price_max_eur ?? raw.fairPriceMaxEur ?? 0,
    overprice_percent: raw.overprice_percent ?? raw.overpricePercent ?? 0,
    risk_score: raw.risk_score ?? raw.riskScore ?? 5,
    risks: raw.risks ?? [],
    recommendation: raw.recommendation ?? 'negotiate',
    suggested_offer_eur: raw.suggested_offer_eur ?? raw.suggestedOfferEur ?? 0,
    summary: raw.summary ?? raw.analysis ?? raw.description ?? 'No summary provided',
    questions_for_seller: raw.questions_for_seller ?? raw.questionsForSeller ?? raw.questions ?? [],
  } as AnalysisToolOutput;
}

export async function analyzeListing(listing: Listing): Promise<AnalysisToolOutput> {
  const provider = getProvider();
  return provider === 'groq' ? analyzeWithGroq(listing) : analyzeWithGemini(listing);
}
