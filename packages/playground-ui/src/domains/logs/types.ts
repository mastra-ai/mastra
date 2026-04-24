export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogRecord {
  /** Canonical unique id assigned by the storage backend. When present, used directly as the
   *  row id; otherwise a content hash is derived. */
  logId?: string | null;
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
  scope?: Record<string, unknown> | null;

  // Experimentation
  experimentId?: string | null;

  // Filtering
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
}
