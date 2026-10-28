import { ChartArea } from '../../../metrics/components/chart-area';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { BUCKET_AXIS, EDGE_BUCKET_AXIS } from '../../../metrics/lib/chart-axis';
import { bucketPlan, bucketWindow } from '../../../metrics/lib/metrics-buckets';
import { ViewGate } from '../../components/view-gate';
import { PendingChartCard } from '../../components/widget-chrome';
import { useDrilldown, useViewTabs } from '../../components/widget-hooks';
import { useDashboardRequests } from '../../hooks/use-dashboard-requests';
import { viewHeading } from '../../lib/chrome';
import { chartColor, FORMATTERS } from '../../lib/format';
import { buildRequest } from '../../lib/requests';
import type { DashboardPageContext } from '../../lib/requests';
import { shapeTimeseries } from '../../lib/timeseries';
import type { TimeseriesOptions } from '../../lib/timeseries';
import type { ResolvedView, WidgetKindProps } from '../../widget-kind';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsLineChart, MetricsLineChartLegend } from '@/ds/components/MetricsLineChart';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsStackedBarChart } from '@/ds/components/MetricsStackedBarChart';

type Props = WidgetKindProps<TimeseriesOptions>;

export function TimeseriesWidget(props: Props) {
  const { view, tabs } = useViewTabs(props.views);
  const heading = viewHeading(props.widget, view);
  return (
    <ViewGate queries={view.queries} pending={gate => <PendingChartCard gate={gate} {...heading} />}>
      {page => <TimeseriesView {...props} view={view} tabs={tabs} page={page} />}
    </ViewGate>
  );
}

function TimeseriesView({
  widget,
  view,
  tabs,
  page,
  onDrilldown,
}: Props & { view: ResolvedView<TimeseriesOptions>; tabs: React.ReactNode; page: DashboardPageContext }) {
  const { options } = view;
  const { interval } = bucketPlan(page.window.start, page.window.end);
  const totals = new Set(options.totals ?? []);
  const requests = view.queries.map((q, i) =>
    buildRequest(q, page, { interval: totals.has(i) ? undefined : interval }),
  );
  const results = useDashboardRequests(requests).filter(r => r !== undefined);
  const hasTraceQueries = view.queries.some(q => q.source === 'traceAggregate' || q.source === 'spanAggregate');
  const { actionButton, onClick } = useDrilldown(widget, view, onDrilldown);

  const isLoading = results.some(r => r.isLoading);
  const shaped = shapeTimeseries({
    options,
    responses: results.map(r => r.data),
    window: page.window,
    hasTraceQueries,
  });
  const format = FORMATTERS[options.format];
  const lines: MetricsLineChartSeries[] = shaped.series.map(s => ({
    dataKey: s.dataKey,
    label: s.label,
    color: chartColor(s.color),
    ...(s.emphasis === undefined ? {} : { emphasis: s.emphasis }),
    ...(s.legend === undefined ? {} : { aggregate: () => ({ value: format.value(s.legend ?? 0) }) }),
  }));
  const withLegendValues = shaped.series.some(s => s.legend !== undefined);

  const layout = {
    ...viewHeading(widget, view),
    actions: actionButton,
    toolbar: (lines.length > 0 || tabs) && (
      <MetricsCard.Toolbar>
        {lines.length > 0 && (
          <MetricsLineChartLegend series={lines} {...(withLegendValues ? { data: shaped.data } : {})} />
        )}
        {tabs}
      </MetricsCard.Toolbar>
    ),
  };

  const failed = results.filter(r => r.isError);
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

  const summaryFormat = FORMATTERS[options.summary?.format ?? options.format];
  const summary = options.summary && (
    <MetricsCard.Summary
      value={
        typeof options.summary.value === 'object' && 'peak' in options.summary.value && !shaped.summary
          ? '—'
          : summaryFormat.value(shaped.summary ?? 0)
      }
      label={options.summary.label}
      isLoading={isLoading}
    />
  );

  const chart = {
    data: shaped.data,
    series: lines,
    height: 'fill' as const,
    ...(options.xLabels ? { xLabels: options.xLabels } : {}),
    showLegend: false,
    valueFormatter: format.value,
    ...(options.axis === false || !format.axis ? {} : { axisFormatter: format.axis }),
    onBucketClick:
      onClick &&
      ((row: Record<string, unknown>) => onClick({ window: bucketWindow(Number(row.ts), shaped.stepHours) })),
    isLoading,
    ...(options.xLabels ? EDGE_BUCKET_AXIS : BUCKET_AXIS),
  };
  const yDomain = shaped.flat && options.flatYDomain ? options.flatYDomain : options.yDomain;

  return (
    <ChartCard {...layout} {...(summary ? { summary } : {})} isUpdating={results.some(r => r.isPlaceholderData)}>
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
