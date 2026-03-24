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
    <div className="rounded-md border border-border1 bg-surface2 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-icon6">{label}</p>
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
    </div>
  );
}
