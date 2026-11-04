import type { DashboardWidget } from '@mastra/client-js';
import { ChartCard } from '../../metrics/components/chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsCardDragHandleProps } from '@/ds/components/MetricsCard';

/** A widget that can't render: its own card, so the rest of the dashboard still does, and it can still be moved. */
export function WidgetError({
  widget,
  message,
  dragHandle,
}: {
  widget: Pick<DashboardWidget, 'id' | 'title'>;
  message: string;
  dragHandle?: MetricsCardDragHandleProps;
}) {
  return (
    <ChartCard title={widget.title ?? widget.id} dragHandle={dragHandle}>
      <MetricsCard.Error message={message} className="h-full" />
    </ChartCard>
  );
}
