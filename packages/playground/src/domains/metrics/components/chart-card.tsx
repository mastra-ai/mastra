import { ChartTooltip } from '@mastra/playground-ui/components/ChartTooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
          <Txt as="h3" variant="subheading" tone="ink">
            {title}
          </Txt>
          {description && (
            <Txt variant="caption" tone="faint" className="mt-0.5">
              {description}
            </Txt>
          )}
        </div>
        {summary && (
          <div className="text-right">
            <Txt as="span" variant="subheading" tone="ink" className="tabular-nums">
              {summary}
            </Txt>
            {summaryLabel && (
              <Txt variant="caption" tone="faint">
                {summaryLabel}
              </Txt>
            )}
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
      <Txt as="p" variant="label" tone="ink" className="mb-1">
        {label}
      </Txt>
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
