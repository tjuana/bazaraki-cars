export type ListingStatus =
  | 'new'
  | 'analyzed'
  | 'contacted'
  | 'negotiating'
  | 'rejected'
  | 'bought';

export type SellerType = 'private' | 'dealer' | 'unknown';

export type Recommendation =
  | 'strong_buy'
  | 'buy'
  | 'negotiate'
  | 'caution'
  | 'avoid';

export interface Listing {
  id: number;
  externalId: string;
  url: string;
  title: string;
  price: number | null;         // EUR cents
  currency: string | null;
  year: number | null;
  mileage: number | null;       // km
  engineSize: number | null;    // e.g. 1.6
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  color: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  sellerName: string | null;
  sellerType: SellerType;
  district: string | null;
  imageUrls: string[];
  scrapedAt: string;
  source: 'bazaraki' | 'facebook';
  status: ListingStatus;
}

export interface Analysis {
  id: number;
  listingId: number;
  fairPriceMin: number | null;   // EUR cents
  fairPriceMax: number | null;
  overpricePercent: number | null;
  riskScore: number | null;      // 1-10
  risks: string[];
  recommendation: Recommendation | null;
  suggestedOffer: number | null; // EUR cents
  summary: string;
  questionsForSeller: string[];
  rawResponse: string | null;
  analyzedAt: string;
}

export interface Conversation {
  id: number;
  listingId: number;
  direction: 'outgoing' | 'incoming';
  message: string;
  whatsappLink: string | null;
  createdAt: string;
}

export interface RawListingCard {
  externalId: string;
  url: string;
  title: string;
  priceText: string;
  metaText: string;
}

export interface RawListingDetail {
  title: string;
  priceText: string;
  description: string;
  params: Record<string, string>;
  phoneRaw: string;
  sellerName: string;
  sellerType: SellerType;
  imageUrls: string[];
}
