import { useId, type ReactNode } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { MetricsBarChartTooltip } from './metrics-bar-chart-tooltip';

const AXIS_TICK_STYLE = {
  fill: 'var(--neutral3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
};
const BAR_RADIUS: [number, number, number, number] = [4, 4, 4, 4];
const ACTIVE_BAR_STYLE = { fillOpacity: 1 };
const BAR_FILL_OPACITY = 0.78;
const CHART_MARGIN = { left: 0, right: 8 };
const TOOLTIP_CURSOR = { fill: 'var(--surface4)', opacity: 0.55 };

export type MetricsBarChartSeries = {
  dataKey: string;
  label: string;
  color: string;
  appearance?: 'solid' | 'dotted';
};

export type MetricsBarChartProps = {
  data: Array<Record<string, unknown>>;
  series: Array<MetricsBarChartSeries>;
  description?: string;
  height?: number;
  xAxisDataKey?: string;
  xAxisInterval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd';
  xAxisMinTickGap?: number;
  xAxisTickFormatter?: (value: unknown, index: number) => string;
  tooltipLabelFormatter?: (value: unknown) => ReactNode;
};

/**
 * Responsive metric bars with the shared Playground chart palette, axes, and tooltip.
 * Recharts stays encapsulated so consumers do not need their own chart dependency.
 */
export function MetricsBarChart({
  data,
  series,
  description,
  height = 210,
  xAxisDataKey = 'time',
  xAxisInterval = 5,
  xAxisMinTickGap,
  xAxisTickFormatter,
  tooltipLabelFormatter,
}: MetricsBarChartProps) {
  const patternPrefix = useId().replaceAll(':', '');

  return (
    <div className="min-w-0 [&_.recharts-surface]:outline-none" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart accessibilityLayer data={data} desc={description} margin={CHART_MARGIN}>
          <defs>
            {series.map(item =>
              item.appearance === 'dotted' ? (
                <pattern
                  key={item.dataKey}
                  id={`${patternPrefix}-${item.dataKey}`}
                  x="0"
                  y="0"
                  width="5"
                  height="5"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="5" height="5" fill={item.color} opacity="0.08" />
                  <circle cx="2.5" cy="2.5" r="1" fill={item.color} opacity="0.58" />
                </pattern>
              ) : null,
            )}
          </defs>
          <XAxis
            dataKey={xAxisDataKey}
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={xAxisInterval}
            minTickGap={xAxisMinTickGap}
            tickFormatter={xAxisTickFormatter}
          />
          <YAxis
            tick={AXIS_TICK_STYLE}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={30}
          />
          <Tooltip cursor={TOOLTIP_CURSOR} content={<MetricsBarChartTooltip labelFormatter={tooltipLabelFormatter} />} />
          {series.map(item => (
            <Bar
              key={item.dataKey}
              dataKey={item.dataKey}
              name={item.label}
              fill={item.appearance === 'dotted' ? `url(#${patternPrefix}-${item.dataKey})` : item.color}
              fillOpacity={BAR_FILL_OPACITY}
              activeBar={ACTIVE_BAR_STYLE}
              stroke={item.appearance === 'dotted' ? item.color : undefined}
              strokeWidth={item.appearance === 'dotted' ? 1 : undefined}
              radius={BAR_RADIUS}
              maxBarSize={24}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
