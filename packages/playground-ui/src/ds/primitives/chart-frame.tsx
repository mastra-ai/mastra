import { XAxis, YAxis } from 'recharts';
import { chartYTickCount, pickTimeTicks } from './chart-axes';
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
  right = false,
}: {
  id?: string | number;
  show: boolean;
  size: ChartSize;
  formatter: (value: number) => string;
  domain?: [number, number];
  right?: boolean;
}) {
  return (
    <YAxis
      yAxisId={id}
      hide={!show}
      orientation={right ? 'right' : 'left'}
      tick={CHART_TICK}
      tickLine={false}
      axisLine={false}
      width="auto"
      tickMargin={4}
      tickFormatter={formatter}
      domain={domain}
      tickCount={chartYTickCount(size.height)}
    />
  );
}
