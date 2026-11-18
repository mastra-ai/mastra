import { buildPreviousRequest, buildRequest } from '../../lib/requests';
import type { WidgetPlanContext } from '../../widget-kind';
import type { KpisOptions } from './options';

/**
 * One request per query of the first view, the only one KPIs show, then the previous window's for
 * the queries that compare with one of its own (metrics and scores aggregates compare in theirs).
 */
export const kpisRequests = ({ views: [view], page }: WidgetPlanContext<KpisOptions>) => [
  ...view.queries.map(q => buildRequest(q, page, {})),
  ...view.queries.map(q => buildPreviousRequest(q, page, {})),
];

/** KPIs only ever show their first view, so only its queries are gated. */
export const kpisGatedQueries = ([view]: WidgetPlanContext<KpisOptions>['views']) => view.queries;
