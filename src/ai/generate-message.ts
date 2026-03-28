import { getClient } from './client.js';
import { MESSENGER_SYSTEM } from './prompts.js';
import type { Listing } from '../types/index.js';
import type { AnalysisToolOutput } from './tools.js';

export async function generateInitialMessage(
  listing: Listing,
  analysis: AnalysisToolOutput
): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: MESSENGER_SYSTEM,
  });

  const isJapanese = ['Toyota', 'Honda', 'Nissan', 'Mazda', 'Mitsubishi', 'Suzuki', 'Subaru', 'Lexus']
    .includes(listing.brand ?? '') ||
    (listing.description ?? '').toLowerCase().includes('japan');

  const prompt = `Write a WhatsApp opening message for this car:

Car: ${listing.title}
Year: ${listing.year ?? 'unknown'}, Mileage: ${listing.mileage ? `${listing.mileage.toLocaleString()} km` : 'unknown'}
Asking: €${listing.price ? listing.price / 100 : '?'}
${isJapanese ? 'Japanese import — ask about auction sheet.' : 'Ask about service history.'}
Key concerns: ${analysis.risks.slice(0, 2).join(', ') || 'none'}
Questions to ask: ${analysis.questions_for_seller.slice(0, 2).join(' / ')}

Write ONLY the message text. 2-4 sentences max. No intro, no sign-off.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
