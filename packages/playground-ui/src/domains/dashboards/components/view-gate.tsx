import type { DashboardQuery } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { useDashboardEnvironment, useMetricsEnvironment } from '../hooks/use-dashboard-environment';
import { needsAggregates, widgetGate } from '../lib/gate';
import type { BlockedFields, DashboardEnvironment, PendingGate } from '../lib/gate';
import type { DashboardPageContext } from '../lib/requests';

export type { BlockedFields, PendingGate } from '../lib/gate';

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

/**
 * The page context for a widget's queries. Metrics and scores answer every filter; queries with trace
 * or span aggregates wait on their gates, as the cards built on them do.
 */
export function ViewGate(props: GateProps) {
  return needsAggregates(props.queries) ? <AggregateGate {...props} /> : <MetricsOnly {...props} />;
}

function MetricsOnly(props: GateProps) {
  return <Gate {...props} env={useMetricsEnvironment()} />;
}

function AggregateGate(props: GateProps) {
  return <Gate {...props} env={useDashboardEnvironment()} />;
}

function Gate({ queries, children, pending, partial, env }: GateProps & { env: DashboardEnvironment }) {
  const gate = widgetGate(queries, env, { partial });
  if (gate.status === 'hidden') return null;
  if (gate.status === 'pending') return pending(gate.gate);
  return children(gate.page, gate.blocked);
}
