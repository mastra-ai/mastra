export { DashboardRenderer } from './components/dashboard-renderer';
export { prepareWidget } from './lib/prepare-widget';
export type { PreparedWidget } from './lib/prepare-widget';
export type { DashboardRendererProps } from './components/dashboard-renderer';
export { DashboardGrid, DashboardGridCell, DashboardGridRow } from './components/dashboard-grid';
export type { DashboardSpan } from './components/dashboard-grid';
export { ViewGate } from './components/view-gate';
export { WidgetError } from './components/widget-error';
export { AlertAction, AlertMenu, DrilldownAction, PinAction } from './components/widget-controls';
export type { AlertEntry } from './components/widget-controls';
export { METRICS_DASHBOARD } from './metrics-dashboard';
export { StatelessWidget } from './components/stateless-widget';
export type { StatelessWidgetPin, StatelessWidgetProps } from './components/stateless-widget';
export { useDashboardRequests, useDashboardResults, toDashboardResult } from './hooks/use-dashboard-requests';
export { useDashboardEnvironment } from './hooks/use-dashboard-environment';
export { hasDrilldownAction, useDrilldown, useViewMenu, viewMenu } from './hooks/use-widget-views';
export { planWidget } from './lib/plan-widget';
export type { ReadyPreparedWidget, WidgetPlan } from './lib/plan-widget';
export { widgetGate } from './lib/gate';
export type { AggregateGateInput, BlockedFields, DashboardEnvironment, PendingGate, WidgetGate } from './lib/gate';
export * from './kinds';
export { dashboardDefaults } from './lib/definition';
export type { DashboardScope, OnDashboardDrilldown } from './lib/definition';
export { buildRequest, emptyAnswer, pageQuery, requestKey, sendRequest } from './lib/requests';
export type { DashboardAnswer, DashboardPageContext, DashboardRequest, DashboardResult } from './lib/requests';
export { defineWidgetKind } from './widget-kind';
export type {
  AnyWidgetKind,
  DashboardAlert,
  DashboardAlertAction,
  DashboardAlertRef,
  DashboardAlertSource,
  DashboardAlertTarget,
  DashboardExpand,
  ResolvedView,
  ShownGate,
  WidgetKind,
  WidgetKindCheck,
  WidgetKindProps,
  WidgetPin,
  WidgetPlanContext,
  WidgetRequests,
  WidgetState,
} from './widget-kind';
