import type { DashboardWidget } from '@mastra/client-js';
import { ChartCard } from '../../metrics/components/chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';

/** A widget that can't render: its own card, so the rest of the dashboard still does. */
export function WidgetError({ widget, message }: { widget: Pick<DashboardWidget, 'id' | 'title'>; message: string }) {
  return (
    <ChartCard title={widget.title ?? widget.id}>
      <MetricsCard.Error message={message} className="h-full" />
    </ChartCard>
  );
}
