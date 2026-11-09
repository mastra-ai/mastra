import type { ReactNode } from 'react';
import { ChartCard } from '../../../metrics/components/chart-card';
import type { ViewHeading } from '../../lib/chrome';
import type { TableOptions } from '../../lib/table';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';

export type TableTabProps = WidgetKindProps<TableOptions> & {
  view: ResolvedView<TableOptions>;
  heading: ViewHeading;
};

/** The table's card: the open view's title, as a menu of every view when there are several. */
export function TableFrame({
  heading,
  isUpdating,
  children,
}: Pick<TableTabProps, 'heading'> & { isUpdating?: boolean; children: ReactNode }) {
  return (
    <ChartCard {...heading} isUpdating={isUpdating} bodyHeight="fit">
      {children}
    </ChartCard>
  );
}
