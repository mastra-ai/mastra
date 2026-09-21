import { ChartTooltip } from '@/ds/components/ChartTooltip';

export function MetricsLineChartTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltip>
      <p className="text-icon6 text-column mb-1">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} className="text-icon2">
          <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}:{' '}
          <span className="font-mono">
            {entry.value}
            {suffix}
          </span>
        </p>
      ))}
    </ChartTooltip>
  );
}
