import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CustomTooltip } from './chart-card';
const LABEL_COLOR = '#a1a1aa';

type Series = {
  dataKey: string;
  label: string;
  color: string;
  aggregate?: (data: Record<string, unknown>[]) => { value: string; suffix?: string };
};

export function DashboardLineChart({
  data,
  series,
  height = 200,
  yDomain,
}: {
  data: Record<string, unknown>[];
  series: Series[];
  height?: number;
  yDomain?: [number, number];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        {series.map(s => {
          const aggregated = s.aggregate?.(data);
          return (
            <div key={s.dataKey}>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-ui-xs text-neutral3 uppercase">{s.label}</span>
              </div>
              {aggregated && (
                <p className="text-ui-md text-neutral4 pl-5">
                  {aggregated.value}
                  {aggregated.suffix && <span className="text-ui-sm text-neutral2"> {aggregated.suffix}</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
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
            <Tooltip content={<CustomTooltip />} />
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
