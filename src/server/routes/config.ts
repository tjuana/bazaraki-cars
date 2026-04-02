import { Router } from 'express';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../../bazaraki-cars.config.json');

export const configRouter = Router();

configRouter.get('/', (_req, res) => {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    res.json(JSON.parse(raw));
  } catch {
    res.status(500).json({ error: 'Could not read config' });
  }
});

configRouter.post('/', (req, res) => {
  try {
    const current = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const updated = { ...current, ...req.body };
    writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Could not save config' });
  }
});
