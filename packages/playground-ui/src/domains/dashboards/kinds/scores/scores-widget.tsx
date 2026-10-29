import type { DashboardQuery } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChartArea } from '../../../metrics/components/chart-area';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { BUCKET_AXIS } from '../../../metrics/lib/chart-axis';
import { CHART_COLORS } from '../../../metrics/lib/chart-colors';
import { bucketGrid, bucketPlan, gridIndex, intervalHours } from '../../../metrics/lib/metrics-buckets';
import type { BucketLabels } from '../../../metrics/lib/metrics-buckets';
import { ViewGate } from '../../components/view-gate';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import { seriesOf, valueOf } from '../../lib/answers';
import { viewHeading } from '../../lib/chrome';
import { FORMATTERS } from '../../lib/format';
import { buildRequest } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import type { ScoresOptions } from './options';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsLineChart } from '@/ds/components/MetricsLineChart';

/** Scores aren't problems, so no warm hues; past five scorers the colors repeat. */
const SCORER_COLORS = [
  CHART_COLORS.green,
  CHART_COLORS.sky,
  CHART_COLORS.violet,
  CHART_COLORS.teal,
  CHART_COLORS.indigo,
];

/** How many recent scores to read to find the scorers in the range (the API's page limit). */
const DISCOVERY_PAGE_SIZE = 100;

const needsScorer = (query: DashboardQuery | undefined) => query?.source === 'scores' && query.scorerId === undefined;

/**
 * The scorers to chart: the queries' own scorer, or, when they leave it out, every scorer among the
 * range's most recent scores, as the Scores card finds them (the API can't list scorers).
 */
function useScorers(view: ResolvedView<ScoresOptions>, page: DashboardPageContext) {
  const client = useMastraClient();
  const discover = view.queries.some(needsScorer);
  const args = { filters: page.filters, pagination: { page: 0, perPage: DISCOVERY_PAGE_SIZE } };
  const recent = useQuery({
    queryKey: ['dashboards', 'listScores', args],
    queryFn: () => client.listScores(args),
    placeholderData: keepPreviousData,
    enabled: discover,
  });
  if (!discover) {
    const own = view.queries.find(q => q.source === 'scores' && q.scorerId);
    const scorerId = own?.source === 'scores' ? own.scorerId : undefined;
    return { recent, scorers: scorerId ? [{ scorerId, name: scorerId }] : [] };
  }
  const names = new Map((recent.data?.scores ?? []).map(s => [s.scorerId, s.scorerName ?? s.scorerId]));
  const scorers = [...names.keys()].toSorted().map(scorerId => ({ scorerId, name: names.get(scorerId) ?? scorerId }));
  return { recent: discover ? recent : undefined, scorers };
}

/** The query for one scorer: its own scorer if it names one, else `scorerId`. */
const withScorer = (query: DashboardQuery | undefined, scorerId: string): DashboardQuery | undefined =>
  query?.source === 'scores' && query.scorerId === undefined ? { ...query, scorerId } : query;

export function ScoresWidget({ widget, views }: WidgetKindProps<ScoresOptions>) {
  const [view] = views;
  return (
    <ViewGate queries={view.queries} pending={() => null}>
      {page => <ScoresView heading={viewHeading(widget, view)} view={view} page={page} />}
    </ViewGate>
  );
}

function ScoresView({
  heading,
  view,
  page,
}: {
  heading: ReturnType<typeof viewHeading>;
  view: ResolvedView<ScoresOptions>;
  page: DashboardPageContext;
}) {
  const { options } = view;
  const { interval } = bucketPlan(page.window.start, page.window.end);
  const stepHours = intervalHours(interval);
  const { recent, scorers } = useScorers(view, page);
  const average = view.queries.find(q => q.id === options.average);
  const series = view.queries.find(q => q.id === options.series);
  const send = (query: DashboardQuery | undefined, scorerId: string, bucket?: typeof interval) => {
    const own = withScorer(query, scorerId);
    return own && buildRequest(own, page, { interval: bucket });
  };
  // One answer per scorer in each list, in `scorers`' order.
  const means = useDashboardRequests(scorers.map(({ scorerId }) => send(average, scorerId)));
  const points = useDashboardRequests(scorers.map(({ scorerId }) => send(series, scorerId, interval)));

  const all = [recent, ...means, ...points].filter(r => r !== undefined);
  if (all.some(r => r.isError)) {
    return (
      <ChartCard {...heading}>
        <ChartCardError />
      </ChartCard>
    );
  }

  const isLoading = all.some(r => r.isLoading);
  const shown = isLoading ? [] : scorers;
  const buckets: (BucketLabels & Record<string, number | string | undefined>)[] = bucketGrid(
    page.window.start,
    page.window.end,
    stepHours,
  );
  const indexOf = gridIndex(buckets, stepHours);
  const lines: MetricsLineChartSeries[] = shown.map(({ scorerId, name }, i) => {
    const mean = valueOf(means[i]?.data)?.value ?? 0;
    for (const s of seriesOf(points[i]?.data) ?? []) {
      for (const p of s.points) {
        const bucket = buckets[indexOf(p) ?? -1];
        if (bucket) bucket[scorerId] = p.value;
      }
    }
    return {
      dataKey: scorerId,
      label: name,
      color: SCORER_COLORS[i % SCORER_COLORS.length] ?? CHART_COLORS.neutral,
      aggregate: () => ({ value: FORMATTERS.score.value(mean) }),
    };
  });

  return (
    <ChartCard
      {...heading}
      summary={
        <MetricsCard.Summary
          value={String(shown.length)}
          label={shown.length === 1 ? 'scorer' : 'scorers'}
          isLoading={isLoading}
        />
      }
      isUpdating={all.some(r => r.isPlaceholderData)}
    >
      <ChartArea isEmpty={!isLoading && shown.length === 0} emptyMessage={options.emptyMessage}>
        <MetricsLineChart
          data={isLoading ? [] : buckets}
          series={lines}
          height="fill"
          yDomain={[0, 1]}
          valueFormatter={FORMATTERS.score.value}
          axisFormatter={FORMATTERS.score.axis}
          isLoading={isLoading}
          {...BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
