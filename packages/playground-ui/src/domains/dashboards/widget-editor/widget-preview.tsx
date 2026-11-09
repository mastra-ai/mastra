import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import { ChartCard } from '../../metrics/components/chart-card';
import { ConnectedWidget } from '../components/connected-widget';
import { WidgetError } from '../components/widget-error';
import { BUILT_IN_WIDGET_KINDS } from '../kinds';
import type { DashboardScope } from '../lib/definition';
import { prepareWidget } from '../lib/prepare-widget';
import { ErrorBoundary } from '@/ds/components/ErrorBoundary';
import { MetricsCard } from '@/ds/components/MetricsCard';

const REGISTRY = new Map(BUILT_IN_WIDGET_KINDS.map(k => [k.kind, k]));

export type WidgetPreviewProps = {
  /** The widget as it would be saved, holding only the view being edited. */
  widget: Pick<DashboardWidget, 'id' | 'span' | 'kind' | 'title'>;
  view: DashboardWidgetView | undefined;
  /** Why the view can't be drawn yet; shown in place of the card. */
  issue: string | undefined;
  scope: DashboardScope;
};

/** The active view drawn by its real kind, the way the page will draw it. */
export function WidgetPreview({ widget, view, issue, scope }: WidgetPreviewProps) {
  const title = widget.title || 'Untitled widget';
  if (!view) {
    return (
      <ChartCard title={title}>
        <MetricsCard.NoData message={issue ?? 'Add a metric to see a preview.'} className="h-full" />
      </ChartCard>
    );
  }

  const stored = { ...widget, title, views: [view] };
  const prepared = prepareWidget(stored, REGISTRY, scope);
  if (prepared.ok === 'hidden') return <WidgetError widget={stored} message="This view doesn't show at this scope." />;

  return (
    <ErrorBoundary
      resetKeys={[JSON.stringify(stored)]}
      variant="inline"
      fallback={({ error }) => <WidgetError widget={stored} message={error.message} />}
    >
      {prepared.ok ? (
        <ConnectedWidget prepared={prepared} scope={scope} />
      ) : (
        <WidgetError widget={stored} message={prepared.message} />
      )}
    </ErrorBoundary>
  );
}
