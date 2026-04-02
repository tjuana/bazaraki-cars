const BASE = 'http://localhost:3001';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Types
export interface ListingRow {
  id: number;
  title: string;
  price: number | null;
  year: number | null;
  mileage: number | null;
  fuelType: string | null;
  transmission: string | null;
  brand: string | null;
  model: string | null;
  district: string | null;
  sellerType: string;
  phoneNormalized: string | null;
  status: string;
  url: string;
  scrapedAt: string;
  riskScore: number | null;
  recommendation: string | null;
  suggestedOffer: number | null;
  overpricePercent: number | null;
  fairPriceMin: number | null;
  fairPriceMax: number | null;
}

export interface ListingDetail {
  listing: ListingRow & { imageUrls: string[]; description: string | null };
  analysis: {
    id: number;
    riskScore: number;
    recommendation: string;
    fairPriceMin: number;
    fairPriceMax: number;
    suggestedOffer: number;
    overpricePercent: number;
    summary: string;
    risks: string[];
    questionsForSeller: string[];
    analyzedAt: string;
  } | null;
  callNotes: {
    notes: string;
    checkedQuestions: number[];
    outcome: string | null;
    calledAt: string | null;
    savedAt: string;
  } | null;
}

export interface DashboardData {
  total: number;
  byStatus: Record<string, number>;
  hotDeals: ListingRow[];
  recentlyAnalyzed: Array<{ id: number; title: string; status: string; riskScore: number | null; recommendation: string | null; analyzedAt: string | null }>;
}

export interface Config {
  budget: { min: number; max: number };
  brands: string[];
  models: string[];
  districts: string[];
  maxMileage: number;
  minYear: number | null;
  maxYear: number | null;
  fuelTypes: string[];
  transmission: string | null;
  scrapeMaxPages: number;
}

// API functions
export const api = {
  dashboard: () => get<DashboardData>('/dashboard'),

  listings: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return get<ListingRow[]>(`/listings${qs}`);
  },

  listing: (id: number) => get<ListingDetail>(`/listings/${id}`),

  updateStatus: (id: number, status: string) =>
    patch<{ ok: boolean }>(`/listings/${id}/status`, { status }),

  saveCallNotes: (id: number, data: { notes?: string; checkedQuestions?: number[]; outcome?: string; calledAt?: string }) =>
    post<{ ok: boolean }>(`/listings/${id}/call-notes`, data),

  analyze: (id: number) => post<{ ok: boolean }>(`/analyze/${id}`),

  analyzeAll: () => post<{ ok: boolean; queued: number }>('/analyze/all'),

  scrape: (pages?: number) => post<{ ok: boolean }>('/scrape', { pages }),

  scrapeStatus: () => get<{ scraping: boolean; lastResult: unknown }>('/scrape/status'),

  config: () => get<Config>('/config'),

  saveConfig: (config: Partial<Config>) => post<Config>('/config', config),
};
