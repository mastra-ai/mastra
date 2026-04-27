import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MetricsLineChartTooltip } from './metrics-line-chart-tooltip';

const LABEL_COLOR = '#a1a1aa';

export type MetricsLineChartSeries = {
  dataKey: string;
  label: string;
  color: string;
  aggregate?: (data: Record<string, unknown>[]) => { value: string; suffix?: string };
};

export function MetricsLineChart({
  data,
  series,
  height = 210,
  yDomain,
}: {
  data: Record<string, unknown>[];
  series: MetricsLineChartSeries[];
  height?: number;
  yDomain?: [number, number];
}) {
  return (
    <div>
      <div className="flex flex-wrap w-full items-end gap-4 gap-y-1 mb-4 ">
        {series.map(s => {
          const aggregated = s.aggregate?.(data);
          return (
            <div key={s.dataKey} className="inline-flex items-baseline gap-2">
              <div className="size-2 shrink-0 rounded-full -translate-y-px" style={{ backgroundColor: s.color }} />
              <span className="text-ui-sm text-neutral3 truncate max-w-24">{s.label}</span>
              {aggregated && (
                <span className="text-ui-sm text-neutral4">
                  {aggregated.value}
                  {aggregated.suffix && <span className="text-ui-sm text-neutral2"> {aggregated.suffix}</span>}
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
              vertical={false}
              className="text-black dark:text-white"
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: LABEL_COLOR, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              interval={5}
            />
            <YAxis
              tick={{ fontSize: 10, fill: LABEL_COLOR, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              width={30}
              domain={yDomain}
            />
            <Tooltip content={<MetricsLineChartTooltip />} />
            {series.map(s => (
              <Line
                key={s.dataKey}
                type="linear"
                dataKey={s.dataKey}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                name={s.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
