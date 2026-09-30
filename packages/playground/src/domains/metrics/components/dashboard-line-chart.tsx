import { Txt } from '@mastra/playground-ui/components/Txt';
import { CHART_LABEL_COLOR, CHART_TICK_FONT_SIZE } from '@mastra/playground-ui/tokens';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CustomTooltip } from './chart-card';

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
      <div className="mb-4 flex flex-wrap items-end gap-4">
        {series.map(s => {
          const aggregated = s.aggregate?.(data);
          return (
            <div key={s.dataKey}>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                <Txt as="span" variant="meta" tone="muted" className="uppercase">
                  {s.label}
                </Txt>
              </div>
              {aggregated && (
                <Txt tone="muted" className="pl-5">
                  {aggregated.value}
                  {aggregated.suffix && (
                    <Txt as="span" variant="caption" tone="faint">
                      {' '}
                      {aggregated.suffix}
                    </Txt>
                  )}
                </Txt>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: CHART_TICK_FONT_SIZE, fill: CHART_LABEL_COLOR, fontVariantNumeric: 'tabular-nums' }}
              tickLine={false}
              axisLine={false}
              interval={5}
            />
            <YAxis
              tick={{ fontSize: CHART_TICK_FONT_SIZE, fill: CHART_LABEL_COLOR, fontVariantNumeric: 'tabular-nums' }}
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
