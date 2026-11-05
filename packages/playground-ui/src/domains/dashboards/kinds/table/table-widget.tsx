import { ChartCard } from '../../../metrics/components/chart-card';
import { pinActions } from '../../lib/pin-actions';
import type { TableOptions } from '../../lib/table';
import type { WidgetKindProps } from '../../widget-kind';
import { TableTabs } from './table-tabs';
import { MetricsCard } from '@/ds/components/MetricsCard';

/**
 * Groups as a sortable table, one view per tab. It waits on the aggregate gates every tab needs, so tabs
 * don't come and go; a tab whose gate can't apply the page's filters says so.
 */
export function TableWidget(props: WidgetKindProps<TableOptions>) {
  const { gate } = props;
  if (gate.status === 'pending') {
    return (
      <ChartCard
        title={props.widget.title ?? ''}
        dragHandle={props.dragHandle}
        {...pinActions(props.pin)}
        bodyHeight="fit"
      >
        <MetricsCard.Loading />
      </ChartCard>
    );
  }
  return <TableTabs {...props} page={gate.page} blocked={gate.blocked} />;
}
