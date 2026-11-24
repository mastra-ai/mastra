import type { DashboardQuery } from '@mastra/client-js';
import { aggregateSource } from './requests';
import type { DashboardPageContext } from './requests';

/** One aggregate backend's readiness, as plain data a host can provide. */
export type AggregateGateInput<Where> =
  /** Capabilities are still loading. */
  | { status: 'loading' }
  /** The server can't answer these aggregates: widgets that need them are hidden. */
  | { status: 'unavailable' }
  /** A page filter has no equivalent on this backend, so its numbers would ignore it. */
  | { status: 'unsupported-filter'; unsupportedFields: string[] }
  | { status: 'ready'; where?: Where };

/** What a widget needs from its page: the frozen window, the filters, and the aggregate gates. */
export type DashboardEnvironment = {
  window: DashboardPageContext['window'];
  filters: DashboardPageContext['filters'];
  /** What figures are compared against, e.g. `vs previous 24h`. */
  comparisonLabel: string;
  /** Display name for a project id, when the page spans several projects; ids show as they are without it. */
  projectLabel?: (projectId: string) => string;
  gates: {
    trace: AggregateGateInput<NonNullable<DashboardPageContext['traceWhere']>>;
    span: AggregateGateInput<NonNullable<DashboardPageContext['spanWhere']>>;
  };
};

/** A view that can't run yet: capabilities loading, or a page filter its aggregates can't apply. */
export type PendingGate = { status: 'loading' } | { status: 'unsupported-filter'; unsupportedFields: string[] };

/** The page filters `queries` can't apply; `undefined` when they apply them all. */
export type BlockedFields = (queries: readonly DashboardQuery[]) => string[] | undefined;

export type WidgetGate =
  /** The server can't answer the widget: it renders nothing. */
  | { status: 'hidden' }
  | { status: 'pending'; gate: PendingGate }
  | { status: 'ready'; page: DashboardPageContext; blocked: BlockedFields };

const sourcesOf = (queries: readonly DashboardQuery[]) => new Set(queries.map(aggregateSource));

/** Whether any of `queries` reads trace or span aggregates, so the page's gates apply to it. */
export const needsAggregates = (queries: readonly DashboardQuery[]) => {
  const sources = sourcesOf(queries);
  return sources.has('trace') || sources.has('span');
};

/**
 * Whether `queries` can run on the page `env` describes, and their page context when they can.
 * Metrics and scores answer every filter; trace and span aggregates wait on their gates. With
 * `partial`, a page filter the aggregates can't apply doesn't hold the widget up: its views check
 * `blocked` themselves (a table's tabs).
 */
export function widgetGate(
  queries: readonly DashboardQuery[],
  env: DashboardEnvironment,
  { partial = false }: { partial?: boolean } = {},
): WidgetGate {
  if (!needsAggregates(queries)) {
    return { status: 'ready', page: { window: env.window, filters: env.filters }, blocked: () => undefined };
  }

  const { trace, span } = env.gates;
  const gatesOf = (qs: readonly DashboardQuery[]) => {
    const sources = sourcesOf(qs);
    return [...(sources.has('trace') ? [trace] : []), ...(sources.has('span') ? [span] : [])];
  };
  const blocked: BlockedFields = qs => {
    const fields = gatesOf(qs).flatMap(g => (g.status === 'unsupported-filter' ? g.unsupportedFields : []));
    return fields.length ? [...new Set(fields)] : undefined;
  };

  const gates = gatesOf(queries);
  if (gates.some(g => g.status === 'unavailable')) return { status: 'hidden' };
  if (gates.some(g => g.status === 'loading')) return { status: 'pending', gate: { status: 'loading' } };
  const unsupportedFields = blocked(queries);
  if (unsupportedFields && !partial) {
    return { status: 'pending', gate: { status: 'unsupported-filter', unsupportedFields } };
  }

  return {
    status: 'ready',
    page: {
      window: env.window,
      filters: env.filters,
      traceWhere: trace.status === 'ready' ? trace.where : undefined,
      spanWhere: span.status === 'ready' ? span.where : undefined,
    },
    blocked,
  };
}
