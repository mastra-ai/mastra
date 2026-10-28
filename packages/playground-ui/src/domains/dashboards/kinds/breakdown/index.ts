import { breakdownIssues, breakdownOptionsSchema } from '../../lib/breakdown';
import { defineWidgetKind } from '../../widget-kind';
import { BreakdownWidget } from './breakdown-widget';

export { breakdownOptionsSchema, BREAKDOWN_COLUMN_IDS } from '../../lib/breakdown';
export type { BreakdownColumnId, BreakdownOptions } from '../../lib/breakdown';

/** Groups joined across the view's queries, with change against the previous window. */
export const breakdownKind = defineWidgetKind({
  kind: 'breakdown',
  optionsSchema: breakdownOptionsSchema,
  issues: view => breakdownIssues(view.columns, view.queries),
  component: BreakdownWidget,
});
