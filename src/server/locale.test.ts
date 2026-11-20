import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INDIA_LOCALE,
  formatINR as formatServerINR,
  formatIndianNumber as formatServerIndianNumber,
  formatIndianDate as formatServerIndianDate,
  formatIndianDateTime as formatServerIndianDateTime,
  isValidIndianPinCode as isValidServerPinCode,
  isValidIndianPhone as isValidServerPhone,
  roundInrAmount,
  isNonNegativeMonetaryAmount,
} from './locale';
import {
  INDIA_LOCALE_CONFIG,
  formatINR as formatClientINR,
  formatIndianNumber as formatClientIndianNumber,
  formatIndianDate as formatClientIndianDate,
  formatIndianDateTime as formatClientIndianDateTime,
  isValidIndianPinCode as isValidClientPinCode,
  isValidIndianPhone as isValidClientPhone,
  buildFinePaymentReceiptText,
} from '../utils/formatters.js';

test('India locale defaults are consistent between server and client', () => {
  assert.equal(INDIA_LOCALE.country, 'India');
  assert.equal(INDIA_LOCALE.currency, 'INR');
  assert.equal(INDIA_LOCALE.currencySymbol, '₹');
  assert.equal(INDIA_LOCALE.locale, 'en-IN');
  assert.equal(INDIA_LOCALE.timeZone, 'Asia/Kolkata');

  assert.equal(INDIA_LOCALE_CONFIG.country, 'India');
  assert.equal(INDIA_LOCALE_CONFIG.currency, 'INR');
  assert.equal(INDIA_LOCALE_CONFIG.locale, 'en-IN');
  assert.equal(INDIA_LOCALE_CONFIG.timeZone, 'Asia/Kolkata');
  assert.equal(INDIA_LOCALE_CONFIG.dateFormat, 'DD/MM/YYYY');
});

test('formatINR formats Indian numbering system across lakhs and decimals without FX distortion', () => {
  const cases: Array<[number, string]> = [
    [0, '₹0.00'],
    [7.5, '₹7.50'],
    [10, '₹10.00'],
    [250, '₹250.00'],
    [1500, '₹1,500.00'],
    [10000, '₹10,000.00'],
    [100000, '₹1,00,000.00'],
    [1000000, '₹10,00,000.00'],
  ];

  for (const [amount, expected] of cases) {
    assert.equal(formatServerINR(amount), expected);
    assert.equal(formatClientINR(amount), expected);
  }

  assert.equal(formatClientINR(100000, { showDecimals: false }), '₹1,00,000');
  assert.equal(formatServerIndianNumber(1000000), '10,00,000');
  assert.equal(formatClientIndianNumber(1000000), '10,00,000');
});

test('Indian date and IST datetime formatters produce DD/MM/YYYY and IST timestamps', () => {
  assert.equal(formatServerIndianDate('2026-11-20'), '20/11/2026');
  assert.equal(formatClientIndianDate('2026-11-20'), '20/11/2026');

  // 2026-11-20T19:00:00.000Z is 21/11/2026, 00:30 IST (UTC+5:30)
  assert.equal(formatServerIndianDate('2026-11-20T19:00:00.000Z'), '21/11/2026');
  assert.equal(formatClientIndianDate('2026-11-20T19:00:00.000Z'), '21/11/2026');

  const dtServer = formatServerIndianDateTime('2026-11-20T04:30:00.000Z');
  const dtClient = formatClientIndianDateTime('2026-11-20T04:30:00.000Z');
  assert.match(dtServer, /^20\/11\/2026, 10:00 .*IST$/i);
  assert.match(dtClient, /^20\/11\/2026, 10:00 .*IST$/i);
});

test('Indian PIN code, phone number, and INR monetary validators enforce rules', () => {
  assert.equal(isValidServerPinCode('560012'), true);
  assert.equal(isValidClientPinCode('700091'), true);
  assert.equal(isValidServerPinCode('012345'), false);
  assert.equal(isValidClientPinCode('56001'), false);

  assert.equal(isValidServerPhone('+91 80412 44001'), true);
  assert.equal(isValidClientPhone('+91 98765 43210'), true);
  assert.equal(isValidServerPhone('+1 (555) 210-4400'), false);
  assert.equal(isValidClientPhone('12345'), false);

  assert.equal(roundInrAmount(0.1 + 0.2), 0.3);
  assert.equal(roundInrAmount(7.504), 7.5);
  assert.equal(roundInrAmount(7.505), 7.51);
  assert.equal(isNonNegativeMonetaryAmount(0), true);
  assert.equal(isNonNegativeMonetaryAmount(150.5), true);
  assert.equal(isNonNegativeMonetaryAmount(-1), false);
  assert.equal(isNonNegativeMonetaryAmount(Number.NaN), false);
});

test('buildFinePaymentReceiptText outputs INR amounts, DD/MM/YYYY IST date, and MOCK_DEV notice', () => {
  const receipt = buildFinePaymentReceiptText({
    fine: {
      bookTitle: 'Designing Data-Intensive Applications',
      reason: 'OVERDUE',
      amount: 7.5,
      paidAmount: 7.5,
      waivedAmount: 0,
      balance: 0,
      status: 'PAID',
    },
    payment: {
      receiptNumber: 'PAY-2026-0042',
      paidAt: '2026-11-20T05:00:00.000Z',
      amount: 7.5,
      paymentMethod: 'MOCK_UPI',
      gatewayMode: 'MOCK_DEV',
    },
    member: {
      fullName: 'Ananya Sharma',
      institutionalId: 'STU-2026-1042',
    },
  });

  assert.match(receipt, /PAY-2026-0042/);
  assert.match(receipt, /₹7\.50/);
  assert.match(receipt, /INR/);
  assert.match(receipt, /20\/11\/2026/);
  assert.match(receipt, /IST/);
  assert.match(receipt, /MOCK_DEV/);
  assert.doesNotMatch(receipt, /\$/);
});
