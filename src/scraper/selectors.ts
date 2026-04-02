/**
 * All Bazaraki CSS selectors in one place.
 * If scraping breaks, update here first.
 *
 * Last verified: 2026-03-28 (new advert-card layout)
 */
export const SELECTORS = {
  // ── Search results page ────────────────────────────────────────────────────
  listingCard: 'div.advert.js-item-listing',
  listingLink: 'a.advert__content-title',
  listingTitle: 'a.advert__content-title',
  listingPrice: 'a.advert__content-price',
  listingFeature: '.advert__content-feature > div',
  listingLocation: '.advert__content-place',
  listingDate: '.advert__content-date',
  listingSellerName: '.advert__header-name span',
  listingSellerLogo: 'a.advert__header-logo',

  // ── Individual listing page ────────────────────────────────────────────────
  detailTitle: 'h1.title-announcement, h1[itemprop="name"]',
  detailPrice: '.announcement-price__cost',
  detailPriceMeta: 'meta[itemprop="price"]',
  detailDescription: '.js-description',
  detailDescriptionFallback: '.announcement-description',

  // Characteristic rows (key/value pairs)
  detailCharsList: '.announcement-characteristics li',
  paramKey: 'span.key-chars',
  paramValue: 'a.value-chars, span.value-chars',

  // Phone number reveal
  phoneButton: '.phone-author.js-phone-show',
  phoneCheckUrl: '/phone_check/',
  phoneDialog: '.contacts-dialog__phone a[href^="tel:"]',
  phoneTelLink: 'a[href^="tel:"]',
  whatsappLink: 'a[href*="wa.me"], a[href*="whatsapp.com"]',

  // Seller info
  sellerName: '.advert__header-name span',
  sellerTypeDealer: 'a.advert__header-logo',

  // Images
  imageGallery: 'img.announcement__images-item',

  // Pagination
  nextPageLink: 'a.number-list-next',
} as const;

/**
 * District slug map for building search URLs.
 */
export const DISTRICTS = {
  nicosia: 'lefkosia-district-nicosia',
  limassol: 'lemesos-district-limassol',
  larnaca: 'larnaka-district-larnaca',
  paphos: 'pafos-district-paphos',
  famagusta: 'ammochostos-district-famagusta',
} as const;

export type DistrictKey = keyof typeof DISTRICTS;
