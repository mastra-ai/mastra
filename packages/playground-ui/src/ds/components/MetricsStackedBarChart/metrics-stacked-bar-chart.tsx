import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Rectangle,
} from 'recharts';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsLineChartLegend, MetricsLineChartTooltip } from '@/ds/components/MetricsLineChart';
import { ChartEdgeTick } from '@/ds/primitives/chart-edge-tick';
import type { ChartEdgeTickProps } from '@/ds/primitives/chart-edge-tick';
import { ChartGlowFilter } from '@/ds/primitives/chart-glow';
import { CHART_MARGIN, X_AXIS_HEIGHT } from '@/ds/primitives/chart-layout';
import { useChartDefsId } from '@/ds/primitives/use-chart-defs-id';
import { CHART_LABEL_COLOR, CHART_TICK_FONT_SIZE } from '@/ds/tokens';

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const tick = { fontSize: CHART_TICK_FONT_SIZE, fill: CHART_LABEL_COLOR, fontFamily: 'var(--font-mono)' };

/** Corner radius of every segment. Kept small so thin segments stay crisp rectangles. */
const RADIUS = 2;
/** Pixels trimmed off each stacked segment, so neighbouring segments read as separate blocks. */
const SEGMENT_GAP = 2;
/** Non-zero segments never shrink below this, so a handful of errors stays visible. */
const MIN_SEGMENT = 2;
/** Opacity at the base of a stacked segment's gradient (the top is fully opaque). */
const GRADIENT_BASE = 0.35;
/** Single-series bars: translucent body under a solid cap that marks the value. */
const CAP_BODY = 0.55;
const CAP_HEIGHT = 3;
/** Opacity of the other columns while one is hovered. */
const DIMMED = 0.3;

type SegmentProps = { x?: number; y?: number; width?: number; height?: number; index?: number };

function segmentShape({
  fill,
  color,
  capped,
  glow,
  hovered,
}: {
  fill: string;
  color: string;
  capped: boolean;
  glow: string;
  hovered: number | null;
}) {
  return function Segment({ x = 0, y = 0, width = 0, height = 0, index }: SegmentProps) {
    if (height <= 0) return <g />;
    const h = Math.max(MIN_SEGMENT, height - SEGMENT_GAP);
    const opacity = hovered !== null && hovered !== index ? DIMMED : 1;
    const style = { transition: 'opacity 150ms ease-out' };

    if (capped) {
      return (
        <g opacity={opacity} style={style}>
          <Rectangle x={x} y={y} width={width} height={h} radius={RADIUS} fill={color} fillOpacity={CAP_BODY} />
          <Rectangle x={x} y={y} width={width} height={Math.min(CAP_HEIGHT, h)} radius={RADIUS} fill={color} />
        </g>
      );
    }
    return (
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={h}
        radius={RADIUS}
        fill={fill}
        opacity={opacity}
        filter={`url(#${glow})`}
        style={style}
      />
    );
  };
}

export function MetricsStackedBarChart({
  data,
  series,
  height = 210,
  yDomain,
  valueFormatter,
  showLegend = true,
  referenceLine,
  variant = 'gradient',
}: {
  data: Record<string, unknown>[];
  series: MetricsLineChartSeries[];
  height?: number;
  yDomain?: [number, number];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  referenceLine?: { value: number; label: string; color: string };
  /**
   * `gradient`: segments fade toward the base, with a soft halo. Reads best for stacks.
   * `capped`: a translucent body under a solid cap that marks the value. Reads best for one
   * value per column, e.g. cold starts.
   */
  variant?: 'gradient' | 'capped';
}) {
  const id = useChartDefsId();
  const [hovered, setHovered] = useState<number | null>(null);
  const capped = variant === 'capped';

  return (
    <div>
      {showLegend && <MetricsLineChartLegend data={data} series={series} className="mb-4" />}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={CHART_MARGIN}
            onMouseMove={state => {
              const index = state?.activeTooltipIndex;
              setHovered(index === undefined || index === null ? null : Number(index));
            }}
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.dataKey} id={`${id}-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={GRADIENT_BASE} />
                </linearGradient>
              ))}
              <ChartGlowFilter id={`${id}-glow`} blur={4} alpha={0.4} />
            </defs>
            <CartesianGrid
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeDasharray="4 4"
              vertical={false}
              className="text-black dark:text-white"
            />
            <XAxis
              dataKey="time"
              height={X_AXIS_HEIGHT}
              tick={(props: Omit<ChartEdgeTickProps, 'count'>) => <ChartEdgeTick {...props} count={data.length} />}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={tick}
              tickLine={false}
              axisLine={false}
              width="auto"
              tickFormatter={(value: number) => (valueFormatter ?? compactNumber.format)(value)}
              domain={yDomain}
              tickCount={3}
            />
            <Tooltip cursor={false} content={<MetricsLineChartTooltip formatValue={valueFormatter} />} />
            {series.map((s, i) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.label}
                stackId="1"
                fill={s.color}
                maxBarSize={32}
                isAnimationActive={false}
                shape={segmentShape({
                  fill: `url(#${id}-bar-${i})`,
                  color: s.color,
                  capped,
                  glow: `${id}-glow`,
                  hovered,
                })}
              />
            ))}
            {referenceLine && (
              <ReferenceLine
                y={referenceLine.value}
                ifOverflow="extendDomain"
                stroke={referenceLine.color}
                strokeDasharray="4 4"
                label={{ value: referenceLine.label, position: 'insideTopLeft', ...tick }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
