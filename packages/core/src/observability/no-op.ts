import type { Mastra } from '..';
import type { IMastraLogger } from '../logger';
import type {
  CorrelationContext,
  ConfigSelector,
  ConfigSelectorOptions,
  Counter,
  FeedbackInput,
  Gauge,
  Histogram,
  LoggerContext,
  MetricsContext,
  ObservabilityEntrypoint,
  ObservabilityInstance,
  RecordedTrace,
  ScoreInput,
  TracingContext,
} from './types';

// ============================================================================
// No-Op Metric Instruments
// ============================================================================

const noOpCounter: Counter = {
  add() {},
};

const noOpGauge: Gauge = {
  set() {},
};

const noOpHistogram: Histogram = {
  record() {},
};

// ============================================================================
// No-Op TracingContext
// ============================================================================

/**
 * No-op tracing context used when observability is not configured.
 */
export const noOpTracingContext: TracingContext = {
  currentSpan: undefined,
};

// ============================================================================
// No-Op LoggerContext
// ============================================================================

/**
 * No-op logger context that silently discards all log calls.
 * Used when observability is not configured.
 */
export const noOpLoggerContext: LoggerContext = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
};

// ============================================================================
// No-Op MetricsContext
// ============================================================================

/**
 * No-op metrics context that silently discards all metric operations.
 * Used when observability is not configured.
 */
export const noOpMetricsContext: MetricsContext = {
  emit() {},
  counter() {
    return noOpCounter;
  },
  gauge() {
    return noOpGauge;
  },
  histogram() {
    return noOpHistogram;
  },
};

// ============================================================================
// No-Op Observability
// ============================================================================

/** No-op observability entrypoint that silently discards all operations. */
export class NoOpObservability implements ObservabilityEntrypoint {
  setMastraContext(_options: { mastra: Mastra }): void {}

  setLogger(_options: { logger: IMastraLogger }): void {}

  getSelectedInstance(_options: ConfigSelectorOptions): ObservabilityInstance | undefined {
    return undefined;
  }

  async getRecordedTrace(_args: { traceId: string }): Promise<RecordedTrace | null> {
    return null;
  }

  async addScore(_args: {
    traceId?: string;
    spanId?: string;
    correlationContext?: CorrelationContext;
    score: ScoreInput;
  }): Promise<void> {}

  async addFeedback(_args: {
    traceId?: string;
    spanId?: string;
    correlationContext?: CorrelationContext;
    feedback: FeedbackInput;
  }): Promise<void> {}

  registerInstance(_name: string, _instance: ObservabilityInstance, _isDefault = false): void {}

  getInstance(_name: string): ObservabilityInstance | undefined {
    return undefined;
  }

  getDefaultInstance(): ObservabilityInstance | undefined {
    return undefined;
  }

  listInstances(): ReadonlyMap<string, ObservabilityInstance> {
    return new Map();
  }

  unregisterInstance(_name: string): boolean {
    return false;
  }

  hasInstance(_name: string): boolean {
    return false;
  }

  setConfigSelector(_selector: ConfigSelector): void {}

  clear(): void {}

  async flush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}
