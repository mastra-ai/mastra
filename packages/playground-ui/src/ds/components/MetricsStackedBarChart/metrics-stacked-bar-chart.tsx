import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, Rectangle, ReferenceLine, Tooltip } from 'recharts';
import { ChartSkeleton } from '@/ds/components/ChartSkeleton';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsLineChartLegend, MetricsLineChartTooltip } from '@/ds/components/MetricsLineChart';
import { CHART_GRID_PROPS, useChartSize } from '@/ds/primitives/chart-axes';
import type { ChartXLabels } from '@/ds/primitives/chart-axes';
import { singleBarBox, stackedSegmentBox } from '@/ds/primitives/chart-column-layout';
import { CHART_TICK, Y_AXIS_WIDTH, compactNumber, timeXAxis, valueYAxis } from '@/ds/primitives/chart-frame';
import type { ChartHeight } from '@/ds/primitives/chart-frame';
import { CHART_MARGIN } from '@/ds/primitives/chart-layout';
import { ChartPlot } from '@/ds/primitives/chart-plot';
import { useChartDefsId } from '@/ds/primitives/use-chart-defs-id';
import { cn } from '@/lib/utils';

/** Corner radius of every segment; thin segments scale it down so they stay crisp rectangles. */
const RADIUS = 2;
/** Pixels between stacked segments, so neighbouring segments read as separate blocks. */
const SEGMENT_GAP = 2;
/** Opacity at the base of a segment's gradient (the top is fully opaque). */
const GRADIENT_BASE = 0.75;
/** Single-series bars: translucent body under a solid cap that marks the value. */
const CAP_BODY = 0.55;
const CAP_HEIGHT = 3;
/** Opacity of the other columns while one is hovered. */
const DIMMED = 0.3;

type SegmentProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: Record<string, unknown>;
};

function segmentShape({
  fill,
  color,
  capped,
  keys,
  dataKey,
}: {
  fill: string;
  color: string;
  capped: boolean;
  /** The column's data keys, bottom to top. */
  keys: string[];
  dataKey: string;
}) {
  return function Segment({ x = 0, width = 0, index, payload, ...geo }: SegmentProps) {
    const values = keys.map(k => Number(payload?.[k]) || 0);
    const self = keys.indexOf(dataKey);
    const box = { y: geo.y ?? 0, height: Math.max(geo.height ?? 0, 0) };
    // Every non-zero value gets a few readable pixels; zeros draw nothing.
    const laid =
      keys.length > 1
        ? stackedSegmentBox(values, self, box, { gap: SEGMENT_GAP })
        : singleBarBox(values[self] ?? 0, box);
    if (!laid) return <g />;
    const { y, height: h } = laid;
    const radius = Math.min(RADIUS, Math.floor(h / 3));
    // Dimming is a CSS rule keyed on `data-bucket` (see `HoverDim`), so hovering re-renders no bars.
    const bucket = { 'data-bucket': index, style: { transition: 'opacity 150ms ease-out' } };

    if (capped) {
      return (
        <g {...bucket}>
          <Rectangle x={x} y={y} width={width} height={h} radius={radius} fill={color} fillOpacity={CAP_BODY} />
          <Rectangle x={x} y={y} width={width} height={Math.min(CAP_HEIGHT, h)} radius={radius} fill={color} />
        </g>
      );
    }
    return (
      <g {...bucket}>
        <Rectangle x={x} y={y} width={width} height={h} radius={radius} fill={fill} />
      </g>
    );
  };
}

/**
 * Dims every column but the hovered one. Its own tiny state, so a hover only re-renders this
 * <style> tag: with hundreds of buckets, re-rendering the bars on each move froze the pointer.
 */
function HoverDim({ scope, setter }: { scope: string; setter: { current: (index: number | null) => void } }) {
  const [hovered, setHovered] = useState<number | null>(null);
  useLayoutEffect(() => {
    setter.current = setHovered;
  }, [setter]);
  if (hovered === null) return null;
  return (
    <style>{`[data-chart-scope="${scope}"] [data-bucket]:not([data-bucket="${hovered}"]){opacity:${DIMMED}}`}</style>
  );
}

/** A line drawn over the bars on its own scale, e.g. average wake time over cold starts. */
export type MetricsStackedBarChartOverlay = MetricsLineChartSeries & {
  valueFormatter?: (value: number) => string;
};

