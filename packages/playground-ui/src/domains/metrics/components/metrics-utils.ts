import type { DataListRootProps } from '@/ds/components/DataList';

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
