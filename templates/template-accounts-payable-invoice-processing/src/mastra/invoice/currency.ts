import { code as currencyCode } from 'currency-codes';

const recentCurrencies = new Map([
  ['XAD', 2],
  ['XCG', 2],
]);
const currenciesWithoutMinorUnits = new Set([
  'XAG',
  'XAU',
  'XBA',
  'XBB',
  'XBC',
  'XBD',
  'XDR',
  'XPD',
  'XPT',
  'XSU',
  'XTS',
  'XUA',
  'XXX',
]);
export const isCanonicalCurrency = (currency: string) =>
  currencyCode(currency)?.code === currency || recentCurrencies.has(currency);
export const minorUnitDigits = (currency: string) => {
  if (currenciesWithoutMinorUnits.has(currency)) return null;
  return recentCurrencies.get(currency) ?? currencyCode(currency)?.digits ?? null;
};
