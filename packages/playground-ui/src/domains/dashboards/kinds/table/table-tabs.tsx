import { viewMenu } from '../../hooks/use-widget-views';
import { alertAction, withAction } from '../../lib/alert-actions';
import { unsupportedMessage } from '../../lib/chrome';
import type { BlockedFields } from '../../lib/gate';
import type { DashboardPageContext } from '../../lib/requests';
import { isValueColumn, parseColumns } from '../../lib/table';
import type { TableOptions } from '../../lib/table';
import type { WidgetKindProps } from '../../widget-kind';
import { TableFrame } from './table-frame';
import { openTab } from './table-plan';
import { TableView } from './table-view';
import { MetricsCard } from '@/ds/components/MetricsCard';

type Props = WidgetKindProps<TableOptions>;

/** Filters an aggregate can't apply, named as the filter bar names them. */
const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
  tags: 'tags',
  provider: 'provider',
  model: 'model',
};

export function TableTabs({ page, blocked, ...props }: Props & { page: DashboardPageContext; blocked: BlockedFields }) {
  const { views, state, discovered, onStateChange } = props;
  // Picking a tab starts it on its own default sort.
  const menu = viewMenu(props.widget, views, openTab(views, blocked, state, discovered), i =>
    onStateChange({ view: i }),
  );
  const { view, index } = menu;
  const unsupported = blocked(view.queries);
  const alert = alertAction(
    props.alert,
    props.widget,
    view,
    unsupported
      ? { blocked: unsupported, names: FILTER_NAMES }
      : {
          page,
          values: parseColumns(view.columns)
            .columns.filter(isValueColumn)
            .map(c => ({ label: c.label, value: c.options.value })),
        },
  );
  const heading = withAction(
    {
      ...menu.heading,
      dragHandle: props.dragHandle,
      onTitleChange: props.onTitleChange,
      actions: props.actions,
    },
    alert,
  );

  if (unsupported) {
    return (
      <TableFrame heading={heading}>
        <MetricsCard.NoData message={unsupportedMessage(unsupported, FILTER_NAMES)} />
      </TableFrame>
    );
  }
  // Unkeyed: picking a tab clears `sort` and `compared` in the widget state. Local state added to
  // `TableView` would carry over to the next tab instead, so key it on `index` if that happens.
  return <TableView {...props} index={index} view={view} heading={heading} page={page} />;
}
