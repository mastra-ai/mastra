import type { DashboardQuery } from '@mastra/client-js';
import { ChartArea } from '../../../metrics/components/chart-area';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { BUCKET_AXIS } from '../../../metrics/lib/chart-axis';
import { CHART_COLORS } from '../../../metrics/lib/chart-colors';
import { bucketPlan, intervalHours } from '../../../metrics/lib/metrics-buckets';
import { ViewGate } from '../../components/view-gate';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import { useScorers } from '../../hooks/use-scorers';
import { FORMATTERS } from '../../lib/format';
import { buildRequest } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import { shapeScores, withScorer } from '../../lib/scores';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import type { ScoresOptions } from './options';
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

export function ScoresWidget({ widget, views }: WidgetKindProps<ScoresOptions>) {
  const [view] = views;
  return (
    <ViewGate queries={view.queries} pending={() => null}>
      {page => <ScoresView title={widget.title ?? ''} view={view} page={page} />}
    </ViewGate>
  );
}

function ScoresView({
  title,
  view,
  page,
}: {
  title: string;
  view: ResolvedView<ScoresOptions>;
  page: DashboardPageContext;
}) {
  const { options } = view;
  const { interval } = bucketPlan(page.window.start, page.window.end);
  const stepHours = intervalHours(interval);
  const { recent, scorers } = useScorers(view.queries, page);
  const averageQuery = view.queries.find(q => q.id === options.average);
  const seriesQuery = view.queries.find(q => q.id === options.series);
  const send = (query: DashboardQuery | undefined, scorerId: string, bucket?: typeof interval) => {
    const own = withScorer(query, scorerId);
    return own && buildRequest(own, page, { interval: bucket });
  };
  // One answer per scorer in each list, in `scorers`' order.
  const means = useDashboardRequests(scorers.map(({ scorerId }) => send(averageQuery, scorerId)));
  const points = useDashboardRequests(scorers.map(({ scorerId }) => send(seriesQuery, scorerId, interval)));

  const all = [recent, ...means, ...points].filter(r => r !== undefined);
  const failed = all.filter(r => r.isError);
  if (failed.length > 0) {
    return (
      <ChartCard title={title}>
        <ChartCardError error={failed[0]?.error} onRetry={() => failed.forEach(r => void r.refetch())} />
      </ChartCard>
    );
  }

  const isLoading = all.some(r => r.isLoading);
  const { buckets, lines } = shapeScores(
    isLoading ? [] : scorers,
    means.map(r => r?.data),
    points.map(r => r?.data),
    page.window,
    stepHours,
  );
  const series: MetricsLineChartSeries[] = lines.map(({ scorerId, name }, i) => ({
    dataKey: scorerId,
    label: name,
    color: SCORER_COLORS[i % SCORER_COLORS.length] ?? CHART_COLORS.neutral,
  }));

  return (
    <ChartCard title={title} isUpdating={all.some(r => r.isRefetching)}>
      <ChartArea isEmpty={!isLoading && lines.length === 0} emptyMessage={options.emptyMessage}>
        <MetricsLineChart
          data={isLoading ? [] : buckets}
          series={series}
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
