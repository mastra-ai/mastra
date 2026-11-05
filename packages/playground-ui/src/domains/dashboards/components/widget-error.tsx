import type { DashboardWidget } from '@mastra/client-js';
import { ChartCard } from '../../metrics/components/chart-card';
import { pinActions } from '../lib/pin-actions';
import type { WidgetPin } from '../widget-kind';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsCardDragHandleProps } from '@/ds/components/MetricsCard';

/** A widget that can't render: its own card, so the rest of the dashboard still does, and it can still be moved. */
export function WidgetError({
  widget,
  message,
  dragHandle,
  pin,
}: {
  widget: Pick<DashboardWidget, 'id' | 'title'>;
  message: string;
  dragHandle?: MetricsCardDragHandleProps;
  /** So a widget that broke after it was pinned can still be unpinned. */
  pin?: WidgetPin;
}) {
  return (
    <ChartCard title={widget.title ?? widget.id} dragHandle={dragHandle} {...pinActions(pin)}>
      <MetricsCard.Error message={message} className="h-full" />
    </ChartCard>
  );
}
