import { getClient, DEFAULT_MODEL } from './client.js';
import { NEGOTIATOR_SYSTEM } from './prompts.js';
import type { Listing, Conversation } from '../types/index.js';
import type { AnalysisToolOutput } from './tools.js';

export async function generateFollowUp(
  listing: Listing,
  analysis: AnalysisToolOutput,
  history: Conversation[],
  sellerReply: string
): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: DEFAULT_MODEL,
    systemInstruction: NEGOTIATOR_SYSTEM,
  });

  // Build conversation as a chat session
  const chat = model.startChat({
    history: history.map((msg) => ({
      role: msg.direction === 'outgoing' ? 'user' : 'model',
      parts: [{ text: msg.message }],
    })),
  });

  const prompt = `Seller just replied: "${sellerReply}"

Context:
- Car: ${listing.title}, asking €${listing.price ? listing.price / 100 : '?'}
- Fair value: €${analysis.fair_price_min_eur}–${analysis.fair_price_max_eur}
- My target offer: €${analysis.suggested_offer_eur}
- Risks: ${analysis.risks.join(', ') || 'none'}

Write ONLY my next WhatsApp reply. Short and natural.`;

  const result = await chat.sendMessage(prompt);
  return result.response.text().trim();
}
