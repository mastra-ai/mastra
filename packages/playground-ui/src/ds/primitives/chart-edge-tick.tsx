import { CHART_LABEL_COLOR, CHART_TICK_FONT_SIZE } from '@/ds/tokens';

export type ChartEdgeTickProps = {
  x?: number;
  y?: number;
  index?: number;
  payload?: { value: string; index: number; offset?: number };
  /** Number of data points on the axis, to recognise the last bucket. */
  count: number;
};

/**
 * X-axis label that stays inside the plot, so the chart needs no side margin and lines up
 * with the card's content: the first label starts at the plot's left edge and a label on the
 * last bucket ends at the right edge. Every other label stays centred on its bucket.
 */
export function ChartEdgeTick({ x = 0, y = 0, index, payload, count }: ChartEdgeTickProps) {
  if (!payload) return null;
  const half = payload.offset ?? 0;
  const first = index === 0;
  const last = !first && payload.index === count - 1;
  return (
    <text
      x={first ? x - half : last ? x + half : x}
      y={y}
      dy="0.71em"
      textAnchor={first ? 'start' : last ? 'end' : 'middle'}
      fontSize={CHART_TICK_FONT_SIZE}
      fill={CHART_LABEL_COLOR}
      fontFamily="var(--font-mono)"
    >
      {payload.value}
    </text>
  );
}
