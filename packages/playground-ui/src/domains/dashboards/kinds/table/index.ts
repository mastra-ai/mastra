import { tableIssues, tableOptionsSchema } from '../../lib/table';
import { defineWidgetKind } from '../../widget-kind';
import { TableWidget } from './table-widget';

export { tableColumnOptionsSchema, tableOptionsSchema } from '../../lib/table';
export type { TableColumnOptions, TableOptions } from '../../lib/table';

/** Groups joined across the view's queries as a sortable table, with change against the previous window. */
export const tableKind = defineWidgetKind({
  kind: 'table',
  optionsSchema: tableOptionsSchema,
  issues: view => tableIssues(view.columns, view.options, view.queries),
  component: TableWidget,
});
