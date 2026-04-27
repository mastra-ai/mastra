import type { CorrelationContext } from './core';

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
 * Descriptive correlation metadata travels in `correlationContext`.
 * Signal identity stays on the top-level `traceId` / `spanId` fields.
 */
export interface ExportedLog {
  /** Unique identifier for this log event, generated at emission time */
  logId: string;

  /** When the log was emitted */
  timestamp: Date;

  /** Trace associated with this log (undefined = not tied to a trace) */
  traceId?: string;

  /** Specific span associated with this log */
  spanId?: string;

  /** Log severity level */
  level: LogLevel;

  /** Human-readable log message */
  message: string;

  /** Structured data associated with this log */
  data?: Record<string, unknown>;

  /**
   * @deprecated Use `correlationContext.tags` instead.
   */
  tags?: string[];

  /** Canonical correlation context for this log event */
  correlationContext?: CorrelationContext;

  /**
   * User-defined metadata.
   * Canonical correlation fields should not be stored here.
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
