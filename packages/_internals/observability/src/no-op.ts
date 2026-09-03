import type {
  CorrelationContext,
  ConfigSelector,
  ConfigSelectorOptions,
  Counter,
  FeedbackInput,
  Gauge,
  Histogram,
  LoggerContext,
  MastraObservabilityContext,
  MetricsContext,
  ObservabilityEntrypoint,
  ObservabilityInstance,
  ObservabilityLogger,
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

const noOpObservabilityMarker = Symbol.for('@mastra/observability.no-op');

/** No-op observability entrypoint that silently discards all operations. */
export interface NoOpObservability extends ObservabilityEntrypoint {}

/** Constructor shape retained for `new NoOpObservability()` and subclass compatibility. */
export interface NoOpObservabilityConstructor {
  new (): NoOpObservability;
  readonly prototype: NoOpObservability;
}

const noOpObservabilityPrototype: ObservabilityEntrypoint = {
  setMastraContext(_options: { mastra: MastraObservabilityContext }): void {},

  setLogger(_options: { logger: ObservabilityLogger }): void {},

  getSelectedInstance(_options: ConfigSelectorOptions): ObservabilityInstance | undefined {
    return undefined;
  },

  async getRecordedTrace(_args: { traceId: string }): Promise<RecordedTrace | null> {
    return null;
  },

  async addScore(_args: {
    traceId?: string;
    spanId?: string;
    correlationContext?: CorrelationContext;
    score: ScoreInput;
  }): Promise<void> {},

  async addFeedback(_args: {
    traceId?: string;
    spanId?: string;
    correlationContext?: CorrelationContext;
    feedback: FeedbackInput;
  }): Promise<void> {},

  registerInstance(_name: string, _instance: ObservabilityInstance, _isDefault = false): void {},

  getInstance(_name: string): ObservabilityInstance | undefined {
    return undefined;
  },

  getDefaultInstance(): ObservabilityInstance | undefined {
    return undefined;
  },

  listInstances(): ReadonlyMap<string, ObservabilityInstance> {
    return new Map();
  },

  unregisterInstance(_name: string): boolean {
    return false;
  },

  hasInstance(_name: string): boolean {
    return false;
  },

  setConfigSelector(_selector: ConfigSelector): void {},

  clear(): void {},

  async flush(): Promise<void> {},

  async shutdown(): Promise<void> {},
};

type MutableNoOpObservabilityConstructor = {
  new (): NoOpObservability;
  prototype: NoOpObservability;
};

const noOpObservabilityConstructor = function NoOpObservability(this: NoOpObservability): void {
  Object.defineProperty(this, noOpObservabilityMarker, { value: true });
} as unknown as MutableNoOpObservabilityConstructor;

noOpObservabilityConstructor.prototype = noOpObservabilityPrototype;

export const NoOpObservability: NoOpObservabilityConstructor = noOpObservabilityConstructor;

/** Identifies no-op observability instances across separately embedded package copies. */
export function isNoOpObservability(value: unknown): value is NoOpObservability {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<PropertyKey, unknown>)[noOpObservabilityMarker] === true
  );
}
