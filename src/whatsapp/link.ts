import { normalizeCyprusPhone } from './phone.js';

export function generateWhatsAppLink(phoneRaw: string, message: string): string {
  const normalized = normalizeCyprusPhone(phoneRaw);
  if (!normalized) {
    throw new Error(`Cannot normalize phone number: "${phoneRaw}"`);
  }
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}
