export interface CompactNumberFormatOptions {
  currency?: string;
}

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 });
const fullNumber = new Intl.NumberFormat('en-US');

function money(currency: string, options: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, ...options });
}

export function formatCompactNumber(value: number, { currency }: CompactNumberFormatOptions = {}): string {
  if (!currency) return compactNumber.format(value);
  const size = Math.abs(value);
  if (size < 100) return formatFullNumber(value, { currency });
  if (size < 1000) return money(currency, { maximumFractionDigits: 0 }).format(value);
  return money(currency, { notation: 'compact', maximumSignificantDigits: 3 }).format(value);
}

export function formatFullNumber(value: number, { currency }: CompactNumberFormatOptions = {}): string {
  if (!currency) return fullNumber.format(value);
  if (value > 0 && value < 0.01) return `<${money(currency, {}).format(0.01)}`;
  return money(currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
