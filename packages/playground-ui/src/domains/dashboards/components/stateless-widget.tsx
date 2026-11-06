import type { DashboardWidget } from '@mastra/client-js';
import type { DashboardScope, OnDashboardDrilldown } from '../lib/definition';
import type { DashboardEnvironment } from '../lib/gate';
import { preparedGate } from '../lib/plan-widget';
import type { ReadyPreparedWidget } from '../lib/plan-widget';
import type { DashboardResult } from '../lib/requests';
import type { DashboardAlert, DashboardExpand, WidgetPin, WidgetState } from '../widget-kind';
import type { MetricsCardDragHandleProps } from '@/ds/components/MetricsCard';

/** A widget's pinned state, as the host holds it, and the call that asks the host to change it. */
export type StatelessWidgetPin = Omit<WidgetPin, 'onPin'> & {
  /** Called with the widget's definition, as it renders, and the state the user asked for. */
  onPin: (widget: DashboardWidget, isPinned: boolean) => void;
};

export type StatelessWidgetProps = {
  /** The widget as `prepareWidget` parsed it. */
  prepared: ReadyPreparedWidget;
  /** The page's window, filters and aggregate gates. */
  env: DashboardEnvironment;
  /** What the user picked on the widget; `{}` for its defaults. */
  state: WidgetState;
  onStateChange: (next: WidgetState) => void;
  /** Answers to `planWidget`'s `discover` requests, in order; missing ones are still loading. */
  discovered?: (DashboardResult | undefined)[];
  /** Answers to `planWidget`'s `requests`, in order; missing ones are still loading. */
  results?: (DashboardResult | undefined)[];
  /** Asks the host to send the failed requests again. */
  onRetry: () => void;
  scope: DashboardScope;
  onDrilldown?: OnDashboardDrilldown;
  expand?: DashboardExpand;
  dragHandle?: MetricsCardDragHandleProps;
  pin?: StatelessWidgetPin;
  /** The card's Create alert button; see `DashboardAlert`. */
  alert?: DashboardAlert;
};

/**
 * One widget drawn from what it is given: it holds no state, fetches nothing and has no effects.
 * The host plans its requests with `planWidget`, sends them however it can, and passes the answers
 * back; picks on the widget come back through `onStateChange`.
 */
export function StatelessWidget({ prepared, env, discovered = [], results = [], pin, ...props }: StatelessWidgetProps) {
  const gate = preparedGate(prepared, env, props.state);
  if (gate.status === 'hidden') return null;
  return (
    <prepared.kind.component
      {...props}
      widget={prepared.widget}
      views={prepared.views}
      gate={gate}
      comparisonLabel={env.comparisonLabel}
      projectLabel={env.projectLabel}
      discovered={discovered}
      results={results}
      pin={pin && { ...pin, onPin: next => pin.onPin(prepared.widget, next) }}
    />
  );
}
