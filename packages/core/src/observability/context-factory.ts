// packages/core/src/observability/context-factory.ts

import { noOpLoggerContext, noOpMetricsContext, noOpTracingContext } from './no-op';
import type { LoggerContext, MetricsContext, ObservabilityContext, TracingContext } from './types';

// ============================================================================
// Context Derivation
// ============================================================================

/**
 * Derives a LoggerContext from the current span's ObservabilityInstance.
 * Falls back to no-op when there is no span or the instance doesn't support logging.
 */
function deriveLoggerContext(tracing: TracingContext): LoggerContext {
  const span = tracing.currentSpan;
  return span?.observabilityInstance?.getLoggerContext?.(span) ?? noOpLoggerContext;
}

/**
 * Derives a MetricsContext from the current span's ObservabilityInstance.
 * Falls back to no-op when there is no span or the instance doesn't support metrics.
 */
function deriveMetricsContext(tracing: TracingContext): MetricsContext {
  const span = tracing.currentSpan;
  return span?.observabilityInstance?.getMetricsContext?.(span) ?? noOpMetricsContext;
}

// ============================================================================
// Context Factory
// ============================================================================

/**
 * Creates an observability context with real or no-op implementations for
 * tracing, logging, and metrics.
 *
 * When a TracingContext with a current span is provided, the logger and metrics
 * contexts are derived from the span's ObservabilityInstance so that log entries
 * and metric data points are automatically correlated to the active trace.
 *
 * @param tracingContext - TracingContext with current span, or undefined for no-op
 * @returns ObservabilityContext with all three signals (tracing, logger, metrics)
 */
export function createObservabilityContext(tracingContext?: TracingContext): ObservabilityContext {
  const tracing = tracingContext ?? noOpTracingContext;

  return {
    tracing,
    loggerVNext: deriveLoggerContext(tracing),
    metrics: deriveMetricsContext(tracing),
    tracingContext: tracing, // alias — preferred at forwarding sites
  };
}

/**
 * Resolves a partial observability context (from execute params) into a
 * complete ObservabilityContext with no-op defaults for any missing fields.
 *
 * Explicitly provided logger/metrics contexts are preserved (e.g. when set
 * upstream). When missing, they are derived from the tracing context's span,
 * following the same derivation logic as createObservabilityContext().
 *
 * @param partial - Partial context from ExecuteFunctionParams
 * @returns Complete ObservabilityContext
 */
export function resolveObservabilityContext(partial: Partial<ObservabilityContext>): ObservabilityContext {
  const tracing = partial.tracing ?? partial.tracingContext ?? noOpTracingContext;

  return {
    tracing,
    loggerVNext: partial.loggerVNext ?? deriveLoggerContext(tracing),
    metrics: partial.metrics ?? deriveMetricsContext(tracing),
    tracingContext: tracing, // alias — preferred at forwarding sites
  };
}
