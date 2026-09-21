import type { DataListRootProps } from '@/ds/components/DataList';

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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
