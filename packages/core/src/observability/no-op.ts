import type { Mastra } from '..';
import type { IMastraLogger } from '../logger';
import type {
  ConfigSelector,
  ConfigSelectorOptions,
  Counter,
  Gauge,
  Histogram,
  LoggerContext,
  MetricsContext,
  ObservabilityEntrypoint,
  ObservabilityInstance,
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

export class NoOpObservability implements ObservabilityEntrypoint {
  setMastraContext(_options: { mastra: Mastra }): void {
    return;
  }

  setLogger(_options: { logger: IMastraLogger }): void {
    return;
  }

  getSelectedInstance(_options: ConfigSelectorOptions): ObservabilityInstance | undefined {
    return;
  }

  registerInstance(_name: string, _instance: ObservabilityInstance, _isDefault = false): void {
    return;
  }

  getInstance(_name: string): ObservabilityInstance | undefined {
    return;
  }

  getDefaultInstance(): ObservabilityInstance | undefined {
    return;
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

  setConfigSelector(_selector: ConfigSelector): void {
    return;
  }

  clear(): void {
    return;
  }

  async shutdown(): Promise<void> {
    return;
  }
}
