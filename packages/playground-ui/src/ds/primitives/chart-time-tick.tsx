import { usePlotArea } from 'recharts';
import { labelWidth, pickTimeTicks } from './chart-axes';
import type { ChartXLabels } from './chart-axes';
import { CHART_AXIS_FONT_SIZE } from './chart-layout';
import { CHART_LABEL_COLOR } from '@/ds/tokens';

export type ChartTimeTickProps = {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value: string; index: number; offset?: number };
  /** Every bucket's label. */
  labels: string[];
  /** Every bucket's time, so labels land on round clock times. */
  timestamps: Array<number | undefined>;
  xLabels: ChartXLabels;
};

/**
 * An x label on picked buckets only, centred on its bucket and nudged inward only as far as it
 * takes to stay inside the plot, so the chart needs no side margin. The plot's box comes from
 * the chart, so it's right whatever width the y-axis labels take.
 */
export function ChartTimeTick({ x = 0, y = 0, payload, labels, timestamps, xLabels }: ChartTimeTickProps) {
  const plot = usePlotArea();
  if (!payload || !plot || plot.width <= 0) return null;
  if (!pickTimeTicks(timestamps, labels, plot.width, xLabels).has(payload.index)) return null;
  const text = String(payload.value);
  const w = labelWidth(text) / 2;
  const tx = Math.min(Math.max(x, plot.x + w), plot.x + plot.width - w);
  return (
    <text x={tx} y={y} dy="0.71em" textAnchor="middle" fontSize={CHART_AXIS_FONT_SIZE} fill={CHART_LABEL_COLOR}>
      {text}
    </text>
  );
}
