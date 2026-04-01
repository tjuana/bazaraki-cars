import { getClient, getGroqClient, getProvider, GEMINI_MODEL, GROQ_MODEL } from './client.js';
import { MESSENGER_SYSTEM } from './prompts.js';
import type { Listing } from '../types/index.js';
import type { AnalysisToolOutput } from './tools.js';

function buildPrompt(listing: Listing, analysis: AnalysisToolOutput): string {
  const isJapanese = ['Toyota', 'Honda', 'Nissan', 'Mazda', 'Mitsubishi', 'Suzuki', 'Subaru', 'Lexus']
    .includes(listing.brand ?? '') ||
    (listing.description ?? '').toLowerCase().includes('japan');

  return `Write a WhatsApp opening message for this car:

Car: ${listing.title}
Year: ${listing.year ?? 'unknown'}, Mileage: ${listing.mileage ? `${listing.mileage.toLocaleString()} km` : 'unknown'}
Asking: €${listing.price ? listing.price / 100 : '?'}
${isJapanese ? 'Japanese import — ask about auction sheet.' : 'Ask about service history.'}
Key concerns: ${analysis.risks.slice(0, 2).join(', ') || 'none'}
Questions to ask: ${analysis.questions_for_seller.slice(0, 2).join(' / ')}

Write ONLY the message text. 2-4 sentences max. No intro, no sign-off.`;
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
