import { defineWidgetKind } from '../../widget-kind';
import { tableCheck } from '../checks';
import { tableDiscover, tableRequests } from './table-plan';
import { TableWidget } from './table-widget';

export { tableColumnOptionsSchema, tableOptionsSchema } from '../../lib/table';
export type { TableColumnOptions, TableOptions } from '../../lib/table';

/** Groups joined across the view's queries as a sortable table, with change against the previous window. */
export const tableKind = defineWidgetKind({
  ...tableCheck,
  partial: true,
  discover: tableDiscover,
  requests: tableRequests,
  component: TableWidget,
});
