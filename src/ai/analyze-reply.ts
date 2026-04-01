import { getClient, getGroqClient, getProvider, GEMINI_MODEL, GROQ_MODEL } from './client.js';
import { NEGOTIATOR_SYSTEM } from './prompts.js';
import type { Listing, Conversation } from '../types/index.js';
import type { AnalysisToolOutput } from './tools.js';

export async function generateFollowUp(
  listing: Listing,
  analysis: AnalysisToolOutput,
  history: Conversation[],
  sellerReply: string
): Promise<string> {
  const prompt = `Seller just replied: "${sellerReply}"

Context:
- Car: ${listing.title}, asking €${listing.price ? listing.price / 100 : '?'}
- Fair value: €${analysis.fair_price_min_eur}–${analysis.fair_price_max_eur}
- My target offer: €${analysis.suggested_offer_eur}
- Risks: ${analysis.risks.join(', ') || 'none'}

Write ONLY my next WhatsApp reply. Short and natural.`;

  const provider = getProvider();

  if (provider === 'groq') {
    const groq = getGroqClient();
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: NEGOTIATOR_SYSTEM },
    ];
    for (const msg of history) {
      messages.push({
        role: msg.direction === 'outgoing' ? 'user' : 'assistant',
        content: msg.message,
      });
    }
    messages.push({ role: 'user', content: prompt });

    const result = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
    });
    return (result.choices[0]?.message?.content ?? '').trim();
  }

  // Gemini
  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: NEGOTIATOR_SYSTEM,
  });

  const chat = model.startChat({
    history: history.map((msg) => ({
      role: msg.direction === 'outgoing' ? 'user' : 'model',
      parts: [{ text: msg.message }],
    })),
  });

  const result = await chat.sendMessage(prompt);
  return result.response.text().trim();
}
