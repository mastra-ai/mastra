import type { ReactNode } from 'react';
import { MetricsCard } from '@/ds/components/MetricsCard';

export type ChartAreaProps = {
  /** The data failed to load: an error message replaces the chart. */
  isError?: boolean;
  /** No data in the range: the empty chart stays (axis and height) under a message. */
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
};

/**
 * A card's chart or list, filling the card below its toolbar: an error replaces it, an empty
 * range shows a message over it. The toolbar stays, so tabs can still switch views.
 */
export function ChartArea({
  isError = false,
  isEmpty = false,
  emptyMessage = 'No data in this range.',
  children,
}: ChartAreaProps) {
  if (isError) {
    return <MetricsCard.Error message="Couldn't load this data. Try again in a moment." className="min-h-40 flex-1" />;
  }
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {children}
      {isEmpty && <MetricsCard.NoData message={emptyMessage} className="absolute inset-0" />}
    </div>
  );
}
