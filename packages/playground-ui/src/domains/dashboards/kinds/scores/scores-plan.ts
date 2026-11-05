import type { DashboardQuery } from '@mastra/client-js';
import { bucketPlan } from '../../../metrics/lib/metrics-buckets';
import { buildRequest } from '../../lib/requests';
import type { DashboardResult } from '../../lib/requests';
import { scorerDiscoveryRequest, scorersOf, withScorer } from '../../lib/scores';
import type { WidgetPlanContext } from '../../widget-kind';
import type { ScoresOptions } from './options';

/** Scores chart their first view only, so only its queries are gated. */
export const scoresGatedQueries = ([view]: WidgetPlanContext<ScoresOptions>['views']) => view.queries;

/** Finds the scorers to chart, when the queries don't name their own. */
export const scoresDiscover = ({ views: [view], page }: WidgetPlanContext<ScoresOptions>) => [
  scorerDiscoveryRequest(view.queries, page),
];

/** Each scorer's mean, then each scorer's points, in the discovered scorers' order. */
export function scoresRequests(
  { views: [view], page }: WidgetPlanContext<ScoresOptions>,
  discovered: (DashboardResult | undefined)[],
) {
  const { options } = view;
  const { interval } = bucketPlan(page.window.start, page.window.end);
  const scorers = scorersOf(view.queries, discovered[0]?.data);
  const averageQuery = view.queries.find(q => q.id === options.average);
  const seriesQuery = view.queries.find(q => q.id === options.series);
  const send = (query: DashboardQuery | undefined, scorerId: string, bucket?: typeof interval) => {
    const own = withScorer(query, scorerId);
    return own && buildRequest(own, page, { interval: bucket });
  };
  return [
    ...scorers.map(({ scorerId }) => send(averageQuery, scorerId)),
    ...scorers.map(({ scorerId }) => send(seriesQuery, scorerId, interval)),
  ];
}
