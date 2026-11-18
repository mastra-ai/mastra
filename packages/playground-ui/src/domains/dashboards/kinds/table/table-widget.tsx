import { ChartCard } from '../../../metrics/components/chart-card';
import { openingView } from '../../lib/table';
import type { TableOptions } from '../../lib/table';
import type { WidgetKindProps } from '../../widget-kind';
import { TableTabs } from './table-tabs';
import { withViewTabs } from './table-view-tabs';
import { MetricsCard } from '@/ds/components/MetricsCard';

/**
 * Groups as a sortable table, one view per tab. It waits on the aggregate gates every tab needs, so tabs
 * don't come and go; a tab whose gate can't apply the page's filters says so.
 */
export function TableWidget(props: WidgetKindProps<TableOptions>) {
  const { gate } = props;
  if (gate.status === 'pending') {
    // The tabs show while it loads, on the tab it will open: the pick when the widget still has that
    // view (as the loaded table falls back to the first), else the opener while its rows load.
    const picked = props.state.view;
    const opening = picked === undefined ? openingView(props.views, 'loading') : props.views[picked] ? picked : 0;
    const heading = withViewTabs({ title: props.widget.title ?? '' }, props.widget, props.views, opening, i =>
      props.onStateChange({ view: i }),
    );
    return (
      <ChartCard
        {...heading}
        dragHandle={props.dragHandle}
        onTitleChange={props.onTitleChange}
        actions={props.actions}
        bodyHeight="fit"
      >
        <MetricsCard.Loading />
      </ChartCard>
    );
  }
  return <TableTabs {...props} page={gate.page} blocked={gate.blocked} />;
}
