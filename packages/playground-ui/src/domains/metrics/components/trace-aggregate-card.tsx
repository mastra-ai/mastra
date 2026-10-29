import type { ReactNode } from 'react';
import { useTraceAggregateGate } from '../hooks/use-metrics-trace-aggregate';
import type { TraceAggregateScope } from '../hooks/use-metrics-trace-aggregate';
import { ChartCard } from './chart-card';
import type { ChartCardProps } from './chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';

const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
};

export type TraceAggregateCardProps = Pick<ChartCardProps, 'title' | 'description' | 'className'> & {
  /** The card groups or filters on the root span's type, which needs `traceQueryRootSpanFields`. */
  requiresRootSpanFields?: boolean;
  /** The loaded card, rendered once the server can answer it and the page filters apply to traces. */
  children: (scope: TraceAggregateScope) => ReactNode;
};

/**
 * Gates a card built on `aggregateTraces()`: hidden on a server without it, a note when a page
 * filter has no trace equivalent (rather than numbers that ignore the filter), else the card.
 */
export function TraceAggregateCard({ requiresRootSpanFields, children, ...layout }: TraceAggregateCardProps) {
  const gate = useTraceAggregateGate({ requiresRootSpanFields });
  if (gate.status === 'unavailable') return null;
  if (gate.status === 'ready') return children(gate.scope);
  return (
    <ChartCard {...layout}>
      {gate.status === 'loading' ? (
        <MetricsCard.Loading />
      ) : (
        <MetricsCard.NoData
          message={`Not available with a ${gate.unsupportedFields.map(f => FILTER_NAMES[f] ?? f).join(' or ')} filter.`}
        />
      )}
    </ChartCard>
  );
}
