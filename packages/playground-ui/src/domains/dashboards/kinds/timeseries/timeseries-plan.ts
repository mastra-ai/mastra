import { bucketPlan } from '../../../metrics/lib/metrics-buckets';
import { buildRequest } from '../../lib/requests';
import type { TimeseriesOptions } from '../../lib/timeseries';
import type { WidgetPlanContext } from '../../widget-kind';

/** The open view's requests; totals span the whole window, so they ask for no buckets. */
export function timeseriesRequests({ views, page, state }: WidgetPlanContext<TimeseriesOptions>) {
  const view = views[state.view ?? 0] ?? views[0];
  const { interval } = bucketPlan(page.window.start, page.window.end);
  const totals = new Set(view.options.totals ?? []);
  return view.queries.map(q =>
    buildRequest(q, page, { interval: q.id !== undefined && totals.has(q.id) ? undefined : interval }),
  );
}
