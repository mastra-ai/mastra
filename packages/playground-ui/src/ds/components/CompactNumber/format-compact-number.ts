export interface CompactNumberFormatOptions {
  currency?: string;
}

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 });
const fullNumber = new Intl.NumberFormat('en-US');

const currencyCodes = new Set(Intl.supportedValuesOf('currency'));

function isCurrency(code: string | undefined): code is string {
  return code !== undefined && currencyCodes.has(code.toUpperCase());
}

function money(currency: string, options: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, ...options });
}

export function formatCompactNumber(value: number, { currency }: CompactNumberFormatOptions = {}): string {
  if (!isCurrency(currency)) return compactNumber.format(value);
  const size = Math.abs(value);
  if (size < 100) return formatFullNumber(value, { currency });
  if (size < 1000) return money(currency, { maximumFractionDigits: 0 }).format(value);
  return money(currency, { notation: 'compact', maximumSignificantDigits: 3 }).format(value);
}

export function formatFullNumber(value: number, { currency }: CompactNumberFormatOptions = {}): string {
  if (!isCurrency(currency)) return fullNumber.format(value);
  const formatter = money(currency, {});
  const smallestUnit = 10 ** -(formatter.resolvedOptions().maximumFractionDigits ?? 2);
  if (value !== 0 && Math.abs(value) < smallestUnit) {
    return `${value < 0 ? '-' : ''}<${formatter.format(smallestUnit)}`;
  }
  return formatter.format(value);
}
