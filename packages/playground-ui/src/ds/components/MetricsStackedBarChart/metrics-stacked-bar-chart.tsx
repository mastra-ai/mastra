import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  Rectangle,
  ReferenceLine,
  Tooltip,
  usePlotArea,
} from 'recharts';
import type { LabelProps } from 'recharts';
import { ChartSkeleton } from '@/ds/components/ChartSkeleton';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsLineChartLegend, MetricsLineChartTooltip } from '@/ds/components/MetricsLineChart';
import { CHART_GRID_PROPS, useChartSize } from '@/ds/primitives/chart-axes';
import type { ChartXLabels } from '@/ds/primitives/chart-axes';
import { singleBarBox, stackedSegmentBox } from '@/ds/primitives/chart-column-layout';
import type { SegmentBox } from '@/ds/primitives/chart-column-layout';
import {
  CHART_TICK,
  Y_AXIS_WIDTH,
  compactNumber,
  dataMax,
  isWholeData,
  timeXAxis,
  valueYAxis,
} from '@/ds/primitives/chart-frame';
import type { ChartHeight } from '@/ds/primitives/chart-frame';
import { CHART_AXIS_FONT_SIZE, CHART_MARGIN } from '@/ds/primitives/chart-layout';
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
const COLUMN_LABEL_SPACE = 16;

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

/** Inclusive column indices, ordered. */
export type MetricsStackedBarChartRange = { start: number; end: number };

/**
 * Dims every column outside the hovered one, or outside the range being dragged. Its own tiny
 * state, so a move only re-renders this <style> tag: with hundreds of buckets, re-rendering the
 * bars on each move froze the pointer.
 */
function HoverDim({
  scope,
  setter,
}: {
  scope: string;
  setter: { current: (range: MetricsStackedBarChartRange | undefined) => void };
}) {
  const [lit, setLit] = useState<MetricsStackedBarChartRange>();
  useLayoutEffect(() => {
    setter.current = setLit;
  }, [setter]);
  if (!lit) return null;
  const columns = `[data-chart-scope="${scope}"] [data-bucket]`;
  const kept = Array.from(
    { length: lit.end - lit.start + 1 },
    (_, i) => `${columns}[data-bucket="${lit.start + i}"]`,
  ).join(',');
  return <style>{`${columns}{opacity:${DIMMED}}${kept}{opacity:1}`}</style>;
}

const ordered = (a: number, b: number): MetricsStackedBarChartRange => ({ start: Math.min(a, b), end: Math.max(a, b) });

/**
 * The band behind the columns being dragged, full plot height, so the selection shows even over
 * empty buckets. Like `HoverDim`, it owns its state: a drag repaints the band, never the bars.
 */
function DragSelection({
  count,
  setter,
}: {
  count: number;
  setter: { current: (range: MetricsStackedBarChartRange | undefined) => void };
}) {
  const [range, setRange] = useState<MetricsStackedBarChartRange>();
  const area = usePlotArea();
  useLayoutEffect(() => {
    setter.current = setRange;
  }, [setter]);
  if (!range || !area || count === 0) return null;
  // A category axis gives every column an equal slot across the plot.
  const slot = area.width / count;
  return (
    <rect
      data-slot="chart-drag-selection"
      x={area.x + range.start * slot}
      y={area.y}
      width={(range.end - range.start + 1) * slot}
      height={area.height}
      rx={RADIUS}
      fill="var(--fill)"
      stroke="var(--fill-strong)"
      pointerEvents="none"
    />
  );
}

function activeIndex(state: { activeTooltipIndex?: unknown } | undefined) {
  const index = state?.activeTooltipIndex;
  return index === undefined || index === null ? undefined : Number(index);
}

/** A line drawn over the bars on its own scale, e.g. average wake time over cold starts. */
export type MetricsStackedBarChartOverlay = MetricsLineChartSeries & {
  valueFormatter?: (value: number) => string;
};

