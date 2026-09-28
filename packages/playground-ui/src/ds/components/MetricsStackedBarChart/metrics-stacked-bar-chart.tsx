import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsLineChartLegend, MetricsLineChartTooltip } from '@/ds/components/MetricsLineChart';
import { CHART_LABEL_COLOR, CHART_TICK_FONT_SIZE } from '@/ds/tokens';

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const tick = { fontSize: CHART_TICK_FONT_SIZE, fill: CHART_LABEL_COLOR, fontFamily: 'var(--font-mono)' };

export function MetricsStackedBarChart({
  data,
  series,
  height = 210,
  yDomain,
  valueFormatter,
  showLegend = true,
  referenceLine,
}: {
  data: Record<string, unknown>[];
  series: MetricsLineChartSeries[];
  height?: number;
  yDomain?: [number, number];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  referenceLine?: { value: number; label: string; color: string };
}) {
  return (
    <div>
      {showLegend && <MetricsLineChartLegend data={data} series={series} className="mb-4" />}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeDasharray="4 4"
              vertical={false}
              className="text-black dark:text-white"
            />
            <XAxis
              dataKey="time"
              tick={tick}
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
            {series.map(s => (
              <Bar key={s.dataKey} dataKey={s.dataKey} name={s.label} stackId="1" fill={s.color} maxBarSize={32} />
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
