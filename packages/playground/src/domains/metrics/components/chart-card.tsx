import { ChartTooltip } from '@mastra/playground-ui/components/ChartTooltip';
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
    <div className={`flex flex-col rounded-lg border border-border bg-background ${className}`}>
      <div className="flex shrink-0 items-start justify-between px-4 py-3">
        <div>
          <h3 className="text-subheading text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-caption text-placeholder">{description}</p>}
        </div>
        {summary && (
          <div className="text-right">
            <span className="text-subheading text-foreground tabular-nums">{summary}</span>
            {summaryLabel && <p className="text-caption text-placeholder">{summaryLabel}</p>}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3 pb-4">{children}</div>
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
    <ChartTooltip>
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} className="text-placeholder">
          <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}:{' '}
          <span className="tabular-nums">
            {entry.value}
            {suffix}
          </span>
        </p>
      ))}
    </ChartTooltip>
  );
}
