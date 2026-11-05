import { buildRequest } from '../../lib/requests';
import type { WidgetPlanContext } from '../../widget-kind';
import type { KpisOptions } from './options';

/** One request per query of the first view, the only one KPIs show. */
export const kpisRequests = ({ views: [view], page }: WidgetPlanContext<KpisOptions>) =>
  view.queries.map(q => buildRequest(q, page, {}));

/** KPIs only ever show their first view, so only its queries are gated. */
export const kpisGatedQueries = ([view]: WidgetPlanContext<KpisOptions>['views']) => view.queries;
