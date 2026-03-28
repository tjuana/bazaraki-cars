/**
 * All Bazaraki CSS selectors in one place.
 * If scraping breaks, update here first.
 * Run `bazaraki-cars scrape --validate` to check selectors on live site.
 */
export const SELECTORS = {
  // ── Search results page ────────────────────────────────────────────────────
  listingCard: 'li.announcement-container',
  listingLink: 'a.announcement-block',
  listingTitle: 'h3.announcement-block__title',
  listingPrice: '.announcement-block__price',
  listingMeta: '.announcement-block__characteristics',
  listingLocation: '.announcement-block__date-location',

  // ── Individual listing page ────────────────────────────────────────────────
  detailTitle: 'h1.announcement-title, h1[itemprop="name"]',
  detailPrice: '.announcement-price__cost',
  detailDescription: '.announcement-description',

  // Characteristic rows (key/value pairs)
  detailParams: '.announcement-characteristics__item',
  paramKey: '.announcement-characteristics__key',
  paramValue: '.announcement-characteristics__value',

  // Phone number reveal
  phoneButton: '.phone-action button, button.call-button, [data-action="show-phone"]',
  phoneNumber: '.phone-action__phone, .js-phone-number',

  // Seller info
  sellerName: '.author-detail .announcement-author__name, .seller-name',
  sellerTypeDealer: '.announcement-author--dealer, [class*="dealer"]',

  // Images
  imageGallery: '.announcement-media__image img, .gallery-slide img',

  // Pagination
  nextPageLink: 'a[rel="next"], .pagination .next a',
  paginationInfo: '.pagination__items',
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
