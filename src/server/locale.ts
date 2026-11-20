/**
 * SmartLib Server-Side India Localization & Monetary Utilities
 * Ensures consistent INR (₹), en-IN numbering, Asia/Kolkata (IST) dates,
 * decimal-safe paise arithmetic, and Indian contact/PIN validation.
 */

export const INDIA_LOCALE = Object.freeze({
  country: 'India',
  currency: 'INR',
  currencySymbol: '₹',
  locale: 'en-IN',
  timeZone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
  phoneFormat: '+91 XXXXX XXXXX',
  pinCodePattern: '^[1-9][0-9]{5}$',
});

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const indianNumberFormatter = new Intl.NumberFormat('en-IN');

const istDateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const istDateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Decimal-safe rounding to 2 decimal places (paise precision) to prevent binary floating-point drift.
 */
export function roundInrAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isNonNegativeMonetaryAmount(value: unknown): boolean {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 && num <= 10_00_000;
}

export function formatINR(value: number): string {
  const safe = roundInrAmount(Number(value));
  return inrFormatter
    .format(safe)
    .replace(/^₹\s+/, '₹')
    .replace(/^-₹\s+/, '-₹');
}

export function formatIndianNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return indianNumberFormatter.format(value);
}

export function formatIndianDate(input: string | Date): string {
  if (!input) return '';
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return istDateFormatter.format(d);
}

export function formatIndianDateTime(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return `${istDateTimeFormatter.format(d)} IST`;
}

export function isValidIndianPinCode(pin: string): boolean {
  return /^[1-9][0-9]{5}$/.test(String(pin || '').trim());
}

export function isValidIndianPhone(phone: string): boolean {
  return /^\+91[\s-]?[1-9][0-9]{4}[\s-]?[0-9]{5}$/.test(String(phone || '').trim());
}
