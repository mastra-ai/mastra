import type { ReactNode } from 'react';
import { ChartCard } from '../../../metrics/components/chart-card';
import type { ViewHeading } from '../../lib/chrome';
import type { TableOptions } from '../../lib/table';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';

export type TableTabProps = WidgetKindProps<TableOptions> & {
  view: ResolvedView<TableOptions>;
  heading: ViewHeading;
};

/** The table's card: the widget's title, with every view a tab under it when there are several. Its rows dim themselves while they refetch. */
export function TableFrame({ heading, children }: Pick<TableTabProps, 'heading'> & { children: ReactNode }) {
  return (
    <ChartCard {...heading} bodyHeight="fit">
      {children}
    </ChartCard>
  );
}
