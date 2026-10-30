import { ChartArea } from '../../../metrics/components/chart-area';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { BUCKET_AXIS, EDGE_BUCKET_AXIS } from '../../../metrics/lib/chart-axis';
import { bucketPlan, bucketWindow } from '../../../metrics/lib/metrics-buckets';
import { ViewGate } from '../../components/view-gate';
import { PendingChartCard } from '../../components/widget-chrome';
import { DrilldownAction } from '../../components/widget-controls';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import { hasDrilldownAction, useDrilldown, useViewMenu } from '../../hooks/use-widget-views';
import type { ViewHeading } from '../../lib/chrome';
import { chartColor, FORMATTERS } from '../../lib/format';
import { buildRequest } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import { shapeTimeseries } from '../../lib/timeseries';
import type { TimeseriesOptions } from '../../lib/timeseries';
import { answersById } from '../../lib/values';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsLineChart, MetricsLineChartLegend } from '@/ds/components/MetricsLineChart';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsStackedBarChart } from '@/ds/components/MetricsStackedBarChart';

type Props = WidgetKindProps<TimeseriesOptions>;
type ViewProps = Props & {
  view: ResolvedView<TimeseriesOptions>;
  heading: ViewHeading;
  page: DashboardPageContext;
};

export function TimeseriesWidget(props: Props) {
  const { view, heading } = useViewMenu(props.widget, props.views);
  return (
    <ViewGate queries={view.queries} pending={gate => <PendingChartCard gate={gate} heading={heading} />}>
      {page => <TimeseriesView {...props} view={view} heading={heading} page={page} />}
    </ViewGate>
  );
}

function TimeseriesView({ widget, view, heading, page, onDrilldown }: ViewProps) {
  const { options } = view;
  const { interval } = bucketPlan(page.window.start, page.window.end);
  const totals = new Set(options.totals ?? []);
  const results = useDashboardRequests(
    view.queries.map(q =>
      buildRequest(q, page, { interval: q.id !== undefined && totals.has(q.id) ? undefined : interval }),
    ),
  );
  const sent = results.filter(r => r !== undefined);
  const hasTraceQueries = view.queries.some(q => q.source === 'traceAggregate' || q.source === 'spanAggregate');
  const onClick = useDrilldown(widget, view, onDrilldown);

  const isLoading = sent.some(r => r.isLoading);
  const shaped = shapeTimeseries({
    options,
    responses: answersById(
      view.queries,
      results.map(r => r?.data),
    ),
    window: page.window,
    hasTraceQueries,
  });
  const format = FORMATTERS[options.format];
  const lines: MetricsLineChartSeries[] = shaped.series.map(s => ({
    dataKey: s.dataKey,
    label: s.label,
    color: chartColor(s.color),
    emphasis: s.emphasis,
  }));
  // Series with a range total each show theirs, marked like their line: they count different things.
  const rangeTotals = shaped.series.flatMap(s =>
    s.rangeTotal === undefined
      ? []
      : [{ label: s.label, value: format.value(s.rangeTotal), color: chartColor(s.color) }],
  );
  const withRangeTotals = options.series.some(s => s.rangeTotal !== undefined);

  const layout = {
    ...heading,
    actions: hasDrilldownAction(widget, view, onDrilldown) ? (
      <DrilldownAction widget={widget} view={view} onDrilldown={onDrilldown} />
    ) : undefined,
    total: withRangeTotals ? rangeTotals : undefined,
    isLoading,
    toolbar: lines.length > 0 && (
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={lines} />
      </MetricsCard.Toolbar>
    ),
  };

  const failed = sent.filter(r => r.isError);
  if (failed.length) {
    return (
      <ChartCard {...layout}>
        {hasTraceQueries ? (
          <ChartCardError error={failed[0]?.error} onRetry={() => failed.forEach(r => void r.refetch())} />
        ) : (
          <ChartCardError />
        )}
      </ChartCard>
    );
  }

  const totalFormat = FORMATTERS[options.total?.format ?? options.format];
  const total =
    options.total &&
    (typeof options.total.value === 'object' && 'peak' in options.total.value && !shaped.total
      ? '—'
      : totalFormat.value(shaped.total ?? 0));

  const chart = {
    data: shaped.data,
    series: lines,
    height: 'fill' as const,
    xLabels: options.xLabels,
    showLegend: false,
    valueFormatter: format.value,
    axisFormatter: options.axis === false ? undefined : format.axis,
    onBucketClick:
      onClick &&
      ((row: Record<string, unknown>) => onClick({ window: bucketWindow(Number(row.ts), shaped.stepHours) })),
    isLoading,
    ...(options.xLabels ? EDGE_BUCKET_AXIS : BUCKET_AXIS),
  };
  const yDomain = shaped.flat && options.flatYDomain ? options.flatYDomain : options.yDomain;

  return (
    <ChartCard {...layout} total={layout.total ?? total} isUpdating={sent.some(r => r.isRefetching)}>
      <ChartArea isEmpty={!isLoading && shaped.empty} emptyMessage={options.emptyMessage}>
        {options.chart === 'stackedBar' ? (
          <MetricsStackedBarChart {...chart} />
        ) : (
          <MetricsLineChart {...chart} yDomain={yDomain} />
        )}
      </ChartArea>
    </ChartCard>
  );
}
