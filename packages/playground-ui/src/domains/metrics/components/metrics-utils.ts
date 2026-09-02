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
  stickyHeaderBackground: 'tinted',
} satisfies Pick<DataListRootProps, 'className' | 'mask' | 'stickyHeaderBackground'>;

export const CHART_COLORS = {
  green: 'var(--chart-1)',
  orange: 'var(--chart-2)',
  pink: 'var(--chart-3)',
  purple: 'var(--chart-5)',
  blue: 'var(--chart-4)',
  blueDark: 'var(--blue-7)',
  blueLight: 'var(--blue-10)',
  red: 'var(--color-error)',
  greenDark: 'var(--green-7)',
  redDark: 'var(--red-7)',
  yellow: 'var(--chart-6)',
} as const;
