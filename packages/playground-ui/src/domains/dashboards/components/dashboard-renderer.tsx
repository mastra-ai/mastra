import type { DashboardDefinition, DashboardWidget } from '@mastra/client-js';
import {
  DASHBOARD_WIDGET_SPANS,
  dashboardDefinitionEnvelopeSchema,
  migrateDashboardDefinition,
} from '@mastra/core/storage/dashboards';
import type { ReactNode } from 'react';
import { useMetrics } from '../../metrics/hooks/use-metrics';
import { BUILT_IN_WIDGET_KINDS } from '../kinds';
import type { DashboardScope, OnDashboardDrilldown } from '../lib/definition';
import { describeIssue, prepareWidget } from '../lib/prepare-widget';
import type { PreparedWidget, StoredWidget } from '../lib/prepare-widget';
import type { AnyWidgetKind, DashboardAlert, DashboardExpand } from '../widget-kind';
import { ConnectedWidget } from './connected-widget';
import { DashboardGrid, DashboardGridCell, DashboardGridRow } from './dashboard-grid';
import type { DashboardSpan } from './dashboard-grid';
import { WidgetError } from './widget-error';
import { ErrorBoundary } from '@/ds/components/ErrorBoundary';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsCardDragHandleProps } from '@/ds/components/MetricsCard';

export type DashboardRendererProps = {
  definition: DashboardDefinition;
  /** Which widgets, views and columns show: `org` spans several projects, `project` is one. */
  scope: DashboardScope;
  /** Opens a drilldown; each host routes to its own Traces or Logs page. */
  onDrilldown?: OnDashboardDrilldown;
  /** Where chart cards expand to, e.g. the host's query page; see `DashboardExpand`. */
  expand?: DashboardExpand;
  /** Kinds beyond the built-in ones; a kind of the same name replaces the built-in. */
  kinds?: AnyWidgetKind[];
  /** Draws a widget in place of its card when it returns something, e.g. an editor for the one being edited. */
  renderWidget?: (widget: StoredWidget) => ReactNode | undefined;
  /**
   * The grip each widget is dragged by, by widget id, e.g. from a layout editor; shown left of the
   * widget's title. No grips without it.
   */
  dragHandle?: (widgetId: string) => MetricsCardDragHandleProps | undefined;
  /**
   * Turns a card's open view into an alert: each card shows a Create alert button, linking where
   * `alert.action` says, or disabled with its reason. No buttons without it. Cards with a drag
   * handle (a layout being edited) show none, and neither do error cards: their widget or query
   * failed, so there is nothing checked to alert on.
   */
  alert?: DashboardAlert;
  className?: string;
} & DashboardPinProps;

/** Both or neither: a host that pins widgets says which are pinned, so a pinned one can be unpinned. */
type DashboardPinProps =
  | {
      /**
       * Pins or unpins a widget, called with the widget and the state the user asked for. The host
       * owns that state and passes it back through `isPinned`. No pin buttons without it.
       */
      onPin: (widget: DashboardWidget, isPinned: boolean) => void;
      /** Whether the host has a widget pinned, by widget id. */
      isPinned: (widgetId: string) => boolean;
    }
  | { onPin?: never; isPinned?: never };

/** Whether a stored widget's `span` is one the grid lays out. */
const isDashboardSpan = (span: unknown): span is DashboardSpan => DASHBOARD_WIDGET_SPANS.some(s => s === span);
type ShownCell = { widget: StoredWidget; prepared: Exclude<PreparedWidget, { ok: 'hidden' }> };
const isShown = (cell: { widget: StoredWidget; prepared: PreparedWidget }): cell is ShownCell =>
  cell.prepared.ok !== 'hidden';

const spanOf = (widget: StoredWidget) => (isDashboardSpan(widget.span) ? widget.span : 12);

/**
 * Lays a dashboard definition out on a 12-column grid inside the page's `MetricsProvider`, which
 * owns the range and filters. Each widget is checked and rendered on its own: one that fails to
 * parse, query or render shows its own error, and the rest of the dashboard still renders.
 */
export function DashboardRenderer({
  definition,
  scope,
  onDrilldown,
  expand,
  kinds = [],
  renderWidget,
  dragHandle,
  onPin,
  isPinned,
  alert,
  className,
}: DashboardRendererProps) {
  // A widget that threw renders again once the page's range or filters change, or the widget does.
  const { datePreset, customRange, filterTokens } = useMetrics();
  const pageKey = JSON.stringify([datePreset, customRange, filterTokens]);
  const registry = new Map([...BUILT_IN_WIDGET_KINDS, ...kinds].map(k => [k.kind, k]));

  const envelope = dashboardDefinitionEnvelopeSchema.safeParse(definition);
  if (!envelope.success) {
    return <MetricsCard.Error message={`This dashboard can't be shown. ${describeIssue(envelope.error.issues[0])}`} />;
  }
  // Each widget is parsed on its own below, so one that doesn't fit the current version shows its own error.
  const { rows } = migrateDashboardDefinition(envelope.data);

  // A row whose widgets are all hidden on this page isn't drawn, so it leaves no gap in the grid.
  const shown = rows
    .map((row, rowIndex) => ({
      rowIndex,
      widgets: row.widgets
        .map(widget => ({ widget, prepared: prepareWidget(widget, registry, scope) }))
        .filter(isShown),
    }))
    .filter(row => row.widgets.length > 0);

  return (
    <DashboardGrid className={className}>
      {shown.map(({ rowIndex, widgets }) => (
        <DashboardGridRow key={rowIndex}>
          {widgets.map(({ widget, prepared }) => {
            // Unparsed, the title may be anything; the error card shows it only when it's text.
            const heading = { id: widget.id, title: typeof widget.title === 'string' ? widget.title : undefined };
            const replaced = renderWidget?.(widget);
            if (replaced !== undefined) {
              return (
                <DashboardGridCell key={widget.id} id={widget.id} span={spanOf(widget)}>
                  {replaced}
                </DashboardGridCell>
              );
            }
            const handle = dragHandle?.(widget.id);
            // Only a widget that parsed can be pinned: the host gets the widget as it renders.
            const pin =
              onPin && prepared.ok
                ? { isPinned: isPinned(widget.id), onPin, name: prepared.widget.title?.trim() || 'widget' }
                : undefined;
            const errorPin =
              pin && prepared.ok ? { ...pin, onPin: (next: boolean) => pin.onPin(prepared.widget, next) } : undefined;
            return (
              <DashboardGridCell key={widget.id} id={widget.id} span={spanOf(widget)}>
                <ErrorBoundary
                  resetKeys={[pageKey, JSON.stringify(widget)]}
                  variant="inline"
                  fallback={({ error }) => (
                    <WidgetError widget={heading} message={error.message} dragHandle={handle} pin={errorPin} />
                  )}
                >
                  {prepared.ok ? (
                    <ConnectedWidget
                      prepared={prepared}
                      scope={scope}
                      onDrilldown={onDrilldown}
                      expand={expand}
                      dragHandle={handle}
                      pin={pin}
                      alert={handle ? undefined : alert}
                    />
                  ) : (
                    <WidgetError widget={heading} message={prepared.message} dragHandle={handle} />
                  )}
                </ErrorBoundary>
              </DashboardGridCell>
            );
          })}
        </DashboardGridRow>
      ))}
    </DashboardGrid>
  );
}
