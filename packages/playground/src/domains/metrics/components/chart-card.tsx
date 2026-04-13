import type { ReactNode } from 'react';

export function ChartCard({
  title,
  description,
  summary,
  summaryLabel,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  summary?: string;
  summaryLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col rounded-lg border border-border1 bg-surface2 ${className}`}>
      <div className="flex items-start justify-between px-4 py-3 shrink-0">
        <div>
          <h3 className="text-base font-semibold text-icon6">{title}</h3>
          {description && <p className="text-xs text-icon2 mt-0.5">{description}</p>}
        </div>
        {summary && (
          <div className="text-right">
            <span className="text-base font-semibold font-mono text-icon6">{summary}</span>
            {summaryLabel && <p className="text-xs text-icon2">{summaryLabel}</p>}
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col px-4 pt-3 pb-4">{children}</div>
    </div>
  );
}

export function CustomTooltip({
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
