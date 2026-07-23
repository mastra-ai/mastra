import type { ReactNode } from 'react';

type MetricsBarChartTooltipEntry = {
  color?: string;
  dataKey?: string | number;
  fill?: string;
  name?: string | number;
  value?: string | number;
};

export function MetricsBarChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: Array<MetricsBarChartTooltipEntry>;
  label?: unknown;
  labelFormatter?: (value: unknown) => ReactNode;
}) {
  if (!active || !payload?.length) return null;

  const formattedLabel = labelFormatter?.(label) ?? String(label ?? '');

  return (
    <div className="min-w-32 rounded-md border border-border2 bg-surface3 px-2.5 py-2 text-ui-xs">
      <p className="mb-1 font-medium text-icon6">{formattedLabel}</p>
      {payload.map(entry => {
        if (entry.value === undefined) return null;

        const entryKey = String(entry.dataKey ?? entry.name ?? 'value');
        const entryName = String(entry.name ?? entry.dataKey ?? 'Value');
        const entryValue = typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value;

        return (
          <p key={entryKey} className="flex items-center justify-between gap-3 text-icon3">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-sm"
                style={{ backgroundColor: entry.color ?? entry.fill }}
              />
              {entryName}
            </span>
            <span className="font-medium tabular-nums text-icon6">{entryValue}</span>
          </p>
        );
      })}
    </div>
  );
}
