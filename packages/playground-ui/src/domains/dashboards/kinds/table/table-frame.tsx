import type { ReactNode } from 'react';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ViewTabs } from '../../components/widget-controls';
import { viewHeading } from '../../lib/chrome';
import type { TableOptions } from '../../lib/table';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { MetricsCard } from '@/ds/components/MetricsCard';

export type TableTabProps = WidgetKindProps<TableOptions> & {
  view: ResolvedView<TableOptions>;
  index: number;
  onChoose: (index: number) => void;
};

/** The table's card: the chosen view's heading, with a tab per view in the toolbar. */
export function TableFrame({
  widget,
  views,
  view,
  index,
  onChoose,
  isUpdating,
  children,
}: TableTabProps & { isUpdating?: boolean; children: ReactNode }) {
  return (
    <ChartCard
      {...viewHeading(widget, view)}
      isUpdating={isUpdating}
      bodyHeight="fit"
      toolbar={
        <MetricsCard.Toolbar>
          <ViewTabs views={views} index={index} onChoose={onChoose} />
        </MetricsCard.Toolbar>
      }
    >
      {children}
    </ChartCard>
  );
}
