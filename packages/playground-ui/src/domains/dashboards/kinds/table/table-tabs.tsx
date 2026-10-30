import type { BlockedFields } from '../../components/view-gate';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import { useViewMenu } from '../../hooks/use-widget-views';
import { unsupportedMessage } from '../../lib/chrome';
import { buildRequest } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import { countRows, isValueColumn, openingView, parseColumns } from '../../lib/table';
import type { TableOptions } from '../../lib/table';
import { exprRefs } from '../../lib/values';
import type { WidgetKindProps } from '../../widget-kind';
import { TableFrame } from './table-frame';
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

/** The opener view's sorted column and every query it reads, when the opener can count its rows. */
function openerSource(views: Props['views'], blocked: BlockedFields) {
  const opener = views.find(v => v.options.openWhen);
  if (!opener || blocked(opener.queries)) return undefined;
  const column = parseColumns(opener.columns)
    .columns.filter(isValueColumn)
    .find(c => c.id === opener.options.defaultSort.column);
  if (!column) return undefined;
  const read = new Set(exprRefs(column.options.value).map(r => r.query));
  const queries = opener.queries.filter(q => q.id !== undefined && read.has(q.id));
  return queries.length > 0 && queries.length === read.size ? { view: opener, column, queries } : undefined;
}

export function TableTabs({ page, blocked, ...props }: Props & { page: DashboardPageContext; blocked: BlockedFields }) {
  // A view that opens only with enough rows counts them from its sorted column's own request, so
  // opening on it costs nothing more.
  const opener = openerSource(props.views, blocked);
  const openerResults = useDashboardRequests(opener?.queries.map(q => buildRequest(q, page, {})) ?? []);
  const rows = opener
    ? countRows(
        opener.view.options,
        opener.column,
        opener.queries,
        openerResults.map(r => r?.data),
      )
    : 'uncountable';
  const { view, index, heading } = useViewMenu(props.widget, props.views, openingView(props.views, rows));

  const unsupported = blocked(view.queries);
  if (unsupported) {
    return (
      <TableFrame heading={heading}>
        <MetricsCard.NoData message={unsupportedMessage(unsupported, FILTER_NAMES)} />
      </TableFrame>
    );
  }
  return <TableView key={index} {...props} view={view} heading={heading} page={page} />;
}
