import { defineWidgetKind } from '../../widget-kind';
import { kpisGatedQueries, kpisRequests } from './kpis-plan';
import { KpisWidget } from './kpis-widget';
import { kpisIssues, kpisOptionsSchema } from './options';

export { KPI_ICONS, kpiFigures, kpiItemSchema, kpisOptionsSchema } from './options';
export type { KpiFigures, KpiIcon, KpiItem, KpisOptions } from './options';

/** A row of headline numbers, each against the previous window. */
export const kpisKind = defineWidgetKind({
  kind: 'kpis',
  optionsSchema: kpisOptionsSchema,
  issues: kpisIssues,
  gatedQueries: kpisGatedQueries,
  requests: kpisRequests,
  component: KpisWidget,
});