export type MetricsStackedBarChartProps = {
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
  columnLabelKey?: string;
  /** Widest a column gets, in pixels. Defaults to 28; raise it for dense strips of many thin columns. */
  maxBarSize?: number;
  /** Click a column (e.g. to open its traces); the plot shows a pointer cursor. */
  onBucketClick?: (row: Record<string, unknown>, index: number) => void;
  /**
   * Drag across two or more columns to select them (e.g. to zoom into that time span); reports the
   * first and last selected row indices. A press and release on one column stays a click.
   */
  onZoom?: (range: MetricsStackedBarChartRange) => void;
  /** One dashed line over the bars, on its own hidden scale (e.g. a duration over counts). */
  overlay?: MetricsStackedBarChartOverlay;
  /** Show a ghost of the chart while data loads, in the chart's own footprint. */
  isLoading?: boolean;
  className?: string;
};

export function MetricsStackedBarChart(props: MetricsStackedBarChartProps) {
  const { data, series, overlay, height = 210, showLegend = true, isLoading = false, className } = props;
  const id = useChartDefsId();
  const root = cn(height === 'fill' && 'flex min-h-0 flex-1 flex-col', className);
  const legend = overlay ? [...series, { ...overlay, dashed: true }] : series;
  // The legend stays while loading: it comes from the series, not the data.
  return (
    <div className={root} data-chart-scope={id}>
      {showLegend && <MetricsLineChartLegend data={isLoading ? undefined : data} series={legend} className="mb-4" />}
      {isLoading ? <ChartSkeleton kind="bar" height={height} /> : <BarPlot {...props} id={id} />}
    </div>
  );
}

