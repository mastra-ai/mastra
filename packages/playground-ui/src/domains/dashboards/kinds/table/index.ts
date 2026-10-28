import { tableIssues, tableOptionsSchema } from '../../lib/table';
import { defineWidgetKind } from '../../widget-kind';
import { TableWidget } from './table-widget';

export { tableOptionsSchema, TABLE_COLUMN_IDS } from '../../lib/table';
export type { TableColumnId, TableOptions } from '../../lib/table';

/** Groups joined across the view's queries, with change against the previous window. */
export const tableKind = defineWidgetKind({
  kind: 'table',
  optionsSchema: tableOptionsSchema,
  issues: view => tableIssues(view.columns, view.queries),
  component: TableWidget,
});
