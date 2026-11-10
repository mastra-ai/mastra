import { useState } from 'react';
import { useDashboardEnvironment, useMetricsEnvironment } from '../hooks/use-dashboard-environment';
import { useDashboardResults } from '../hooks/use-dashboard-requests';
import { needsAggregates } from '../lib/gate';
import type { DashboardEnvironment } from '../lib/gate';
import { plannedQueries, planWidget } from '../lib/plan-widget';
import type { WidgetState } from '../widget-kind';
import { StatelessWidget } from './stateless-widget';
import type { StatelessWidgetProps } from './stateless-widget';

type ConnectedWidgetProps = Omit<
  StatelessWidgetProps,
  'env' | 'state' | 'onStateChange' | 'discovered' | 'results' | 'onRetry'
>;

type HeldProps = ConnectedWidgetProps & { state: WidgetState; onStateChange: (next: WidgetState) => void };

/** `StatelessWidget` with its requests sent through React Query. */
function Connected({ env, ...props }: HeldProps & { env: DashboardEnvironment }) {
  const first = planWidget(props.prepared, env, props.state);
  const discovered = useDashboardResults(first.status === 'ready' ? first.discover : []);
  // Planned again with the discover answers so far; both lists go out in the same render.
  const plan = planWidget(props.prepared, env, props.state, discovered.results);
  const sent = useDashboardResults(plan.status === 'ready' ? plan.requests : []);
  return (
    <StatelessWidget
      {...props}
      env={env}
      discovered={discovered.results}
      results={sent.results}
      onRetry={() => {
        discovered.retry();
        sent.retry();
      }}
    />
  );
}

function WithAggregates(props: HeldProps) {
  return <Connected {...props} env={useDashboardEnvironment()} />;
}

function MetricsOnly(props: HeldProps) {
  return <Connected {...props} env={useMetricsEnvironment()} />;
}

/**
 * A widget inside `MetricsProvider`. Only one whose shown queries include trace or span aggregates
 * loads the server's capabilities, which those aggregates wait on. Its state is held here, above
 * that choice, so picking a view that switches it keeps the pick.
 */
export function ConnectedWidget(props: ConnectedWidgetProps) {
  const [state, setState] = useState<WidgetState>({});
  const held = { ...props, state, onStateChange: setState };
  return needsAggregates(plannedQueries(props.prepared, state)) ? (
    <WithAggregates {...held} />
  ) : (
    <MetricsOnly {...held} />
  );
}
