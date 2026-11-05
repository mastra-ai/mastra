import { bucketPlan } from '../../../metrics/lib/metrics-buckets';
import { buildRequest } from '../../lib/requests';
import type { TimeseriesOptions } from '../../lib/timeseries';
import type { WidgetPlanContext, WidgetState } from '../../widget-kind';

const openView = (views: WidgetPlanContext<TimeseriesOptions>['views'], state: WidgetState) =>
  views[state.view ?? 0] ?? views[0];

/** Only the open view is gated: a closed view's trace query mustn't hold up a metrics one. */
export const timeseriesGatedQueries = (views: WidgetPlanContext<TimeseriesOptions>['views'], state: WidgetState) =>
  openView(views, state).queries;

/** The open view's requests; totals span the whole window, so they ask for no buckets. */
export function timeseriesRequests({ views, page, state }: WidgetPlanContext<TimeseriesOptions>) {
  const view = openView(views, state);
  const { interval } = bucketPlan(page.window.start, page.window.end);
  const totals = new Set(view.options.totals ?? []);
  return view.queries.map(q =>
    buildRequest(q, page, { interval: q.id !== undefined && totals.has(q.id) ? undefined : interval }),
  );
}
