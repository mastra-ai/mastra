import { Area, CartesianGrid, ComposedChart, Line, Tooltip } from 'recharts';
import { MetricsLineChartLegend } from './metrics-line-chart-legend';
import { MetricsLineChartTooltip } from './metrics-line-chart-tooltip';
import { ChartSkeleton } from '@/ds/components/ChartSkeleton';
import { CHART_CURSOR_PROPS, CHART_GRID_PROPS, useChartSize } from '@/ds/primitives/chart-axes';
import type { ChartXLabels } from '@/ds/primitives/chart-axes';
import { Y_AXIS_WIDTH, compactNumber, timeXAxis, valueYAxis } from '@/ds/primitives/chart-frame';
import type { ChartHeight } from '@/ds/primitives/chart-frame';
import { CHART_MARGIN } from '@/ds/primitives/chart-layout';
import { ChartPlot } from '@/ds/primitives/chart-plot';
import { useChartDefsId } from '@/ds/primitives/use-chart-defs-id';
import { cn } from '@/lib/utils';

export type MetricsLineChartSeries = {
  dataKey: string;
  label: string;
  color: string;
  aggregate?: (data: Record<string, unknown>[]) => { value: string; suffix?: string };
  /** A secondary reading (e.g. an average next to counts): dashed, no fill under it. */
  dashed?: boolean;
  /** The series to read first (e.g. P95 among percentiles): a slightly heavier line. */
  emphasis?: boolean;
};

/** Line weight; an emphasised series adds half a pixel. */
const LINE_WIDTH = 1.75;
/** Opacity at the top of the fill under a line (it fades to nothing at the base). */
const AREA_OPACITY = 0.12;

// Positioned via transform so the hover line glides between points instead of jumping.
function SmoothCursor({ points }: { points?: { x: number; y: number }[] }) {
  const [top, bottom] = points ?? [];
  if (!top || !bottom) return null;
  return (
    <line
      x1={0}
      x2={0}
      y1={top.y}
      y2={bottom.y}
      {...CHART_CURSOR_PROPS}
      className="pointer-events-none transition-transform duration-150 ease-out"
      style={{ transform: `translateX(${top.x}px)` }}
    />
  );
}

export type MetricsLineChartPointClickHandler = (point: Record<string, unknown>, seriesKey: string) => void;

export function MetricsLineChart({
  data,
  series,
  height = 210,
  yDomain,
  onPointClick,
  onBucketClick,
  xKey = 'time',
  timestampKey = 'tsMs',
  xLabels = 'auto',
  tooltipLabelKey,
  showDots = false,
  showLegend = true,
  valueFormatter,
  axisFormatter,
  showYAxis = true,
  isLoading = false,
  className,
}: {
  data: Record<string, unknown>[];
  series: MetricsLineChartSeries[];
  /** Pixels, or `fill` to grow with the parent (a flex column, e.g. a card's content). */
  height?: ChartHeight;
  yDomain?: [number, number];
  /** Click on a series' active dot. */
  onPointClick?: MetricsLineChartPointClickHandler;
  /** Click anywhere on a bucket (e.g. to open its traces); the plot shows a pointer cursor. */
  onBucketClick?: (row: Record<string, unknown>, index: number) => void;
  /** Row field printed under the x-axis. */
  xKey?: string;
  /** Row field with the bucket's start time (ms), which places labels on round clock times. */
  timestampKey?: string;
  /** `auto` fits as many labels as the width allows; `edges` prints only the first and last. */
  xLabels?: ChartXLabels;
  /** Row field for the tooltip heading (e.g. a longer date); defaults to the x-axis label. */
  tooltipLabelKey?: string;
  /** Render a visible dot on every point (needed for single-point series). */
  showDots?: boolean;
  /** Set to `false` to render `MetricsLineChartLegend` elsewhere, e.g. next to tabs. */
  showLegend?: boolean;
  /** Formats tooltip values (e.g. `ms`, `%`), and y-axis ticks unless `axisFormatter` is set. */
  valueFormatter?: (value: number) => string;
  /** Formats y-axis ticks, when they need a shorter form than the tooltip. */
  axisFormatter?: (value: number) => string;
  /**
   * Set to `false` to drop the y-axis labels and let the plot span the card. The gridlines stay
   * for relative scale; exact values come from the tooltip and the card's summary.
   */
  showYAxis?: boolean;
  /** Show a ghost of the chart while data loads, in the chart's own footprint. */
  isLoading?: boolean;
  className?: string;
}) {
  const id = useChartDefsId();
  const { size, onResize, ref } = useChartSize();
  const fill = height === 'fill';
  const root = cn(fill && 'flex min-h-0 flex-1 flex-col', className);

  // The legend stays while loading: it comes from the series, not the data.
  if (isLoading) {
    return (
      <div className={root}>
        {showLegend && <MetricsLineChartLegend series={series} className="mb-4" />}
        <ChartSkeleton kind="line" height={height} />
      </div>
    );
  }

  const format = valueFormatter ?? compactNumber.format;
  const plotWidth = size.width - (showYAxis ? Y_AXIS_WIDTH : 0);
  const activeDot = (s: MetricsLineChartSeries) => ({
    r: 3.5,
    fill: s.color,
    stroke: 'var(--background)',
    strokeWidth: 2,
    ...(onPointClick && {
      style: { cursor: 'pointer' },
      onClick: (_: unknown, payload: unknown) => {
        // Recharts passes the dot's props; the hovered row is under `payload`.
        if (isRecord(payload) && isRecord(payload.payload)) onPointClick(payload.payload, s.dataKey);
      },
    }),
  });

  return (
    <div className={root}>
      {showLegend && <MetricsLineChartLegend data={data} series={series} className="mb-4" />}
      <ChartPlot height={height} plotRef={ref} onResize={onResize} clickable={!!onBucketClick}>
        <ComposedChart
          data={data}
          margin={CHART_MARGIN}
          onClick={state => {
            const i = state?.activeTooltipIndex;
            const row = i === undefined || i === null ? undefined : data[Number(i)];
            if (onBucketClick && row) onBucketClick(row, Number(i));
          }}
        >
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.dataKey} id={`${id}-area-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={AREA_OPACITY} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...CHART_GRID_PROPS} />
          {timeXAxis({ data, xKey, timestampKey, xLabels, plotWidth })}
          {valueYAxis({ show: showYAxis, size, formatter: axisFormatter ?? format, domain: yDomain })}
          <Tooltip
            content={<MetricsLineChartTooltip formatValue={format} labelKey={tooltipLabelKey} />}
            cursor={<SmoothCursor />}
          />
          {series.map((s, i) => {
            const common = {
              type: 'monotone' as const,
              dataKey: s.dataKey,
              name: s.label,
              stroke: s.color,
              strokeWidth: s.emphasis ? LINE_WIDTH + 0.5 : LINE_WIDTH,
              strokeDasharray: s.dashed ? '4 3' : undefined,
              dot: showDots ? { r: 3, fill: s.color, strokeWidth: 0 } : false,
              activeDot: activeDot(s),
              isAnimationActive: false,
              connectNulls: true,
            };
            return s.dashed ? (
              <Line key={s.dataKey} {...common} />
            ) : (
              <Area key={s.dataKey} {...common} fill={`url(#${id}-area-${i})`} fillOpacity={1} />
            );
          })}
        </ComposedChart>
      </ChartPlot>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
