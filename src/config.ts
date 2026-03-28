import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../bazaraki-cars.config.json');
const ENV_PATH = join(__dirname, '../.env');

const ConfigSchema = z.object({
  budget: z.object({ min: z.number(), max: z.number() }),
  brands: z.array(z.string()),
  districts: z.array(z.string()),
  maxMileage: z.number(),
  minYear: z.number().nullable(),
  maxYear: z.number().nullable(),
  fuelTypes: z.array(z.string()),
  excludeDealers: z.boolean().default(false),
  scrapeMaxPages: z.number().default(5),
  scrapeDelayMs: z.object({ min: z.number(), max: z.number() }),
  whatsappRateLimit: z.object({ maxPerHour: z.number().default(8) }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadEnv() {
  if (!existsSync(ENV_PATH)) return;
  const content = readFileSync(ENV_PATH, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;
  loadEnv();
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  _config = ConfigSchema.parse(JSON.parse(raw));
  return _config;
}

