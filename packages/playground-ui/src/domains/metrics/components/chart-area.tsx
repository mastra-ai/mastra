import type { ReactNode } from 'react';
import { MetricsCard } from '@/ds/components/MetricsCard';

export type ChartAreaProps = {
  /** No data in the range: the empty chart stays (axis and height) under a message. */
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
};

/** A card's chart or list, filling the card body; an empty range shows a message over it. */
export function ChartArea({ isEmpty = false, emptyMessage = 'No data in this range.', children }: ChartAreaProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {children}
      {isEmpty && <MetricsCard.NoData message={emptyMessage} className="absolute inset-0" />}
    </div>
  );
}
