import type { WidgetPlanContext, WidgetRequests, WidgetState } from '../widget-kind';
import { widgetGate } from './gate';
import type { BlockedFields, DashboardEnvironment, PendingGate, WidgetGate } from './gate';
import type { PreparedWidget } from './prepare-widget';
import type { DashboardPageContext, DashboardResult } from './requests';

/** A widget that parsed and shows at the page's scope. */
export type ReadyPreparedWidget = Extract<PreparedWidget, { ok: true }>;

export type WidgetPlan =
  /** The server can't answer the widget: it renders nothing and sends nothing. */
  | { status: 'hidden' }
  /** The widget waits on, or can't apply, the page's aggregate gates: it sends nothing yet. */
  | { status: 'pending'; gate: PendingGate }
  | {
      status: 'ready';
      page: DashboardPageContext;
      blocked: BlockedFields;
      /** Send first: their answers, passed back as `discovered`, decide `requests`. */
      discover: WidgetRequests;
      /** What the widget renders from; `undefined` slots aren't sent. */
      requests: WidgetRequests;
    };

/**
 * The queries the page's gates apply to with `state` picked: the kind's `gatedQueries`, or every
 * view's. A kind planning no requests fetches on its own, behind its own `ViewGate`, so the planner
 * never holds it up.
 */
export function plannedQueries({ kind, views }: ReadyPreparedWidget, state: WidgetState) {
  if (!kind.discover && !kind.requests) return [];
  return kind.gatedQueries ? kind.gatedQueries(views, state) : views.flatMap(v => v.queries);
}

/** Whether the queries the widget shows with `state` picked can run on the page `env` describes. */
export const preparedGate = (
  prepared: ReadyPreparedWidget,
  env: DashboardEnvironment,
  state: WidgetState,
): WidgetGate => widgetGate(plannedQueries(prepared, state), env, { partial: prepared.kind.partial });

/**
 * What a widget sends, worked out from plain data and nothing else: the page `env`, the user's
 * `state`, and the answers so far to its `discover` requests. Call it once without `discovered`,
 * send `discover`, then again with their answers for the full `requests`; a host sending both at
 * once (as `DashboardRenderer` does) re-plans as the answers arrive.
 */
export function planWidget(
  prepared: ReadyPreparedWidget,
  env: DashboardEnvironment,
  state: WidgetState,
  discovered: (DashboardResult | undefined)[] = [],
): WidgetPlan {
  const gate = preparedGate(prepared, env, state);
  if (gate.status !== 'ready') return gate;
  const ctx: WidgetPlanContext<unknown> = {
    widget: prepared.widget,
    views: prepared.views,
    page: gate.page,
    blocked: gate.blocked,
    state,
  };
  return {
    ...gate,
    discover: prepared.kind.discover?.(ctx) ?? [],
    requests: prepared.kind.requests?.(ctx, discovered) ?? [],
  };
}
