import { labelWidth, placeTimeTick } from './chart-axes';
import { CHART_AXIS_FONT_SIZE } from './chart-layout';
import { CHART_LABEL_COLOR } from '@/ds/tokens';

export type ChartTimeTickProps = {
  x?: number;
  y?: number;
  /** The axis' drawn width, which Recharts passes to every tick: the plot's real width. */
  width?: number;
  index?: number;
  payload?: { value: string; index: number; offset?: number };
  /** Buckets that print a label (from `pickTimeTicks`). */
  picked: Set<number>;
  count: number;
};

/**
 * An x label on picked buckets only, centred on its bucket and pinned inside the plot at its
 * edges, so the chart needs no side margin.
 */
export function ChartTimeTick({ x = 0, y = 0, width, payload, picked, count }: ChartTimeTickProps) {
  if (!payload || !width || !picked.has(payload.index)) return null;
  const text = String(payload.value);
  const placed = placeTimeTick({
    x,
    index: payload.index,
    offset: payload.offset,
    count,
    plotWidth: width,
    textWidth: labelWidth(text),
  });
  return (
    <text
      x={placed.x}
      y={y}
      dy="0.71em"
      textAnchor={placed.anchor}
      fontSize={CHART_AXIS_FONT_SIZE}
      fill={CHART_LABEL_COLOR}
    >
      {text}
    </text>
  );
}
