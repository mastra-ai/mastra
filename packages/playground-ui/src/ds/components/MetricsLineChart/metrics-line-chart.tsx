import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MetricsLineChartTooltip } from './metrics-line-chart-tooltip';
import { CHART_LABEL_COLOR, CHART_TICK_FONT_SIZE } from '@/ds/tokens';

export type MetricsLineChartSeries = {
  dataKey: string;
  label: string;
  color: string;
  aggregate?: (data: Record<string, unknown>[]) => { value: string; suffix?: string };
};

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

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
      stroke="currentColor"
      strokeOpacity={0.2}
      strokeWidth={1}
      className="pointer-events-none text-black transition-transform duration-150 ease-out dark:text-white"
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
  xAxisInterval = 5,
  xAxisMinTickGap,
  showDots = false,
}: {
  data: Record<string, unknown>[];
  series: MetricsLineChartSeries[];
  height?: number;
  yDomain?: [number, number];
  onPointClick?: MetricsLineChartPointClickHandler;
  /** X-axis tick density. Default `5` (every 6th point). Pass
   * `"preserveStartEnd"` with `xAxisMinTickGap` for a width-responsive axis. */
  xAxisInterval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd';
  /** Minimum px gap between rendered ticks; recharts drops labels to honor it. */
  xAxisMinTickGap?: number;
  /** Render a visible dot on every point (needed for single-point series). */
  showDots?: boolean;
}) {
  const isClickable = typeof onPointClick === 'function';

  return (
    <div>
      <div className="mb-4 flex w-full flex-wrap items-end gap-4 gap-y-1">
        {series.map(s => {
          const aggregated = s.aggregate?.(data);
          return (
            <div key={s.dataKey} className="inline-flex items-baseline gap-2">
              <div className="size-2 shrink-0 -translate-y-px rounded-full" style={{ backgroundColor: s.color }} />
              <span className="max-w-24 truncate text-caption text-muted-foreground">{s.label}</span>
              {aggregated && (
                <span className="text-caption text-muted-foreground">
                  {aggregated.value}
                  {aggregated.suffix && <span className="text-caption text-placeholder"> {aggregated.suffix}</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeDasharray="4 4"
              vertical={false}
              className="text-black dark:text-white"
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: CHART_TICK_FONT_SIZE, fill: CHART_LABEL_COLOR, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              interval={xAxisInterval}
              minTickGap={xAxisMinTickGap}
            />
            <YAxis
              tick={{ fontSize: CHART_TICK_FONT_SIZE, fill: CHART_LABEL_COLOR, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              width="auto"
              tickFormatter={(value: number) => compactNumber.format(value)}
              domain={yDomain}
              tickCount={3}
            />
            <Tooltip content={<MetricsLineChartTooltip />} cursor={<SmoothCursor />} />
            {series.map(s => (
              <Line
                key={s.dataKey}
                type="linear"
                dataKey={s.dataKey}
                stroke={s.color}
                strokeWidth={2}
                dot={showDots ? { r: 3, fill: s.color, strokeWidth: 0 } : false}
                activeDot={
                  isClickable
                    ? {
                        r: 4,
                        stroke: s.color,
                        strokeOpacity: 0.3,
                        strokeWidth: 4,
                        style: { cursor: 'pointer' },
                        onClick: (_: unknown, payload: unknown) => {
                          const datum = (payload as { payload?: Record<string, unknown> } | undefined)?.payload;
                          if (datum) onPointClick(datum, s.dataKey);
                        },
                      }
                    : { r: 4, stroke: s.color, strokeOpacity: 0.3, strokeWidth: 4 }
                }
                name={s.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
