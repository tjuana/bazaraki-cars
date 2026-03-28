// Shared type for AI analysis output — used by all commands
export interface AnalysisToolOutput {
  fair_price_min_eur: number;
  fair_price_max_eur: number;
  overprice_percent: number;
  risk_score: number;
  risks: string[];
  recommendation: 'strong_buy' | 'buy' | 'negotiate' | 'caution' | 'avoid';
  suggested_offer_eur: number;
  summary: string;
  questions_for_seller: string[];
}
