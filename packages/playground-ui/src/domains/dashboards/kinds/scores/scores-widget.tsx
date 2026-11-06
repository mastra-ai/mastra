import { ChartArea } from '../../../metrics/components/chart-area';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { BUCKET_AXIS } from '../../../metrics/lib/chart-axis';
import { CHART_COLORS } from '../../../metrics/lib/chart-colors';
import { bucketPlan, intervalHours } from '../../../metrics/lib/metrics-buckets';
import { PendingChartCard } from '../../components/widget-chrome';
import { alertAction, pendingHeading, withAction } from '../../lib/alert-actions';
import { viewTitle } from '../../lib/chrome';
import type { ViewHeading } from '../../lib/chrome';
import { FORMATTERS } from '../../lib/format';
import { pinActions } from '../../lib/pin-actions';
import type { DashboardPageContext, DashboardResult } from '../../lib/requests';
import { scorersOf, shapeScores } from '../../lib/scores';
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

export function ScoresWidget({
  widget,
  views,
  gate,
  discovered,
  results,
  onRetry,
  expand,
  dragHandle,
  pin,
  alert,
}: WidgetKindProps<ScoresOptions>) {
  const [view] = views;
  // Scores show their first view only, so the title is plain or, with somewhere to expand to, a link.
  const heading = {
    ...viewTitle(widget, [view], 0, () => {}, expand),
    dragHandle,
    ...pinActions(pin),
  };
  // The card, and its pin, stay while the view waits, so a pinned widget can still be unpinned.
  if (gate.status === 'pending')
    return <PendingChartCard gate={gate.gate} heading={pendingHeading(heading, gate.gate, alert, widget, view)} />;
  return (
    <ScoresView
      heading={withAction(
        heading,
        // The scorers' means over the range: what the card's lines average to.
        alertAction(alert, widget, view, {
          page: gate.page,
          values: [
            { label: view.label?.trim() || widget.title?.trim() || 'Scores', value: { query: view.options.average } },
          ],
        }),
      )}
      view={view}
      page={gate.page}
      discovered={discovered}
      results={results}
      onRetry={onRetry}
    />
  );
}

function ScoresView({
  heading,
  view,
  page,
  discovered,
  results,
  onRetry,
}: {
  heading: ViewHeading;
  view: ResolvedView<ScoresOptions>;
  page: DashboardPageContext;
  discovered: (DashboardResult | undefined)[];
  results: (DashboardResult | undefined)[];
  onRetry: () => void;
}) {
  const { options } = view;
  const { interval } = bucketPlan(page.window.start, page.window.end);
  const stepHours = intervalHours(interval);
  const scorers = scorersOf(view.queries, discovered[0]?.data);
  // One answer per scorer in each list, in `scorers`' order.
  const means = results.slice(0, scorers.length);
  const points = results.slice(scorers.length, scorers.length * 2);

  const all = [...discovered, ...results].filter(r => r !== undefined);
  const failed = all.filter(r => r.isError);
  if (failed.length > 0) {
    return (
      <ChartCard {...heading}>
        <ChartCardError error={failed[0]?.error} onRetry={onRetry} />
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
    <ChartCard {...heading} isUpdating={all.some(r => r.isRefetching)}>
      <ChartArea isEmpty={!isLoading && lines.length === 0} emptyMessage={options.emptyMessage}>
        <MetricsLineChart
          lineStyle="thin"
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
