import type { BlockedFields } from '../../lib/gate';
import { buildPreviousRequest, buildRequest } from '../../lib/requests';
import type { DashboardResult } from '../../lib/requests';
import { countRows, isValueColumn, openingView, parseColumns } from '../../lib/table';
import type { TableOptions } from '../../lib/table';
import { exprRefs } from '../../lib/values';
import type { WidgetKindProps, WidgetPlanContext, WidgetState } from '../../widget-kind';

type Views = WidgetKindProps<TableOptions>['views'];

/** The opener view's sorted column and every query it reads, when the opener can count its rows. */
function openerSource(views: Views, blocked: BlockedFields) {
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

/**
 * A view that opens only with enough rows counts them from its sorted column's own requests, so
 * opening on it costs nothing more.
 */
export function tableDiscover({ views, page, blocked }: WidgetPlanContext<TableOptions>) {
  return openerSource(views, blocked)?.queries.map(q => buildRequest(q, page, {})) ?? [];
}

/** The open tab: the one picked, else the one the opener's row count opens on. */
export function openTab(
  views: Views,
  blocked: BlockedFields,
  state: WidgetState,
  discovered: (DashboardResult | undefined)[],
) {
  if (state.view !== undefined) return state.view;
  const opener = openerSource(views, blocked);
  const rows = opener
    ? countRows(
        opener.view.options,
        opener.column,
        opener.queries,
        discovered.map(r => r?.data),
      )
    : 'uncountable';
  return openingView(views, rows);
}

/**
 * The open tab's requests, then the same over the previous window for its % Change; a tab whose
 * aggregates can't apply the page's filters sends nothing.
 */
export function tableRequests(
  { views, page, blocked, state }: WidgetPlanContext<TableOptions>,
  discovered: (DashboardResult | undefined)[],
) {
  const view = views[openTab(views, blocked, state, discovered)] ?? views[0];
  if (blocked(view.queries)) return [];
  return [
    ...view.queries.map(q => buildRequest(q, page, {})),
    ...view.queries.map(q => buildPreviousRequest(q, page, {})),
  ];
}
