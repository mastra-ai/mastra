import { labelWidth } from './chart-axes';
import { CHART_AXIS_FONT_SIZE } from './chart-layout';
import { CHART_LABEL_COLOR } from '@/ds/tokens';

export type ChartTimeTickProps = {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value: string; index: number; offset?: number };
  /** Buckets that print a label (from `pickTimeTicks`). */
  picked: Set<number>;
  count: number;
  plotWidth: number;
};

/**
 * An x label on picked buckets only, centred on its bucket and nudged inward only as far as it
 * takes to stay inside the plot, so the chart needs no side margin.
 */
export function ChartTimeTick({ x = 0, y = 0, payload, picked, count, plotWidth }: ChartTimeTickProps) {
  if (!payload || !plotWidth || !picked.has(payload.index)) return null;
  const text = String(payload.value);
  const half = payload.offset ?? 0;
  // Bars sit in bands (label at the band's centre); lines sit on points (first at the edge).
  const left = half > 0 ? x - half * (2 * payload.index + 1) : x - (payload.index * plotWidth) / Math.max(count - 1, 1);
  const w = labelWidth(text) / 2;
  const tx = Math.min(Math.max(x, left + w), left + plotWidth - w);
  return (
    <text x={tx} y={y} dy="0.71em" textAnchor="middle" fontSize={CHART_AXIS_FONT_SIZE} fill={CHART_LABEL_COLOR}>
      {text}
    </text>
  );
}
