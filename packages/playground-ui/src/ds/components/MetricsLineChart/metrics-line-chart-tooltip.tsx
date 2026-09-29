import { ChartTooltip } from '@/ds/components/ChartTooltip';

export function MetricsLineChartTooltip({
  active,
  payload,
  label,
  suffix,
  formatValue = value => value.toLocaleString('en-US'),
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  suffix?: string;
  formatValue?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltip>
      <p className="mb-1 text-column text-foreground">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} className="text-foreground">
          <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}:{' '}
          <span className="font-mono">
            {typeof entry.value === 'number' ? formatValue(entry.value) : entry.value}
            {suffix}
          </span>
        </p>
      ))}
    </ChartTooltip>
  );
}
