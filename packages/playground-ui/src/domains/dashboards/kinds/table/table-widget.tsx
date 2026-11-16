import { ChartCard } from '../../../metrics/components/chart-card';
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
        // Its loaded card titles several tabs with a menu, which can't be renamed.
        onTitleChange={props.views.length < 2 ? props.onTitleChange : undefined}
        actions={props.actions}
        bodyHeight="fit"
      >
        <MetricsCard.Loading />
      </ChartCard>
    );
  }
  return <TableTabs {...props} page={gate.page} blocked={gate.blocked} />;
}
