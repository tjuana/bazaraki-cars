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

/** Для анализа — flash достаточно и бесплатно */
export function getFlashModel() {
  return getClient().getGenerativeModel({ model: 'gemini-2.5-flash' });
}
