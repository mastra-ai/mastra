import { logLevelTextClass } from './log-level-styles';
import type { LogLevel } from './log-level-styles';
import { LogStreamLineIcon } from './log-stream-icon';
import type { LogStreamIcon } from './log-stream-icon';
import { LogStreamFields, LogStreamMessage } from './log-stream-message';
import { LogStreamTime } from './log-stream-time';
import { cn } from '@/lib/utils';
import type { FractionDigits } from '@/utils/date-format';

export interface LogStreamLineProps {
  message: string;
  timestamp?: Date | string;
  fractionDigits?: FractionDigits;
  level?: LogLevel;
  icon?: LogStreamIcon;
  fields?: Record<string, unknown>;
  wrap?: boolean;
  collapse?: boolean;
}

export function LogStreamLine({
  message,
  timestamp,
  fractionDigits,
  level,
  icon,
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
        {icon && <LogStreamLineIcon element={icon.element} label={icon.label} />}
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
