/**
 * SmartLib India Localization & Currency Formatting Utilities
 * Enforces Indian Rupees (₹ / INR), en-IN numbering (lakhs/crores),
 * Asia/Kolkata (IST) timezone, DD/MM/YYYY date formatting, and Indian contact formats.
 */

export const INDIA_LOCALE_CONFIG = Object.freeze({
  country: 'India',
  currency: 'INR',
  currencySymbol: '₹',
  locale: 'en-IN',
  timeZone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
  phoneFormat: '+91 XXXXX XXXXX',
  pinCodeLength: 6,
});

const inrCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
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

const istMonthFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  month: 'short',
  year: 'numeric',
});

/**
 * Format a numeric value as Indian Rupees (₹) using the en-IN numbering system.
 * Examples:
 * - 10 -> ₹10.00 (or ₹10 with { showDecimals: false })
 * - 1500 -> ₹1,500.00
 * - 100000 -> ₹1,00,000.00
 */
export function formatINR(value, options = {}) {
  const { showDecimals = true } = options;
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  const formatted = showDecimals
    ? inrCurrencyFormatter.format(safe)
    : inrWholeFormatter.format(Math.round(safe));
  // Normalize any non-breaking space between ₹ and digits if an engine inserts one
  return formatted.replace(/^₹\s+/, '₹').replace(/^-₹\s+/, '-₹');
}

/**
 * Format large counts using the Indian numbering system (e.g., 1,00,000).
 */
export function formatIndianNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return indianNumberFormatter.format(num);
}

/**
 * Format ISO timestamp or YYYY-MM-DD calendar date as DD/MM/YYYY in Asia/Kolkata.
 */
export function formatIndianDate(input) {
  if (!input) return '—';
  const raw = String(input).trim();
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return istDateFormatter.format(d);
}

/**
 * Format ISO timestamp as DD/MM/YYYY, HH:mm IST in Asia/Kolkata.
 */
export function formatIndianDateTime(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return `${istDateTimeFormatter.format(d)} IST`;
}

/**
 * Format YYYY-MM string (e.g. "2026-11") as "Nov 2026".
 */
export function formatIndianMonth(ym) {
  if (!ym) return '';
  const match = /^(\d{4})-(\d{2})$/.exec(String(ym).trim());
  if (!match) return String(ym);
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 15));
  return istMonthFormatter.format(d);
}

/**
 * Validate 6-digit Indian PIN code (first digit 1-9).
 */
export function isValidIndianPinCode(pin) {
  return /^[1-9][0-9]{5}$/.test(String(pin || '').trim());
}

/**
 * Validate Indian phone number in +91 XXXXX XXXXX or +91XXXXXXXXXX format.
 */
export function isValidIndianPhone(phone) {
  const cleaned = String(phone || '').trim();
  return /^\+91[\s-]?[1-9][0-9]{4}[\s-]?[0-9]{5}$/.test(cleaned);
}

/**
 * Generate a plain-text downloadable receipt formatted in INR and DD/MM/YYYY IST.
 */
export function buildFinePaymentReceiptText({ fine, payment, member }) {
  const lines = [
    '============================================================',
    'SMARTLIB — INSTITUTIONAL LIBRARY FINE RECEIPT (INDIA)',
    '============================================================',
    `Receipt Number : ${payment.receiptNumber}`,
    `Date & Time    : ${formatIndianDateTime(payment.paidAt)}`,
    `Gateway Mode   : ${payment.gatewayMode} (Development Mock — No real charge)`,
    `Payment Method : ${payment.paymentMethod}`,
    '------------------------------------------------------------',
    `Member Name    : ${member?.fullName || fine.memberName || 'Member'}`,
    `Member ID      : ${member?.institutionalId || fine.memberInstitutionalId || '—'}`,
    `Volume Title   : ${fine.bookTitle || 'Library Fine'}`,
    `Fine Reason    : ${fine.reason}`,
    '------------------------------------------------------------',
    `Currency       : Indian Rupee (INR / ₹)`,
    `Total Assessed : ${formatINR(fine.amount)}`,
    `Amount Paid    : ${formatINR(payment.amount)}`,
    `Balance Due    : ${formatINR(fine.balance ?? Math.max(0, fine.amount - fine.paidAmount - fine.waivedAmount))}`,
    `Status         : ${fine.status}`,
    '============================================================',
    'SmartLib. A smarter way to discover, manage and experience knowledge.',
  ];
  return lines.join('\n');
}
