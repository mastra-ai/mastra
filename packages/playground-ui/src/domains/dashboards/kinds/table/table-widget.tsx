import { ChartCard } from '../../../metrics/components/chart-card';
import { ViewGate } from '../../components/view-gate';
import type { TableOptions } from '../../lib/table';
import type { WidgetKindProps } from '../../widget-kind';
import { TableTabs } from './table-tabs';
import { MetricsCard } from '@/ds/components/MetricsCard';

/**
 * Groups as a sortable table, one view per tab. It waits on the aggregate gates every tab needs, so tabs
 * don't come and go; a tab whose gate can't apply the page's filters says so.
 */
export function TableWidget(props: WidgetKindProps<TableOptions>) {
  return (
    <ViewGate
      queries={props.views.flatMap(v => v.queries)}
      partial
      pending={() => (
        <ChartCard title={props.widget.title ?? ''} bodyHeight="fit">
          <MetricsCard.Loading />
        </ChartCard>
      )}
    >
      {(page, blocked) => <TableTabs {...props} page={page} blocked={blocked} />}
    </ViewGate>
  );
}
