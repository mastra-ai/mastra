import type { DataListRootProps } from '@/ds/components/DataList';

export { formatCompactNumber as formatCompact } from '@/ds/components/CompactNumber';

export function formatCost(value: number, unit?: string | null): string {
  const isUsd = !unit || unit.toLowerCase() === 'usd';
  const amount = value > 0 && value < 0.01 ? '<0.01' : value.toFixed(2);
  if (!isUsd) return `${amount} ${unit}`;
  return amount.startsWith('<') ? '<$0.01' : `$${amount}`;
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
