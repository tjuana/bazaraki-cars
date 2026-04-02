import express from 'express';
import cors from 'cors';
import { loadEnv } from '../config.js';
import { listingsRouter } from './routes/listings.js';
import { dashboardRouter } from './routes/dashboard.js';
import { analyzeRouter } from './routes/analyze.js';
import { scrapeRouter } from './routes/scrape.js';
import { configRouter } from './routes/config.js';
import { proxyRouter } from './routes/proxy.js';

loadEnv();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use('/listings', listingsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/analyze', analyzeRouter);
app.use('/scrape', scrapeRouter);
app.use('/config', configRouter);
app.use('/proxy', proxyRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`\n  bazaraki-cars API running at http://localhost:${PORT}\n`);
});
