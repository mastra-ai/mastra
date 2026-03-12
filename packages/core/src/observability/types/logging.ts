// ============================================================================
// Log Level
// ============================================================================

/** Log severity levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// ============================================================================
// LoggerContext (API Interface)
// ============================================================================

/**
 * LoggerContext - API for emitting structured logs.
 * Logs are automatically correlated with the current span's trace/span IDs.
 */
export interface LoggerContext {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  fatal(message: string, data?: Record<string, unknown>): void;
}

// ============================================================================
// ExportedLog (Event Bus Transport)
// ============================================================================

/**
 * Log data transported via the event bus.
 * Must be JSON-serializable (Date serializes via toJSON()).
 *
 * Context fields (runId, sessionId, userId, environment, etc.) are stored
 * in metadata, following the same pattern as tracing spans.
 */
export interface ExportedLog {
  /** When the log was emitted */
  timestamp: Date;

  /** Log severity level */
  level: LogLevel;

  /** Human-readable log message */
  message: string;

  /** Structured data associated with this log */
  data?: Record<string, unknown>;

  /** Trace ID for correlation (from current span) */
  traceId?: string;

  /** Span ID for correlation (from current span) */
  spanId?: string;

  /** Optional tags for filtering/categorization */
  tags?: string[];

  /**
   * User-defined metadata.
   * Context fields are stored here: runId, sessionId, userId, environment,
   * serviceName, organizationId, entityType, entityName, etc.
   * This follows the same pattern as BaseSpan.metadata in tracing.ts.
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// LogEvent (Event Bus Event)
// ============================================================================

/** Log event emitted to the ObservabilityBus */
export interface LogEvent {
  type: 'log';
  log: ExportedLog;
}
