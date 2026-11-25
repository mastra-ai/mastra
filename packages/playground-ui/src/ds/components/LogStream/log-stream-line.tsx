import { logLevelTextClass } from './log-level-styles';
import type { LogLevel } from './log-level-styles';
import { cn } from '@/lib/utils';
import { formatLogLineTimestamp, toDate } from '@/utils/date-format';

const COLLAPSED_LINE_COUNT = 3;

function formatFieldValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function parseJsonObject(message: string): Record<string, unknown> | undefined {
  const trimmed = message.trim();
  if (!trimmed.startsWith('{')) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : undefined;
  } catch {
    return undefined;
  }
}

function LogFields({ entries }: { entries: Array<[string, unknown]> }) {
  return entries.map(([key, value]) => (
    <span key={key} className="ml-3 first:ml-0">
      <span className="text-muted-foreground">{key}:</span> {formatFieldValue(value)}
    </span>
  ));
}

function LogMessage({ message, collapse }: { message: string; collapse: boolean }) {
  const json = parseJsonObject(message);
  if (json) return <LogFields entries={Object.entries(json)} />;

  const lines = message.split('\n');
  const hidden = lines.length - COLLAPSED_LINE_COUNT;
  if (!collapse || hidden < 2) return <>{message}</>;

  return (
    <>
      {lines.slice(0, COLLAPSED_LINE_COUNT).join('\n')}
      {'\n'}
      <span className="text-muted-foreground">+{hidden} more lines</span>
    </>
  );
}

function LogTime({ timestamp }: { timestamp: Date | string }) {
  const parts = formatLogLineTimestamp(timestamp);
  if (!parts) return <time>{String(timestamp)}</time>;
  return (
    <time dateTime={toDate(timestamp)?.toISOString()}>
      {parts.day} <span className="text-foreground">{parts.time}</span>
      {parts.fraction}
    </time>
  );
}

export interface LogStreamLineProps {
  timestamp: Date | string;
  level: LogLevel;
  message: string;
  fields?: Record<string, unknown>;
  wrap?: boolean;
  collapse?: boolean;
}

export function LogStreamLine({ timestamp, level, message, fields, wrap = true, collapse = true }: LogStreamLineProps) {
  const fieldEntries = fields ? Object.entries(fields) : [];

  return (
    <>
      <span className="font-mono text-body-sm whitespace-nowrap text-muted-foreground tabular-nums">
        <LogTime timestamp={timestamp} />
      </span>
      <span className={cn('font-mono text-body-sm uppercase', logLevelTextClass[level])}>{level}</span>
      <span
        className={cn(
          'min-w-0 font-mono text-body-sm text-foreground @max-md:col-span-full',
          wrap ? 'wrap-anywhere whitespace-pre-wrap' : 'whitespace-pre',
        )}
      >
        <LogMessage message={message} collapse={collapse} />
        {fieldEntries.length > 0 && (
          <span className="ml-3">
            <LogFields entries={fieldEntries} />
          </span>
        )}
      </span>
    </>
  );
}
