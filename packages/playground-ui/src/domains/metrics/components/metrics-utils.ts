import type { DataListRootProps } from '@/ds/components/DataList';

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumSignificantDigits: 3,
});

export function formatCompact(n: number): string {
  return compactNumberFormatter.format(n).replace('K', 'k');
}

export function formatCost(value: number, unit?: string | null): string {
  if (unit?.toLowerCase() === 'usd' || !unit) {
    return `$${value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)}`;
  }
  return `${value.toFixed(4)} ${unit}`;
}

export const METRICS_DATA_LIST_PROPS = {
  className: 'max-h-80',
  mask: { left: false },
} satisfies Pick<DataListRootProps, 'className' | 'mask'>;

export const CHART_COLORS = {
  green: 'var(--chart-green)',
  orange: 'var(--chart-orange)',
  pink: 'var(--chart-pink)',
  purple: 'var(--chart-purple)',
  blue: 'var(--chart-blue)',
  blueDark: 'var(--chart-blue-deep)',
  red: 'var(--chart-red)',
  yellow: 'var(--chart-yellow)',
} as const;
