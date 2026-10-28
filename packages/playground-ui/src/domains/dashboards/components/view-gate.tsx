import type { DashboardQuery } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { useMetricsFilters } from '../../metrics/hooks/use-metrics-filters';
import { useSpanAggregateGate } from '../../metrics/hooks/use-metrics-span-aggregate';
import { useTraceAggregateGate } from '../../metrics/hooks/use-metrics-trace-aggregate';
import type { DashboardPageContext } from '../lib/requests';
import { aggregateSource } from '../lib/requests';

/** A view that can't run yet: capabilities loading, or a page filter its aggregates can't apply. */
export type PendingGate = { status: 'loading' } | { status: 'unsupported-filter'; unsupportedFields: string[] };

type GateProps = {
  /** Rendered with the page context once every query can run. */
  children: (page: DashboardPageContext) => ReactNode;
  /** Rendered while a gate isn't ready; a server without the aggregates renders nothing. */
  pending: (gate: PendingGate) => ReactNode;
};

/** Which aggregate gates a view waits on. */
function viewGates(queries: DashboardQuery[]) {
  const sources = new Set(queries.map(aggregateSource));
  return { trace: sources.has('trace'), span: sources.has('span') };
}

/**
 * The page context for a view's queries. Metrics and scores answer every filter; a view with trace
 * or span aggregates waits on their gates, as the cards built on them do.
 */
export function ViewGate({ queries, ...props }: GateProps & { queries: DashboardQuery[] }) {
  const gates = viewGates(queries);
  if (gates.trace || gates.span) return <AggregateGate {...gates} {...props} />;
  return <MetricsOnly {...props} />;
}

function MetricsOnly({ children }: GateProps) {
  const { filters, timestamp } = useMetricsFilters();
  return children({ window: timestamp, filters });
}

function AggregateGate({ trace, span, children, pending }: GateProps & { trace: boolean; span: boolean }) {
  const { filters, timestamp } = useMetricsFilters();
  const traceGate = useTraceAggregateGate();
  const spanGate = useSpanAggregateGate();
  const gates = [...(trace ? [traceGate] : []), ...(span ? [spanGate] : [])];

  if (gates.some(g => g.status === 'unavailable')) return null;
  if (gates.some(g => g.status === 'loading')) return pending({ status: 'loading' });
  const unsupported = gates.flatMap(g => (g.status === 'unsupported-filter' ? g.unsupportedFields : []));
  if (unsupported.length)
    return pending({ status: 'unsupported-filter', unsupportedFields: [...new Set(unsupported)] });

  return children({
    window: timestamp,
    filters,
    ...(traceGate.status === 'ready' && traceGate.scope.where ? { traceWhere: traceGate.scope.where } : {}),
    ...(spanGate.status === 'ready' && spanGate.scope.where ? { spanWhere: spanGate.scope.where } : {}),
  });
}
