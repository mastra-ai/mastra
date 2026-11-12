import type { DashboardWidget } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { ChartCard } from '../../metrics/components/chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsCardDragHandleProps } from '@/ds/components/MetricsCard';

/**
 * A widget that can't render: its own card, so the rest of the dashboard still does, and it can still be
 * moved. It keeps the host's actions, so e.g. a widget that broke after it was pinned can still be unpinned.
 */
export function WidgetError({
  widget,
  message,
  dragHandle,
  actions,
}: {
  widget: Pick<DashboardWidget, 'id' | 'title'>;
  message: string;
  dragHandle?: MetricsCardDragHandleProps;
  actions?: ReactNode;
}) {
  return (
    <ChartCard title={widget.title ?? widget.id} dragHandle={dragHandle} actions={actions}>
      <MetricsCard.Error message={message} className="h-full" />
    </ChartCard>
  );
}
