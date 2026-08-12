import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import './metric-value.css';

export interface MetricValueProps {
  children: ReactNode;
  className?: string;
}

/** Digits of a status metric, folded away until the metric or its strip is hovered. */
export function MetricValue({ children, className }: MetricValueProps) {
  return <span className={cn('metric-value', className)}>{children}</span>;
}
