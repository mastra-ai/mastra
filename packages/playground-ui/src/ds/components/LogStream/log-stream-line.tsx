import { logLevelTextClass } from './log-level-styles';
import type { LogLevel } from './log-level-styles';
import { LogStreamFields, LogStreamMessage } from './log-stream-message';
import { LogStreamTime } from './log-stream-time';
import { Badge } from '@/ds/components/Badge';
import type { BadgeVariant } from '@/ds/components/Badge';
import { cn } from '@/lib/utils';
import type { FractionDigits } from '@/utils/date-format';

export interface LogStreamLabel {
  text: string;
  variant?: BadgeVariant;
}

export interface LogStreamLineProps {
  message: string;
  timestamp?: Date | string;
  fractionDigits?: FractionDigits;
  level?: LogLevel;
  labels?: LogStreamLabel[];
  fields?: Record<string, unknown>;
  wrap?: boolean;
  collapse?: boolean;
}

export function LogStreamLine({
  message,
  timestamp,
  fractionDigits,
  level,
  labels,
  fields,
  wrap = true,
  collapse = true,
}: LogStreamLineProps) {
  const fieldEntries = fields ? Object.entries(fields) : [];

  return (
    <>
      <span className="font-mono text-body-sm whitespace-nowrap text-muted-foreground tabular-nums">
        {timestamp !== undefined && <LogStreamTime timestamp={timestamp} fractionDigits={fractionDigits} />}
      </span>
      <span className={cn('font-mono text-body-sm uppercase', level && logLevelTextClass[level])}>{level}</span>
      <span
        className={cn(
          'min-w-0 font-mono text-body-sm text-foreground @max-md:col-span-full',
          wrap ? 'wrap-anywhere whitespace-pre-wrap' : 'whitespace-pre',
        )}
      >
        {labels?.map((label, index) => (
          <Badge
            key={`${index}-${label.text}`}
            variant={label.variant}
            emphasis="subtle"
            size="xs"
            className="mr-1.5 align-text-bottom"
          >
            {label.text}
          </Badge>
        ))}
        <LogStreamMessage message={message} collapse={collapse} />
        {fieldEntries.length > 0 && (
          <span className="ml-3">
            <LogStreamFields entries={fieldEntries} />
          </span>
        )}
      </span>
    </>
  );
}
