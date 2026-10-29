import type { DashboardDefinition } from '@mastra/client-js';
import {
  DASHBOARD_WIDGET_SPANS,
  dashboardDefinitionEnvelopeSchema,
  migrateDashboardDefinition,
} from '@mastra/core/storage/dashboards';
import { useMetrics } from '../../metrics/hooks/use-metrics';
import { BUILT_IN_WIDGET_KINDS } from '../kinds';
import type { DashboardScope, OnDashboardDrilldown } from '../lib/definition';
import { describeIssue, prepareWidget } from '../lib/prepare-widget';
import type { StoredWidget } from '../lib/prepare-widget';
import type { AnyWidgetKind } from '../widget-kind';
import { DashboardGrid, DashboardGridCell, DashboardGridRow } from './dashboard-grid';
import type { DashboardSpan } from './dashboard-grid';
import { WidgetError } from './widget-error';
import { ErrorBoundary } from '@/ds/components/ErrorBoundary';
import { MetricsCard } from '@/ds/components/MetricsCard';

export type DashboardRendererProps = {
  definition: DashboardDefinition;
  /** Which widgets, views and columns show: `org` spans several projects, `project` is one. */
  scope: DashboardScope;
  /** Opens a drilldown; each host routes to its own Traces or Logs page. */
  onDrilldown?: OnDashboardDrilldown;
  /** Kinds beyond the built-in ones; a kind of the same name replaces the built-in. */
  kinds?: AnyWidgetKind[];
  className?: string;
};

/** Whether a stored widget's `span` is one the grid lays out. */
const isDashboardSpan = (span: unknown): span is DashboardSpan => DASHBOARD_WIDGET_SPANS.some(s => s === span);
const spanOf = (widget: StoredWidget) => (isDashboardSpan(widget.span) ? widget.span : 12);

/**
 * Lays a dashboard definition out on a 12-column grid inside the page's `MetricsProvider`, which
 * owns the range and filters. Each widget is checked and rendered on its own: one that fails to
 * parse, query or render shows its own error, and the rest of the dashboard still renders.
 */
export function DashboardRenderer({ definition, scope, onDrilldown, kinds = [], className }: DashboardRendererProps) {
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

  return (
    <DashboardGrid className={className}>
      {rows.map((row, rowIndex) => (
        <DashboardGridRow key={rowIndex}>
          {row.widgets.map(widget => {
            const prepared = prepareWidget(widget, registry, scope);
            if (prepared.ok === 'hidden') return null;
            // Unparsed, the title may be anything; the error card shows it only when it's text.
            const heading = { id: widget.id, title: typeof widget.title === 'string' ? widget.title : undefined };
            return (
              <DashboardGridCell key={widget.id} id={widget.id} span={spanOf(widget)}>
                <ErrorBoundary
                  resetKeys={[pageKey, JSON.stringify(widget)]}
                  variant="inline"
                  fallback={({ error }) => <WidgetError widget={heading} message={error.message} />}
                >
                  {prepared.ok ? (
                    <prepared.kind.component
                      widget={prepared.widget}
                      views={prepared.views}
                      scope={scope}
                      onDrilldown={onDrilldown}
                    />
                  ) : (
                    <WidgetError widget={heading} message={prepared.message} />
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
