import type { DataListRootProps } from '@/ds/components/DataList';

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
