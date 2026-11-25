export type { LogLevel, LogRecord } from '@mastra/react/hooks/logs';
import type { LogLevel as RecordLogLevel } from '@mastra/react/hooks/logs';
import type { LogStreamLabel } from '@/ds/components/LogStream';

export interface LogViewLine {
  logId?: string | null;
  message: string;
  timestamp?: Date | string;
  level?: RecordLogLevel;
  labels?: LogStreamLabel[];
  data?: Record<string, unknown> | null;
}