export function MetricsStackedBarChart({
  data,
  series,
  height = 210,
  yDomain,
  valueFormatter,
  axisFormatter,
  showLegend = true,
  referenceLine,
  variant = 'gradient',
  showYAxis = true,
  showTotal = series.length > 1,
  xKey = 'time',
  timestampKey = 'tsMs',
  xLabels = 'auto',
  tooltipLabelKey,
  onBucketClick,
  overlay,
  isLoading = false,
  className,
}: {
  data: Record<string, unknown>[];
  series: MetricsLineChartSeries[];
  /** Pixels, or `fill` to grow with the parent (a flex column, e.g. a card's content). */
  height?: ChartHeight;
  yDomain?: [number, number];
  /** Formats tooltip values, and y-axis ticks unless `axisFormatter` is set. */
  valueFormatter?: (value: number) => string;
  /** Formats y-axis ticks, when they need a shorter form than the tooltip. */
  axisFormatter?: (value: number) => string;
  showLegend?: boolean;
  referenceLine?: { value: number; label: string; color: string };
  /**
   * `gradient`: segments fade gently toward the base. Reads best for stacks.
   * `capped`: a translucent body under a solid cap that marks the value. Reads best for one
   * value per column.
   */
  variant?: 'gradient' | 'capped';
  /**
   * Set to `false` to drop the y-axis labels and let the plot span the card. The gridlines stay
   * for relative scale; exact values come from the tooltip and the card's summary.
   */
  showYAxis?: boolean;
  /** Adds a "Total" row (the column's height) to the tooltip. Defaults to on for stacks. */
  showTotal?: boolean;
  /** Row field printed under the x-axis. */
  xKey?: string;
  /** Row field with the bucket's start time (ms), which places labels on round clock times. */
  timestampKey?: string;
  /** `auto` fits as many labels as the width allows; `edges` prints only the first and last. */
  xLabels?: ChartXLabels;
  /** Row field for the tooltip heading (e.g. a longer date); defaults to the x-axis label. */
  tooltipLabelKey?: string;
  /** Click a column (e.g. to open its traces); the plot shows a pointer cursor. */
  onBucketClick?: (row: Record<string, unknown>, index: number) => void;
  /** One dashed line over the bars, on its own hidden scale (e.g. a duration over counts). */
  overlay?: MetricsStackedBarChartOverlay;
  /** Show a ghost of the chart while data loads, in the chart's own footprint. */
  isLoading?: boolean;
  className?: string;
}) {
  const id = useChartDefsId();
  const setHovered = useRef<(index: number | null) => void>(() => {});
  const { size, onResize, ref } = useChartSize();
  const fill = height === 'fill';
  const root = cn(fill && 'flex min-h-0 flex-1 flex-col', className);

  const keyList = series.map(s => s.dataKey).join('\u0000');
  const colorList = series.map(s => s.color).join('\u0000');
  // Stable shapes, so Recharts doesn't re-render every bar when the parent re-renders.
  const shapes = useMemo(() => {
    const keys = keyList.split('\u0000');
    const colors = colorList.split('\u0000');
    return keys.map((dataKey, i) =>
      segmentShape({
        fill: `url(#${id}-bar-${i})`,
        color: colors[i] ?? '',
        capped: variant === 'capped',
        keys,
        dataKey,
      }),
    );
  }, [keyList, colorList, variant, id]);

  const legend = overlay ? [...series, { ...overlay, dashed: true }] : series;
  // The legend stays while loading: it comes from the series, not the data.
  if (isLoading) {
    return (
      <div className={root}>
        {showLegend && <MetricsLineChartLegend series={legend} className="mb-4" />}
        <ChartSkeleton kind="bar" height={height} />
      </div>
    );
  }

  const format = valueFormatter ?? compactNumber.format;
  const plotWidth = size.width - (showYAxis ? Y_AXIS_WIDTH : 0);

  return (
    <div className={root} data-chart-scope={id}>
      <HoverDim scope={id} setter={setHovered} />
      {showLegend && <MetricsLineChartLegend data={data} series={legend} className="mb-4" />}
      <ChartPlot height={height} plotRef={ref} onResize={onResize} clickable={!!onBucketClick}>
        <ComposedChart
          data={data}
          margin={CHART_MARGIN}
          onMouseMove={state => {
            const index = state?.activeTooltipIndex;
            setHovered.current(index === undefined || index === null ? null : Number(index));
          }}
          onMouseLeave={() => setHovered.current(null)}
          onClick={state => {
            const i = state?.activeTooltipIndex;
            const row = i === undefined || i === null ? undefined : data[Number(i)];
            if (onBucketClick && row) onBucketClick(row, Number(i));
          }}
        >
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.dataKey} id={`${id}-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={1} />
                <stop offset="100%" stopColor={s.color} stopOpacity={GRADIENT_BASE} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...CHART_GRID_PROPS} />
          {timeXAxis({ data, xKey, timestampKey, xLabels, plotWidth })}
          {valueYAxis({ show: showYAxis, size, formatter: axisFormatter ?? format, domain: yDomain })}
          {overlay &&
            valueYAxis({
              id: 'overlay',
              show: false,
              size,
              formatter: overlay.valueFormatter ?? compactNumber.format,
              right: true,
            })}
          <Tooltip
            cursor={false}
            content={
              <MetricsLineChartTooltip
                formatValue={format}
                showTotal={showTotal && !overlay}
                labelKey={tooltipLabelKey}
                formatByKey={overlay?.valueFormatter ? { [overlay.dataKey]: overlay.valueFormatter } : undefined}
              />
            }
          />
          {series.map((s, i) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.label}
              stackId="1"
              fill={s.color}
              maxBarSize={28}
              isAnimationActive={false}
              shape={shapes[i]}
            />
          ))}
          {overlay && (
            <Line
              yAxisId="overlay"
              type="monotone"
              dataKey={overlay.dataKey}
              name={overlay.label}
              stroke={overlay.color}
              strokeWidth={1.75}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3.5, fill: overlay.color, stroke: 'var(--background)', strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
          )}
          {referenceLine && (
            <ReferenceLine
              y={referenceLine.value}
              ifOverflow="extendDomain"
              stroke={referenceLine.color}
              strokeDasharray="4 4"
              label={{ value: referenceLine.label, position: 'insideTopLeft', ...CHART_TICK }}
            />
          )}
        </ComposedChart>
      </ChartPlot>
    </div>
  );
}
