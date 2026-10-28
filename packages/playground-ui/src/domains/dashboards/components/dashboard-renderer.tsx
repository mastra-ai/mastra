import type { DashboardDefinition, DashboardWidget } from '@mastra/client-js';
import { dashboardDefinitionEnvelopeSchema } from '@mastra/core/storage';
import { useMetricsScope } from '../../metrics/hooks/use-metrics-scope';
import { BUILT_IN_WIDGET_KINDS } from '../kinds';
import type { DashboardScope, OnDashboardDrilldown } from '../lib/definition';
import { describeIssue, prepareWidget } from '../lib/prepare-widget';
import type { AnyWidgetKind } from '../widget-kind';
import { DashboardGrid, DashboardGridCell, DashboardGridRow } from './dashboard-grid';
import type { DashboardSpan } from './dashboard-grid';
import { WidgetError } from './widget-error';
import { ErrorBoundary } from '@/ds/components/ErrorBoundary';
import { MetricsCard } from '@/ds/components/MetricsCard';

export type DashboardRendererProps = {
  definition: DashboardDefinition;
  /** Opens a drilldown; each host routes to its own Traces or Logs page. */
  onDrilldown?: OnDashboardDrilldown;
  /** Kinds beyond the built-in ones; a kind of the same name replaces the built-in. */
  kinds?: AnyWidgetKind[];
  className?: string;
};

const SPANS = new Set<unknown>([1, 2, 3, 4, 6, 12]);
const spanOf = (widget: DashboardWidget): DashboardSpan => (SPANS.has(widget.span) ? widget.span : 12);

/**
 * Lays a dashboard definition out on a 12-column grid inside the page's `MetricsProvider`, which
 * owns the range and filters. Each widget is checked and rendered on its own: one that fails to
 * parse, query or render shows its own error, and the rest of the dashboard still renders.
 */
export function DashboardRenderer({ definition, onDrilldown, kinds = [], className }: DashboardRendererProps) {
  const { projectLabel } = useMetricsScope();
  const scope: DashboardScope = projectLabel ? 'org' : 'project';
  const registry = new Map([...BUILT_IN_WIDGET_KINDS, ...kinds].map(k => [k.kind, k]));

  const envelope = dashboardDefinitionEnvelopeSchema.safeParse(definition);
  if (!envelope.success) {
    return <MetricsCard.Error message={`This dashboard can't be shown. ${describeIssue(envelope.error.issues[0])}`} />;
  }

  return (
    <DashboardGrid className={className}>
      {definition.rows.map((row, rowIndex) => (
        <DashboardGridRow key={rowIndex}>
          {row.widgets.map(widget => {
            const prepared = prepareWidget(widget, registry, scope);
            if (prepared.ok === 'hidden') return null;
            return (
              <DashboardGridCell key={widget.id} id={widget.id} span={spanOf(widget)}>
                <ErrorBoundary
                  variant="inline"
                  fallback={({ error }) => <WidgetError widget={widget} message={error.message} />}
                >
                  {prepared.ok ? (
                    <prepared.kind.component
                      widget={widget}
                      views={prepared.views}
                      scope={scope}
                      onDrilldown={onDrilldown}
                    />
                  ) : (
                    <WidgetError widget={widget} message={prepared.message} />
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
