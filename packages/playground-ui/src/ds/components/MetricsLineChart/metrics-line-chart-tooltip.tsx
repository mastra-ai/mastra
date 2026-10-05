import { ChartTooltip } from '@/ds/components/ChartTooltip';
import { Txt } from '@/ds/components/Txt';

export function MetricsLineChartTooltip({
  active,
  payload,
  label,
  suffix,
  formatValue = value => value.toLocaleString('en-US'),
  showTotal = false,
  labelKey,
  formatByKey,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey?: string | number;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  suffix?: string;
  formatValue?: (value: number) => string;
  /** Adds a "Total" row under a hairline: the sum of every row, e.g. a stacked column's height. */
  showTotal?: boolean;
  /** Read the heading from this field of the hovered row instead of the x-axis label. */
  labelKey?: string;
  /** Per-series formatters, by data key, for charts that mix units (counts and durations). */
  formatByKey?: Record<string, (value: number) => string>;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0), 0);
  const heading = labelKey ? String(payload[0]?.payload?.[labelKey] ?? label ?? '') : label;
  const format = (entry: { dataKey?: string | number }) => formatByKey?.[String(entry.dataKey)] ?? formatValue;
  return (
    <ChartTooltip>
      <Txt variant="column" tone="ink" className="mb-1">
        {heading}
      </Txt>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
        {payload.map(entry => (
          <div key={entry.name} className="contents">
            <span className="size-2 rounded-[2px]" style={{ backgroundColor: entry.color }} />
            <Txt as="span" variant="caption" tone="muted" className="max-w-40 truncate">
              {entry.name}
            </Txt>
            <span className="text-right font-mono text-foreground tabular-nums">
              {typeof entry.value === 'number' ? format(entry)(entry.value) : entry.value}
              {suffix}
            </span>
          </div>
        ))}
        {showTotal && (
          <div className="col-span-3 grid grid-cols-subgrid items-center border-t border-border pt-1">
            <Txt as="span" variant="caption" tone="muted" className="col-span-2">
              Total
            </Txt>
            <span className="text-right font-mono text-foreground tabular-nums">
              {formatValue(total)}
              {suffix}
            </span>
          </div>
        )}
      </div>
    </ChartTooltip>
  );
}
