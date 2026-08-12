import type { ReactNode } from 'react';

import './metric-value.css';

export interface MetricValueProps {
  children: ReactNode;
  className?: string;
}

/** Digits of a status metric, folded away until the metric or its strip is hovered. */
export function MetricValue({ children, className }: MetricValueProps) {
  return (
    <span className="metric-value">
      <span className={className}>{children}</span>
    </span>
  );
}
