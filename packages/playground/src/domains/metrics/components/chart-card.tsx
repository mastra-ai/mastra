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
    <div className={`border-border1 bg-surface2 flex flex-col rounded-lg border ${className}`}>
      <div className="flex shrink-0 items-start justify-between px-4 py-3">
        <div>
          <h3 className="text-icon6 text-subheading">{title}</h3>
          {description && <p className="text-icon2 text-caption mt-0.5">{description}</p>}
        </div>
        {summary && (
          <div className="text-right">
            <span className="text-icon6 text-subheading font-mono">{summary}</span>
            {summaryLabel && <p className="text-icon2 text-caption">{summaryLabel}</p>}
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
      <p className="text-icon6 mb-1 font-medium">{label}</p>
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
