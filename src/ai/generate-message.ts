import { getClient, getGroqClient, getProvider, GEMINI_MODEL, GROQ_MODEL } from './client.js';
import { MESSENGER_SYSTEM } from './prompts.js';
import type { Listing } from '../types/index.js';
import type { AnalysisToolOutput } from './tools.js';

function buildPrompt(listing: Listing, analysis: AnalysisToolOutput): string {
  const desc = (listing.description ?? '').toLowerCase();
  const hasAuctionSheet = desc.includes('auction') || desc.includes('grade') || desc.includes('オークション');
  const isJapanImport = desc.includes('japan') || desc.includes('ιαπων') || desc.includes('import') || desc.includes('εισαγωγ');
  const sellerIsDealer = listing.sellerType === 'dealer';

  let context = '';
  if (hasAuctionSheet) {
    context = 'Seller mentions auction sheet/grade — ask for the actual sheet photo and exact grade.';
  } else if (isJapanImport) {
    context = 'Listed as Japanese import — ask if they have the auction sheet.';
  } else {
    context = 'No mention of import origin — ask about service history and how long the car has been in Cyprus.';
  }

  return `Write a WhatsApp opening message for this car:

Car: ${listing.title}
Year: ${listing.year ?? 'unknown'}, Mileage: ${listing.mileage ? `${listing.mileage.toLocaleString()} km` : 'unknown'}
Asking: €${listing.price ? listing.price / 100 : '?'}
Seller type: ${sellerIsDealer ? 'dealer' : 'private'}
${context}
Key concerns: ${analysis.risks.slice(0, 2).join(', ') || 'none'}
Questions to ask: ${analysis.questions_for_seller.slice(0, 2).join(' / ')}

Write ONLY the message text. 2-4 sentences max. No intro, no sign-off.
Do NOT assume the car was recently imported unless the listing says so.`;
}

export async function generateInitialMessage(
  listing: Listing,
  analysis: AnalysisToolOutput
): Promise<string> {
  const provider = getProvider();

  if (provider === 'groq') {
    const groq = getGroqClient();
    const result = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: MESSENGER_SYSTEM },
        { role: 'user', content: buildPrompt(listing, analysis) },
      ],
      temperature: 0.7,
    });
    return (result.choices[0]?.message?.content ?? '').trim();
  }

  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: MESSENGER_SYSTEM,
  });

  const result = await model.generateContent(buildPrompt(listing, analysis));
  return result.response.text().trim();
}
