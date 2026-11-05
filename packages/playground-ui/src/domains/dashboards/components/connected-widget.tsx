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

/** `StatelessWidget` with its state held here and its requests sent through React Query. */
function Connected({ env, ...props }: ConnectedWidgetProps & { env: DashboardEnvironment }) {
  const [state, setState] = useState<WidgetState>({});
  const first = planWidget(props.prepared, env, state);
  const discovered = useDashboardResults(first.status === 'ready' ? first.discover : []);
  // Planned again with the discover answers so far; both lists go out in the same render.
  const plan = planWidget(props.prepared, env, state, discovered.results);
  const sent = useDashboardResults(plan.status === 'ready' ? plan.requests : []);
  return (
    <StatelessWidget
      {...props}
      env={env}
      state={state}
      onStateChange={setState}
      discovered={discovered.results}
      results={sent.results}
      onRetry={() => {
        discovered.retry();
        sent.retry();
      }}
    />
  );
}

function WithAggregates(props: ConnectedWidgetProps) {
  return <Connected {...props} env={useDashboardEnvironment()} />;
}

function MetricsOnly(props: ConnectedWidgetProps) {
  return <Connected {...props} env={useMetricsEnvironment()} />;
}

/**
 * A widget inside `MetricsProvider`. Only one with trace or span aggregates loads the server's
 * capabilities, which those aggregates wait on.
 */
export function ConnectedWidget(props: ConnectedWidgetProps) {
  return needsAggregates(plannedQueries(props.prepared)) ? <WithAggregates {...props} /> : <MetricsOnly {...props} />;
}
