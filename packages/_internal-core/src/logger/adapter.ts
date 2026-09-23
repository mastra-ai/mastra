import type { IMastraLogger } from './index';

/**
 * OpenTelemetry-compatible trace correlation fields, injected at the top
 * level of a logger's native record.
 *
 * Field names are part of the platform contract (snake_case, W3C formats):
 * external consumers (e.g. the Studio logs view reading Railway stdout)
 * parse structured log lines and look for exactly these keys.
 */
export interface TraceFields {
  /** 32-char lowercase hex W3C trace id */
  trace_id: string;
  /**
   * 16-char lowercase hex W3C span id.
   *
   * Optional, and omitted rather than emitted empty: the active span may be
   * one observability never exports (an internal span, or one dropped by
   * `excludeSpanTypes`), leaving no span id a consumer could look up. The
   * trace is still addressable in that case, so the line keeps `trace_id` and
   * drops only this field. Consumers must treat `span_id` as possibly absent.
   */
  span_id?: string;
}

/**
 * Destination for log records derived from the logger's native record,
 * exported to Mastra observability. Structurally compatible with
 * `LoggerContext` from `@mastra/core/observability`.
 */
export interface AdapterLogSink {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface LoggerAdapterOptions {
  /** Inject trace_id/span_id into the logger's native records. */
  correlation: boolean;
  /** Export records derived from the native record to Mastra observability. */
  export: boolean;
}

/**
 * Context handed to an adaptable logger by Mastra when observability is
 * wired up. All members are safe to call on every log call (synchronous,
 * never throw).
 */
export interface LoggerAdapterContext {
  /**
   * Resolve correlation fields for the currently active span, or undefined
   * when no span is active (in which case no trace fields are added).
   */
  resolveTraceFields: () => TraceFields | undefined;
  /**
   * Resolve the observability log sink at call time. Returns the
   * span-correlated sink when a span is active, the global sink otherwise,
   * and undefined when export is disabled or observability is not
   * initialized. Records must still be written to the native destination
   * regardless.
   */
  getLogSink: () => AdapterLogSink | undefined;
  options: LoggerAdapterOptions;
}

/**
 * Capability marker a logger implements to opt into native trace
 * correlation and observability export. When a configured logger implements
 * this, Mastra attaches observability directly instead of wrapping the
 * logger in the deprecated `DualLogger`.
 */
export interface AdaptableLogger extends IMastraLogger {
  __attachObservability(ctx: LoggerAdapterContext): void;
  /**
   * Stable identity for the attachment target. Loggers whose adapter context
   * lives in state shared across a root/child family (e.g. PinoLogger's
   * mixin ref cell) return that shared object, so attaching any family
   * member is recognized as re-attaching the whole family. Defaults to the
   * logger instance itself when absent.
   */
  __observabilityAttachmentKey?(): object;
}

export function isAdaptableLogger(logger: IMastraLogger): logger is AdaptableLogger {
  return typeof (logger as Partial<AdaptableLogger>).__attachObservability === 'function';
}

/**
 * Export a tracked exception through the adapter sink, mirroring the
 * DualLogger dual-write shape (`errorId`/`domain`/`category`/`details`/`cause`
 * when present on a MastraError-like value). Never throws into the caller.
 */
export function exportTrackedException(
  ctx: LoggerAdapterContext | undefined,
  error: Error,
  metadata?: Record<string, unknown>,
): void {
  if (!ctx?.options.export) return;
  try {
    const mastraError = error as Error & {
      id?: string;
      domain?: string;
      category?: string;
      details?: Record<string, unknown>;
    };
    ctx.getLogSink()?.error(error.message, {
      ...(mastraError.id !== undefined ? { errorId: mastraError.id } : {}),
      ...(mastraError.domain !== undefined ? { domain: mastraError.domain } : {}),
      ...(mastraError.category !== undefined ? { category: mastraError.category } : {}),
      ...(mastraError.details !== undefined ? { details: mastraError.details } : {}),
      ...(error.cause instanceof Error ? { cause: error.cause.message } : {}),
      ...metadata,
    });
  } catch {
    // Never let observability export break the primary logger
  }
}

/**
 * Adapt IMastraLogger's variadic args into the structured `data` payload of
 * an exported log record. Extracts the first plain object as data,
 * serializes an Error arg, and collects remaining primitives under `args`
 * so the derived record preserves all context from the native call.
 */
export function buildLogRecordData(args: unknown[]): Record<string, unknown> | undefined {
  const objectData = args.find(
    (arg): arg is Record<string, unknown> =>
      arg !== null && typeof arg === 'object' && !Array.isArray(arg) && !(arg instanceof Error),
  );
  const errorArg = args.find((arg): arg is Error => arg instanceof Error);
  const extraArgs = args.filter(arg => arg !== objectData && arg !== errorArg);

  if (!objectData && !errorArg && extraArgs.length === 0) return undefined;

  return {
    ...(objectData ?? {}),
    ...(errorArg
      ? {
          error: {
            name: errorArg.name,
            message: errorArg.message,
            stack: errorArg.stack,
          },
        }
      : {}),
    ...(extraArgs.length > 0 ? { args: extraArgs } : {}),
  };
}
