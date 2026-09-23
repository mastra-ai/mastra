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
  green: 'var(--chart-4)',
  orange: 'var(--chart-6)',
  pink: 'var(--chart-7)',
  purple: 'var(--chart-5)',
  blue: 'var(--chart-1)',
  blueDark: 'var(--chart-2)',
  red: 'var(--chart-8)',
  yellow: 'var(--chart-3)',
} as const;
