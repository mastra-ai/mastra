export type { LogLevel, LogRecord } from '@mastra/react/hooks/logs';
import type { LogLevel as RecordLogLevel } from '@mastra/react/hooks/logs';
import type { LogStreamOrigin } from '@/ds/components/LogStream';

export interface LogViewLine {
  logId?: string | null;
  message: string;
  timestamp?: Date | string;
  level?: RecordLogLevel;
  origin?: LogStreamOrigin;
  data?: Record<string, unknown> | null;
}
