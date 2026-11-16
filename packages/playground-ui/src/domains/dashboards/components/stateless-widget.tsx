import type { ReactNode } from 'react';
import type { DashboardScope, OnDashboardDrilldown } from '../lib/definition';
import type { DashboardEnvironment } from '../lib/gate';
import { preparedGate } from '../lib/plan-widget';
import type { ReadyPreparedWidget } from '../lib/plan-widget';
import type { DashboardResult } from '../lib/requests';
import type { DashboardAlert, DashboardExpand, WidgetState } from '../widget-kind';
import type { MetricsCardDragHandleProps } from '@/ds/components/MetricsCard';

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
  /**
   * Makes the card's title editable in place, and is called with the trimmed new title when the
   * user changes it (Enter or blur; Escape reverts). The host stores it and passes the widget back
   * with its new `title`. Only a plain title is editable, not one that picks between several views.
   * KPI groups have no title.
   */
  onTitleChange?: (title: string) => void;
  /** The card's Create alert button; see `DashboardAlert`. */
  alert?: DashboardAlert;
  /**
   * The host's buttons on the card, after its own: `MetricsCard.Action`s, each deciding whether it
   * waits for the card's hover (e.g. `onCardHover`) or stays in view.
   */
  actions?: ReactNode;
};

/**
 * One widget drawn from what it is given: it holds no state, fetches nothing and has no effects.
 * The host plans its requests with `planWidget`, sends them however it can, and passes the answers
 * back; picks on the widget come back through `onStateChange`.
 */
export function StatelessWidget({ prepared, env, discovered = [], results = [], ...props }: StatelessWidgetProps) {
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
    />
  );
}
