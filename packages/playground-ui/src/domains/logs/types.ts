export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LOG_LEVEL_OPTIONS = [
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
  { label: 'Fatal', value: 'fatal' },
] as const satisfies readonly { label: string; value: LogLevel }[];

export interface LogRecord {
  timestamp: Date | string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown> | null;

  // Correlation
  traceId?: string | null;
  spanId?: string | null;

  // Entity identification
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;

  // Parent entity hierarchy
  parentEntityType?: string | null;
  parentEntityId?: string | null;
  parentEntityName?: string | null;

  // Root entity hierarchy
  rootEntityType?: string | null;
  rootEntityId?: string | null;
  rootEntityName?: string | null;

  // Identity & tenancy
  userId?: string | null;
  organizationId?: string | null;
  resourceId?: string | null;

  // Correlation IDs
  runId?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
  requestId?: string | null;

  // Deployment context
  environment?: string | null;
  source?: string | null;
  serviceName?: string | null;
  scope?: string | null;

  // Experimentation
  experimentId?: string | null;

  // Filtering
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
}
