import { noOpLoggerContext, noOpMetricsContext } from './no-op/context';
import type { ObservabilityContextMixin } from './types/context';
import type { LoggerContext } from './types/logging';
import type { MetricsContext } from './types/metrics';
import type { TracingContext } from './types/tracing';

const noOpTracingContext: TracingContext = { currentSpan: undefined };

/**
 * Creates an observability context mixin with real or no-op implementations.
 * Use this when constructing execution contexts for tools, workflow steps, etc.
 */
export function createObservabilityContext(
  tracingContext?: TracingContext,
  loggerContext?: LoggerContext,
  metricsContext?: MetricsContext,
): ObservabilityContextMixin {
  const tracing = tracingContext ?? noOpTracingContext;

  return {
    tracing,
    logger: loggerContext ?? noOpLoggerContext,
    metrics: metricsContext ?? noOpMetricsContext,
    tracingContext: tracing,
  };
}
