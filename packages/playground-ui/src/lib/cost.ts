import { formatPercent } from './number';

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

export function formatCost(value: number, unit?: string | null): string {
  const isUsd = !unit || unit.toLowerCase() === 'usd';
  const amount = value > 0 && value < 0.01 ? '<0.01' : value.toFixed(2);
  if (!isUsd) return `${amount} ${unit}`;
  return amount.startsWith('<') ? '<$0.01' : `$${amount}`;
}

/** An aggregate `cost.*` value with its pricing info; absent fields mean the API returned none. */
export type AggregateCost = {
  value?: number;
  /** Share of the traces with usage that were priced. */
  coverage?: number;
  /** The priced rows' currency, `'mixed'` when they use more than one. */
  unit?: string;
};

export type FormattedAggregateCost = { text: string; tooltip?: string };

/**
 * An aggregate cost for display. Mixed currencies can't be summed into one number, and a partly
 * priced total is marked approximate (`~$x`) with how much of the usage was priced.
 */
export function formatAggregateCost({ value, coverage, unit }: AggregateCost): FormattedAggregateCost {
  if (unit === 'mixed') return { text: '—', tooltip: 'Costs use more than one currency' };
  if (value === undefined) return { text: '—', tooltip: 'No priced usage for these traces' };
  const text = formatCost(value, unit);
  if (coverage !== undefined && coverage < 1) {
    return { text: `~${text}`, tooltip: `Priced for ${formatPercent(coverage)} of traces with usage` };
  }
  return { text };
}
