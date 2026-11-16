import { ChartArea } from '../../../metrics/components/chart-area';
import { ChartCard } from '../../../metrics/components/chart-card';
import { ChartCardError } from '../../../metrics/components/chart-card-error';
import { BUCKET_AXIS, EDGE_BUCKET_AXIS } from '../../../metrics/lib/chart-axis';
import { bucketWindow } from '../../../metrics/lib/metrics-buckets';
import { PendingChartCard } from '../../components/widget-chrome';
import { DrilldownAction, ExpandAction } from '../../components/widget-controls';
import { hasDrilldownAction, useDrilldown, viewMenu } from '../../hooks/use-widget-views';
import { alertAction, pendingHeading, withAction } from '../../lib/alert-actions';
import type { ViewHeading } from '../../lib/chrome';
import { chartColor, FORMATTERS } from '../../lib/format';
import type { DashboardPageContext } from '../../lib/requests';
import { shapeTimeseries, timeseriesAlertValues } from '../../lib/timeseries';
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
  const { gate, state, onStateChange } = props;
  const menu = viewMenu(
    props.widget,
    props.views,
    state.view ?? 0,
    i => onStateChange({ ...state, view: i }),
    props.expand,
  );
  const { view } = menu;
  const { expand } = props;
  const expandHref = expand?.href(props.widget);
  const heading = withAction(
    {
      ...menu.heading,
      dragHandle: props.dragHandle,
      onTitleChange: props.onTitleChange,
      actions: props.actions,
    },
    expand && expandHref && (
      <ExpandAction title={menu.heading.title} href={expandHref} LinkComponent={expand.LinkComponent} />
    ),
  );
  if (gate.status === 'pending')
    return (
      <PendingChartCard
        gate={gate.gate}
        heading={pendingHeading(heading, gate.gate, props.alert, props.widget, view)}
      />
    );
  return <TimeseriesView {...props} view={view} heading={heading} page={gate.page} />;
}

function TimeseriesView({ widget, view, heading: own, page, onDrilldown, alert, results, onRetry }: ViewProps) {
  // Drilldown, then the alert, then the expand link and the host's actions.
  const heading = withAction(
    own,
    alertAction(alert, widget, view, { page, values: timeseriesAlertValues(view.options) }),
  );
  const { options } = view;
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
  const failed = sent.filter(r => r.isError);

  const layout = {
    ...heading,
    actions: hasDrilldownAction(widget, view, onDrilldown) ? (
      <>
        <DrilldownAction widget={widget} view={view} onDrilldown={onDrilldown} />
        {heading.actions}
      </>
    ) : (
      heading.actions
    ),
    // Range totals per series; with no series in the range, one plain 0. None while a request
    // failed, so no total sits beside the error.
    total: !withRangeTotals || failed.length ? undefined : rangeTotals.length ? rangeTotals : format.value(0),
    isLoading,
    toolbar: lines.length > 0 && (
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={lines} />
      </MetricsCard.Toolbar>
    ),
  };

  if (failed.length) {
    return (
      <ChartCard {...layout}>
        {hasTraceQueries ? <ChartCardError error={failed[0]?.error} onRetry={onRetry} /> : <ChartCardError />}
      </ChartCard>
    );
  }

  const totalFormat = FORMATTERS[options.total?.format ?? options.format];
  // An empty range totals 0, a peak included, like the cards around it.
  const total = options.total && totalFormat.value(shaped.total ?? 0);

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
      <ChartArea isEmpty={!isLoading && shaped.empty}>
        {options.chart === 'stackedBar' ? (
          <MetricsStackedBarChart {...chart} />
        ) : (
          <MetricsLineChart {...chart} yDomain={yDomain} lineStyle="thin" />
        )}
      </ChartArea>
    </ChartCard>
  );
}
