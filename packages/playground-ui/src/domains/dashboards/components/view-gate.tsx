import type { DashboardQuery } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { useMetricsFilters } from '../../metrics/hooks/use-metrics-filters';
import { useSpanAggregateGate } from '../../metrics/hooks/use-metrics-span-aggregate';
import { useTraceAggregateGate } from '../../metrics/hooks/use-metrics-trace-aggregate';
import type { DashboardPageContext } from '../lib/requests';
import { aggregateSource } from '../lib/requests';

/** A view that can't run yet: capabilities loading, or a page filter its aggregates can't apply. */
export type PendingGate = { status: 'loading' } | { status: 'unsupported-filter'; unsupportedFields: string[] };

/** The page filters `queries` can't apply; `undefined` when they apply them all. */
export type BlockedFields = (queries: DashboardQuery[]) => string[] | undefined;

type GateProps = {
  queries: DashboardQuery[];
  /** Rendered with the page context once every query can run. */
  children: (page: DashboardPageContext, blocked: BlockedFields) => ReactNode;
  /** Rendered while a gate isn't ready; a server without the aggregates renders nothing. */
  pending: (gate: PendingGate) => ReactNode;
  /**
   * Renders `children` even when a page filter can't apply, for widgets whose views each say so on
   * their own (a table's tabs); they check `blocked`.
   */
  partial?: boolean;
};

const sourcesOf = (queries: DashboardQuery[]) => new Set(queries.map(aggregateSource));

/**
 * The page context for a widget's queries. Metrics and scores answer every filter; queries with trace
 * or span aggregates wait on their gates, as the cards built on them do.
 */
export function ViewGate(props: GateProps) {
  const sources = sourcesOf(props.queries);
  if (sources.has('trace') || sources.has('span')) return <AggregateGate {...props} />;
  return <MetricsOnly {...props} />;
}

const noneBlocked: BlockedFields = () => undefined;

function MetricsOnly({ children }: GateProps) {
  const { filters, timestamp } = useMetricsFilters();
  return children({ window: timestamp, filters }, noneBlocked);
}

function AggregateGate({ queries, children, pending, partial }: GateProps) {
  const { filters, timestamp } = useMetricsFilters();
  const traceGate = useTraceAggregateGate();
  const spanGate = useSpanAggregateGate();
  const gatesOf = (qs: DashboardQuery[]) => {
    const sources = sourcesOf(qs);
    return [...(sources.has('trace') ? [traceGate] : []), ...(sources.has('span') ? [spanGate] : [])];
  };
  const blocked: BlockedFields = qs => {
    const fields = gatesOf(qs).flatMap(g => (g.status === 'unsupported-filter' ? g.unsupportedFields : []));
    return fields.length ? [...new Set(fields)] : undefined;
  };

  const gates = gatesOf(queries);
  if (gates.some(g => g.status === 'unavailable')) return null;
  if (gates.some(g => g.status === 'loading')) return pending({ status: 'loading' });
  const unsupportedFields = blocked(queries);
  if (unsupportedFields && !partial) return pending({ status: 'unsupported-filter', unsupportedFields });

  return children(
    {
      window: timestamp,
      filters,
      traceWhere: traceGate.status === 'ready' ? traceGate.scope.where : undefined,
      spanWhere: spanGate.status === 'ready' ? spanGate.scope.where : undefined,
    },
    blocked,
  );
}
