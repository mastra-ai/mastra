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
  green: 'var(--green-7)',
  orange: 'var(--blue-7)',
  pink: 'var(--orange-7)',
  purple: 'var(--pink-7)',
  blue: 'var(--purple-7)',
  blueDark: 'var(--blue-7)',
  blueLight: 'var(--blue-10)',
  red: 'var(--red-9)',
  greenDark: 'var(--green-7)',
  redDark: 'var(--red-7)',
  yellow: 'var(--yellow-7)',
} as const;
