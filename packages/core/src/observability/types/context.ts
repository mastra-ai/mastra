import type { LoggerContext } from './logging';
import type { MetricsContext } from './metrics';
import type { TracingContext } from './tracing';

export interface ObservabilityContextMixin {
  /** Tracing context for span operations */
  tracing: TracingContext;
  /** Logger for structured logging */
  logger: LoggerContext;
  /** Metrics for counters, gauges, histograms */
  metrics: MetricsContext;
  /** @deprecated Use `tracing` instead */
  tracingContext: TracingContext;
}
