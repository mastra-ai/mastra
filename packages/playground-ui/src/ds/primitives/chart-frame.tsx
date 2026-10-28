import { XAxis, YAxis } from 'recharts';
import { chartYTickCount, niceYTicks, pickTimeTicks } from './chart-axes';
import type { ChartSize, ChartXLabels } from './chart-axes';
import { CHART_AXIS_FONT_SIZE, X_AXIS_HEIGHT } from './chart-layout';
import { ChartTimeTick } from './chart-time-tick';
import type { ChartTimeTickProps } from './chart-time-tick';
import { CHART_LABEL_COLOR } from '@/ds/tokens';

/** A chart's height: pixels, or `fill` to grow with its parent (a flex column, e.g. a card). */
export type ChartHeight = number | 'fill';

export const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export const CHART_TICK = { fontSize: CHART_AXIS_FONT_SIZE, fill: CHART_LABEL_COLOR };

/** The x-axis of a time series: labels from `xKey`, placed on clock times from `timestampKey`. */
export function timeXAxis({
  data,
  xKey,
  timestampKey,
  xLabels,
  plotWidth,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  timestampKey: string;
  xLabels: ChartXLabels;
  plotWidth: number;
}) {
  const labels = data.map(row => String(row[xKey] ?? ''));
  const timestamps = data.map(row => {
    const t = row[timestampKey];
    return typeof t === 'number' ? t : undefined;
  });
  const picked = pickTimeTicks(timestamps, labels, plotWidth, xLabels);
  return (
    <XAxis
      dataKey={xKey}
      height={X_AXIS_HEIGHT}
      tick={(props: Omit<ChartTimeTickProps, 'picked' | 'count' | 'plotWidth'>) => (
        <ChartTimeTick {...props} picked={picked} count={data.length} plotWidth={plotWidth} />
      )}
      tickLine={false}
      axisLine={false}
      tickMargin={6}
      // Render every tick slot; ChartTimeTick decides which ones print a label.
      interval={0}
    />
  );
}

/**
 * Room the y-axis labels take at most. The axis itself is as wide as its longest label, so the
 * labels line up with the card's content; this only sizes the plot for spacing the x labels.
 */
export const Y_AXIS_WIDTH = 44;

export function valueYAxis({
  id = 0,
  show,
  size,
  formatter,
  domain,
  max,
  integer = false,
  right = false,
}: {
  id?: string | number;
  show: boolean;
  size: ChartSize;
  formatter: (value: number) => string;
  /** Fixed range; Recharts spaces the ticks in it. */
  domain?: [number, number];
  /** Largest value plotted on this axis (a stack's total for stacked bars); the ticks round up from it. */
  max?: number;
  /** Whole-number data (counts): ticks on whole numbers. */
  integer?: boolean;
  right?: boolean;
}) {
  const tickCount = chartYTickCount(size.height);
  // Recharts rounds its step up to fit the tick count, so a $4.40 peak got an $8 axis.
  const ticks = domain || max === undefined ? undefined : niceYTicks(max, tickCount, integer);
  const labels = (ticks ?? (domain && domainTickCandidates(domain, tickCount)))?.map(formatter);
  return (
    <YAxis
      yAxisId={id}
      hide={!show}
      orientation={right ? 'right' : 'left'}
      tick={CHART_TICK}
      tickLine={false}
      axisLine={false}
      width={yAxisWidth(show, labels)}
      tickMargin={4}
      tickFormatter={formatter}
      domain={ticks ? [0, ticks.at(-1) ?? 0] : domain}
      ticks={ticks}
      tickCount={tickCount}
    />
  );
}

/**
 * The y-axis width for its tick labels, from canvas text metrics. Recharts' `width="auto"` reads
 * each label's box from the DOM on every redraw, which forces a page layout per chart. A hidden
 * axis takes no room; with no known labels, Recharts measures.
 */
function yAxisWidth(show: boolean, labels: string[] | undefined) {
  if (!show) return 0;
  if (!labels) return 'auto';
  const widest = Math.max(0, ...labels.map(textWidth));
  // Plus the tick margin (4) and Recharts' default tick size (6), which it counts with hidden tick lines.
  return Math.ceil(widest + 4 + 6);
}

/**
 * Values Recharts may label in a fixed `domain`: its ends and evenly spaced steps for every tick
 * count up to `count`. Recharts picks its own in-between ticks (0.35, 0.7 for four in 0 to 1), so
 * the axis is sized from all the candidates, never narrower than the labels it draws.
 */
function domainTickCandidates([min, max]: [number, number], count: number) {
  const values = [min, max];
  for (let n = 3; n <= count; n++) {
    for (let i = 1; i < n - 1; i++) values.push(min + ((max - min) * i) / (n - 1));
  }
  return values;
}

let measureContext: CanvasRenderingContext2D | undefined;
let measureContextTried = false;

function textWidth(text: string) {
  if (!measureContextTried) {
    measureContextTried = true;
    measureContext = createMeasureContext();
  }
  return measureContext ? measureContext.measureText(text).width : text.length * CHART_AXIS_FONT_SIZE * 0.6;
}

function createMeasureContext() {
  if (typeof document === 'undefined') return undefined;
  const context = document.createElement('canvas').getContext('2d') ?? undefined;
  if (context) context.font = `${CHART_AXIS_FONT_SIZE}px ${getComputedStyle(document.body).fontFamily}`;
  return context;
}

/** The largest number under `keys` in any row; with `stacked`, the largest row total. */
export function dataMax(data: Record<string, unknown>[], keys: string[], stacked = false) {
  let max = 0;
  for (const row of data) {
    let total = 0;
    for (const key of keys) {
      const v = row[key];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (stacked) total += v;
      else max = Math.max(max, v);
    }
    if (stacked) max = Math.max(max, total);
  }
  return max;
}

/** Whether every number under `keys` is whole (counts), so the axis keeps to whole ticks. */
export function isWholeData(data: Record<string, unknown>[], keys: string[]) {
  return data.every(row =>
    keys.every(key => {
      const v = row[key];
      return typeof v !== 'number' || Number.isInteger(v);
    }),
  );
}
