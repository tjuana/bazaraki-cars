import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { loadEnv } from '../config.js';

let _genai: GoogleGenerativeAI | null = null;
let _groq: Groq | null = null;

export type AiProvider = 'gemini' | 'groq';

export function getProvider(): AiProvider {
  loadEnv();
  // Prefer Groq if key is set, fall back to Gemini
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  throw new Error('No AI API key found. Set GROQ_API_KEY or GEMINI_API_KEY in .env');
}

export function getClient(): GoogleGenerativeAI {
  if (!_genai) {
    loadEnv();
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set. Add it to .env');
    _genai = new GoogleGenerativeAI(key);
  }
  return _genai;
}

export function getGroqClient(): Groq {
  if (!_groq) {
    loadEnv();
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not set. Add it to .env');
    _groq = new Groq({ apiKey: key });
  }
  return _groq;
}

export const GEMINI_MODEL = 'gemini-2.0-flash';
export const GROQ_MODEL = 'llama-3.3-70b-versatile';
export const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export function getFlashModel() {
  return getClient().getGenerativeModel({ model: GEMINI_MODEL });
}
