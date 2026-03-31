import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadEnv } from '../config.js';

let _genai: GoogleGenerativeAI | null = null;

export function getClient(): GoogleGenerativeAI {
  if (!_genai) {
    loadEnv();
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set. Add it to .env');
    _genai = new GoogleGenerativeAI(key);
  }
  return _genai;
}

/** Модель по умолчанию — 2.0-flash: 1500 req/day бесплатно (vs 20/day у 2.5-flash) */
export const DEFAULT_MODEL = 'gemini-2.0-flash';

export function getFlashModel() {
  return getClient().getGenerativeModel({ model: DEFAULT_MODEL });
}
