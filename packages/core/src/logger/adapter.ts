import type { IMastraLogger, TraceFields } from '@internal/core/logger';
import { resolveCurrentSpan } from '../observability/utils';

export {
  isAdaptableLogger,
  buildLogRecordData,
  type AdaptableLogger,
  type AdapterLogSink,
  type LoggerAdapterContext,
  type LoggerAdapterOptions,
  type TraceFields,
} from '@internal/core/logger';

/**
 * Resolve OpenTelemetry-compatible correlation fields for the currently
 * active span (AsyncLocalStorage-backed), or undefined when no span is
 * active. Span/trace ids are already W3C hex format internally.
 */
export function resolveTraceFields(): TraceFields | undefined {
  const span = resolveCurrentSpan();
  if (!span?.traceId || !span.id) return undefined;
  return { trace_id: span.traceId, span_id: span.id };
}

// ---------------------------------------------------------------------------
// Observability export suppression
//
// Observability internals (exporters, buses) log through the same configured
// logger. With adapters, that logger exports records back into observability,
// which could feed on itself (export fails → error log → export → ...).
// Mastra hands observability an export-suppressed view of the logger; the
// adapter wiring checks the flag synchronously on every log call.
// ---------------------------------------------------------------------------

let observabilityExportSuppressed = false;

/** @internal True while inside an export-suppressed log call. */
export function isObservabilityExportSuppressed(): boolean {
  return observabilityExportSuppressed;
}

/**
 * @internal Wrap a logger so its records are written natively (with trace
 * correlation) but never exported back into observability. Used when handing
 * the configured logger to observability internals.
 */
export function createExportSuppressedLogger(inner: IMastraLogger): IMastraLogger {
  const suppressed = <T>(fn: () => T): T => {
    const previous = observabilityExportSuppressed;
    observabilityExportSuppressed = true;
    try {
      return fn();
    } finally {
      observabilityExportSuppressed = previous;
    }
  };

  return {
    debug: (message, ...args) => suppressed(() => inner.debug(message, ...args)),
    info: (message, ...args) => suppressed(() => inner.info(message, ...args)),
    warn: (message, ...args) => suppressed(() => inner.warn(message, ...args)),
    error: (message, ...args) => suppressed(() => inner.error(message, ...args)),
    trackException: (error, metadata) => suppressed(() => inner.trackException(error, metadata)),
    getTransports: () => inner.getTransports(),
    listLogs: (transportId, params) => inner.listLogs(transportId, params),
    listLogsByRunId: args => inner.listLogsByRunId(args),
  };
}
