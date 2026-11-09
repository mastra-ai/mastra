import { defineWidgetKind } from '../../widget-kind';
import { kpisCheck } from '../checks';
import { kpisGatedQueries, kpisRequests } from './kpis-plan';
import { KpisWidget } from './kpis-widget';

export { kpiFigures, kpisOptionsSchema } from './options';
export type { KpiFigures, KpisOptions } from './options';

/** A row of headline numbers, each against the previous window. */
export const kpisKind = defineWidgetKind({
  ...kpisCheck,
  gatedQueries: kpisGatedQueries,
  requests: kpisRequests,
  component: KpisWidget,
});