/** The plot itself, once the data is in; `id` scopes its gradients and hover rule. */
function BarPlot({
  data,
  series,
  height = 210,
  yDomain,
  valueFormatter,
  axisFormatter,
  referenceLine,
  variant = 'gradient',
  showYAxis = true,
  showTotal = series.length > 1,
  xKey = 'time',
  timestampKey = 'tsMs',
  xLabels = 'auto',
  tooltipLabelKey,
  columnLabelKey,
  maxBarSize = 28,
  onBucketClick,
  onZoom,
  overlay,
  id,
}: MetricsStackedBarChartProps & { id: string }) {
  const setLit = useRef<(range: MetricsStackedBarChartRange | undefined) => void>(() => {});
  const setSelection = useRef<(range: MetricsStackedBarChartRange | undefined) => void>(() => {});
  const { size, onResize, ref } = useChartSize();
  // Drag state lives in refs: a drag only repaints the dimming rule, never the bars.
  const drag = useRef<{ anchor: number; current: number }>(undefined);
  const justZoomed = useRef(false);
  const stopListening = useRef<() => void>(undefined);
  useEffect(() => () => stopListening.current?.(), []);

  const startDrag = (index: number | undefined) => {
    justZoomed.current = false;
    if (!onZoom || index === undefined) return;
    drag.current = { anchor: index, current: index };
    // On the window, so a release outside the chart still ends the drag.
    const finish = () => {
      stopListening.current = undefined;
      const range = drag.current;
      drag.current = undefined;
      setLit.current(undefined);
      setSelection.current(undefined);
      if (range && range.anchor !== range.current) {
        justZoomed.current = true;
        onZoom(ordered(range.anchor, range.current));
      }
    };
    window.addEventListener('mouseup', finish, { once: true });
    stopListening.current = () => window.removeEventListener('mouseup', finish);
  };

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

  const format = valueFormatter ?? compactNumber.format;
  const plotWidth = size.width - (showYAxis ? Y_AXIS_WIDTH : 0);
  const margin = columnLabelKey ? { ...CHART_MARGIN, top: CHART_MARGIN.top + COLUMN_LABEL_SPACE } : CHART_MARGIN;

  return (
    <>
      <HoverDim scope={id} setter={setLit} />
      <ChartPlot
        height={height}
        plotRef={ref}
        onResize={onResize}
        clickable={!!onBucketClick && !onZoom}
        className={cn(onZoom && 'select-none [&_.recharts-surface]:cursor-crosshair')}
      >
        <ComposedChart
          data={data}
          margin={margin}
          onMouseDown={(state, event) => {
            // Keeps the drag from selecting the axis labels.
            if (onZoom) event.preventDefault();
            startDrag(activeIndex(state));
          }}
          onMouseMove={state => {
            const index = activeIndex(state);
            const dragging = drag.current;
            if (!dragging) {
              setLit.current(index === undefined ? undefined : { start: index, end: index });
              return;
            }
            if (index !== undefined) dragging.current = index;
            const range = ordered(dragging.anchor, dragging.current);
            setLit.current(range);
            // One column is still a click; the band appears once the drag spans two.
            setSelection.current(range.start === range.end ? undefined : range);
          }}
          onMouseLeave={() => {
            // Mid-drag the selection stays lit until the release.
            if (!drag.current) setLit.current(undefined);
          }}
          onClick={state => {
            // The release of a drag is also a click on the column under the pointer.
            if (justZoomed.current) {
              justZoomed.current = false;
              return;
            }
            const i = activeIndex(state);
            const row = i === undefined ? undefined : data[i];
            if (onBucketClick && row && i !== undefined) onBucketClick(row, i);
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
          {onZoom && <DragSelection count={data.length} setter={setSelection} />}
          {timeXAxis({ data, xKey, timestampKey, xLabels, plotWidth })}
          {valueYAxis({
            show: showYAxis,
            size,
            formatter: axisFormatter ?? format,
            domain: yDomain,
            // A reference line above the bars stays on the axis.
            max: Math.max(
              dataMax(
                data,
                series.map(s => s.dataKey),
                true,
              ),
              referenceLine?.value ?? 0,
            ),
            integer: isWholeData(
              data,
              series.map(s => s.dataKey),
            ),
          })}
          {overlay &&
            valueYAxis({
              id: 'overlay',
              show: false,
              size,
              formatter: overlay.valueFormatter ?? compactNumber.format,
              max: dataMax(data, [overlay.dataKey]),
              integer: isWholeData(data, [overlay.dataKey]),
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
              maxBarSize={maxBarSize}
              isAnimationActive={false}
              shape={shapes[i]}
            >
              {columnLabelKey && (
                <LabelList
                  dataKey={columnLabelKey}
                  content={(props: LabelProps) => (
                    <ColumnLabel
                      {...props}
                      row={data[Number(props.index)]}
                      keys={series.map(({ dataKey }) => dataKey)}
                      self={i}
                      color={s.color}
                    />
                  )}
                />
              )}
            </Bar>
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
    </>
  );
}

type ColumnLabelProps = LabelProps & {
  row: MetricsStackedBarChartProps['data'][number] | undefined;
  keys: string[];
  self: number;
  color: string;
};

function paintedTop(values: number[], self: number, box: SegmentBox) {
  if (values.length > 1) return stackedSegmentBox(values, self, box, { gap: SEGMENT_GAP })?.y;
  return singleBarBox(values[self] ?? 0, box)?.y;
}

function ColumnLabel({ x, y, width, height, value, row, keys, self, color }: ColumnLabelProps) {
  if (value === undefined || value === null || value === '') return null;
  const values = keys.map(key => Number(row?.[key]) || 0);
  const topmost = values.findLastIndex(v => v > 0);
  if (self !== (topmost === -1 ? keys.length - 1 : topmost)) return null;
  const top = paintedTop(values, self, { y: Number(y), height: Math.max(Number(height), 0) }) ?? Number(y);
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={top - 6}
      textAnchor="middle"
      fontSize={CHART_AXIS_FONT_SIZE}
      fill={color}
      className="tabular-nums"
    >
      {String(value)}
    </text>
  );
}
