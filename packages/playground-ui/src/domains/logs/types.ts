export type { LogLevel, LogRecord } from '@mastra/react/hooks/logs';
import type { LogLevel as RecordLogLevel } from '@mastra/react/hooks/logs';
import type { LogStreamIcon } from '@/ds/components/LogStream';

export interface LogViewLine {
  logId?: string | null;
  message: string;
  timestamp?: Date | string;
  level?: RecordLogLevel;
  icon?: LogStreamIcon;
  data?: Record<string, unknown> | null;
}
