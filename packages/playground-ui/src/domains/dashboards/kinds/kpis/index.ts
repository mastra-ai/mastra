import { defineWidgetKind } from '../../widget-kind';
import { kpisRequests } from './kpis-plan';
import { KpisWidget } from './kpis-widget';
import { kpisIssues, kpisOptionsSchema } from './options';

export { kpiFigures, kpisOptionsSchema } from './options';
export type { KpiFigures, KpisOptions } from './options';

/** A row of headline numbers, each against the previous window. */
export const kpisKind = defineWidgetKind({
  kind: 'kpis',
  optionsSchema: kpisOptionsSchema,
  issues: kpisIssues,
  requests: kpisRequests,
  component: KpisWidget,
});
