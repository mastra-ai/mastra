import { describe, it, expect, vi } from 'vitest';

import { createObservabilityContext, resolveObservabilityContext } from './context-factory';
import { noOpLoggerContext, noOpMetricsContext } from './no-op';
import type { LoggerContext, MetricsContext, ObservabilityInstance, TracingContext } from './types';

// ============================================================================
// Helpers
// ============================================================================

function mockLoggerContext(): LoggerContext {
  return { debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {} };
}

function mockMetricsContext(): MetricsContext {
  return {
    counter: () => ({ add: () => {} }),
    gauge: () => ({ set: () => {} }),
    histogram: () => ({ record: () => {} }),
  };
}

/**
 * Creates a mock span with an observabilityInstance that returns the
 * provided logger/metrics contexts (or undefined if not provided).
 */
function mockSpanWithInstance(opts?: { logger?: LoggerContext; metrics?: MetricsContext }) {
  const instance: Partial<ObservabilityInstance> = {
    getLoggerContext: opts?.logger ? vi.fn().mockReturnValue(opts.logger) : undefined,
    getMetricsContext: opts?.metrics ? vi.fn().mockReturnValue(opts.metrics) : undefined,
  };

  return {
    spanId: 'test-span',
    observabilityInstance: instance as ObservabilityInstance,
  } as any;
}

// ============================================================================
// createObservabilityContext
// ============================================================================

describe('createObservabilityContext', () => {
  it('returns no-op contexts when called without arguments', () => {
    const ctx = createObservabilityContext();

    expect(ctx.tracing.currentSpan).toBeUndefined();
    expect(ctx.loggerVNext).toBe(noOpLoggerContext);
    expect(ctx.metrics).toBe(noOpMetricsContext);
  });

  it('returns tracingContext alias pointing to tracing', () => {
    const ctx = createObservabilityContext();

    expect(ctx.tracingContext).toBe(ctx.tracing);
  });

  it('uses provided tracing context when passed', () => {
    const mockSpan = { spanId: 'test-span' } as any;
    const mockTracing: TracingContext = { currentSpan: mockSpan };

    const ctx = createObservabilityContext(mockTracing);

    expect(ctx.tracing).toBe(mockTracing);
    expect(ctx.tracing.currentSpan).toBe(mockSpan);
    expect(ctx.tracingContext).toBe(mockTracing);
  });

  it('derives logger context from span observability instance', () => {
    const logger = mockLoggerContext();
    const span = mockSpanWithInstance({ logger });
    const tracing: TracingContext = { currentSpan: span };

    const ctx = createObservabilityContext(tracing);

    expect(ctx.loggerVNext).toBe(logger);
    expect(span.observabilityInstance.getLoggerContext).toHaveBeenCalledWith(span);
  });

  it('derives metrics context from span observability instance', () => {
    const metrics = mockMetricsContext();
    const span = mockSpanWithInstance({ metrics });
    const tracing: TracingContext = { currentSpan: span };

    const ctx = createObservabilityContext(tracing);

    expect(ctx.metrics).toBe(metrics);
    expect(span.observabilityInstance.getMetricsContext).toHaveBeenCalledWith(span);
  });

  it('derives both logger and metrics from span observability instance', () => {
    const logger = mockLoggerContext();
    const metrics = mockMetricsContext();
    const span = mockSpanWithInstance({ logger, metrics });
    const tracing: TracingContext = { currentSpan: span };

    const ctx = createObservabilityContext(tracing);

    expect(ctx.loggerVNext).toBe(logger);
    expect(ctx.metrics).toBe(metrics);
  });

  it('falls back to no-op when instance does not implement getLoggerContext', () => {
    const span = mockSpanWithInstance({ metrics: mockMetricsContext() });
    const tracing: TracingContext = { currentSpan: span };

    const ctx = createObservabilityContext(tracing);

    expect(ctx.loggerVNext).toBe(noOpLoggerContext);
  });

  it('falls back to no-op when instance does not implement getMetricsContext', () => {
    const span = mockSpanWithInstance({ logger: mockLoggerContext() });
    const tracing: TracingContext = { currentSpan: span };

    const ctx = createObservabilityContext(tracing);

    expect(ctx.metrics).toBe(noOpMetricsContext);
  });

  it('falls back to no-op when span has no observability instance', () => {
    const span = { spanId: 'bare-span' } as any;
    const tracing: TracingContext = { currentSpan: span };

    const ctx = createObservabilityContext(tracing);

    expect(ctx.loggerVNext).toBe(noOpLoggerContext);
    expect(ctx.metrics).toBe(noOpMetricsContext);
  });
});

// ============================================================================
// resolveObservabilityContext
// ============================================================================

describe('resolveObservabilityContext', () => {
  it('returns no-op contexts when called with empty partial', () => {
    const ctx = resolveObservabilityContext({});

    expect(ctx.tracing.currentSpan).toBeUndefined();
    expect(ctx.loggerVNext).toBe(noOpLoggerContext);
    expect(ctx.metrics).toBe(noOpMetricsContext);
  });

  it('uses provided logger context when passed', () => {
    const logger = mockLoggerContext();

    const ctx = resolveObservabilityContext({ loggerVNext: logger });

    expect(ctx.loggerVNext).toBe(logger);
  });

  it('uses provided metrics context when passed', () => {
    const metrics = mockMetricsContext();

    const ctx = resolveObservabilityContext({ metrics });

    expect(ctx.metrics).toBe(metrics);
  });

  it('uses all provided contexts when passed', () => {
    const mockSpan = { spanId: 'test-span' } as any;
    const mockTracing: TracingContext = { currentSpan: mockSpan };
    const logger = mockLoggerContext();
    const metrics = mockMetricsContext();

    const ctx = resolveObservabilityContext({ tracing: mockTracing, loggerVNext: logger, metrics });

    expect(ctx.tracing).toBe(mockTracing);
    expect(ctx.loggerVNext).toBe(logger);
    expect(ctx.metrics).toBe(metrics);
  });

  it('prefers tracing over tracingContext alias', () => {
    const mockSpan1 = { spanId: 'span-1' } as any;
    const mockSpan2 = { spanId: 'span-2' } as any;

    const ctx = resolveObservabilityContext({
      tracing: { currentSpan: mockSpan1 },
      tracingContext: { currentSpan: mockSpan2 },
    });

    expect(ctx.tracing.currentSpan).toBe(mockSpan1);
  });

  it('falls back to tracingContext alias when tracing is missing', () => {
    const mockSpan = { spanId: 'test-span' } as any;

    const ctx = resolveObservabilityContext({ tracingContext: { currentSpan: mockSpan } });

    expect(ctx.tracing.currentSpan).toBe(mockSpan);
  });

  it('derives logger from span when not explicitly provided', () => {
    const logger = mockLoggerContext();
    const span = mockSpanWithInstance({ logger });
    const tracing: TracingContext = { currentSpan: span };

    const ctx = resolveObservabilityContext({ tracing });

    expect(ctx.loggerVNext).toBe(logger);
    expect(span.observabilityInstance.getLoggerContext).toHaveBeenCalledWith(span);
  });

  it('derives metrics from span when not explicitly provided', () => {
    const metrics = mockMetricsContext();
    const span = mockSpanWithInstance({ metrics });
    const tracing: TracingContext = { currentSpan: span };

    const ctx = resolveObservabilityContext({ tracing });

    expect(ctx.metrics).toBe(metrics);
    expect(span.observabilityInstance.getMetricsContext).toHaveBeenCalledWith(span);
  });

  it('prefers explicit logger over derived logger', () => {
    const explicitLogger = mockLoggerContext();
    const derivedLogger = mockLoggerContext();
    const span = mockSpanWithInstance({ logger: derivedLogger });
    const tracing: TracingContext = { currentSpan: span };

    const ctx = resolveObservabilityContext({ tracing, loggerVNext: explicitLogger });

    expect(ctx.loggerVNext).toBe(explicitLogger);
  });

  it('prefers explicit metrics over derived metrics', () => {
    const explicitMetrics = mockMetricsContext();
    const derivedMetrics = mockMetricsContext();
    const span = mockSpanWithInstance({ metrics: derivedMetrics });
    const tracing: TracingContext = { currentSpan: span };

    const ctx = resolveObservabilityContext({ tracing, metrics: explicitMetrics });

    expect(ctx.metrics).toBe(explicitMetrics);
  });
});

// ============================================================================
// noOpLoggerContext
// ============================================================================

describe('noOpLoggerContext', () => {
  it('has all required methods', () => {
    expect(typeof noOpLoggerContext.debug).toBe('function');
    expect(typeof noOpLoggerContext.info).toBe('function');
    expect(typeof noOpLoggerContext.warn).toBe('function');
    expect(typeof noOpLoggerContext.error).toBe('function');
    expect(typeof noOpLoggerContext.fatal).toBe('function');
  });

  it('debug does not throw', () => {
    expect(() => noOpLoggerContext.debug('test message')).not.toThrow();
    expect(() => noOpLoggerContext.debug('test message', { key: 'value' })).not.toThrow();
  });

  it('info does not throw', () => {
    expect(() => noOpLoggerContext.info('test message')).not.toThrow();
    expect(() => noOpLoggerContext.info('test message', { key: 'value' })).not.toThrow();
  });

  it('warn does not throw', () => {
    expect(() => noOpLoggerContext.warn('test message')).not.toThrow();
    expect(() => noOpLoggerContext.warn('test message', { key: 'value' })).not.toThrow();
  });

  it('error does not throw', () => {
    expect(() => noOpLoggerContext.error('test message')).not.toThrow();
    expect(() => noOpLoggerContext.error('test message', { key: 'value' })).not.toThrow();
  });

  it('fatal does not throw', () => {
    expect(() => noOpLoggerContext.fatal('test message')).not.toThrow();
    expect(() => noOpLoggerContext.fatal('test message', { key: 'value' })).not.toThrow();
  });
});

// ============================================================================
// noOpMetricsContext
// ============================================================================

describe('noOpMetricsContext', () => {
  it('has all required methods', () => {
    expect(typeof noOpMetricsContext.counter).toBe('function');
    expect(typeof noOpMetricsContext.gauge).toBe('function');
    expect(typeof noOpMetricsContext.histogram).toBe('function');
  });

  describe('counter', () => {
    it('returns an object with add method', () => {
      const counter = noOpMetricsContext.counter('test_counter');
      expect(typeof counter.add).toBe('function');
    });

    it('add does not throw', () => {
      const counter = noOpMetricsContext.counter('test_counter');
      expect(() => counter.add(1)).not.toThrow();
      expect(() => counter.add(5, { label: 'value' })).not.toThrow();
    });
  });

  describe('gauge', () => {
    it('returns an object with set method', () => {
      const gauge = noOpMetricsContext.gauge('test_gauge');
      expect(typeof gauge.set).toBe('function');
    });

    it('set does not throw', () => {
      const gauge = noOpMetricsContext.gauge('test_gauge');
      expect(() => gauge.set(42)).not.toThrow();
      expect(() => gauge.set(100, { label: 'value' })).not.toThrow();
    });
  });

  describe('histogram', () => {
    it('returns an object with record method', () => {
      const histogram = noOpMetricsContext.histogram('test_histogram');
      expect(typeof histogram.record).toBe('function');
    });

    it('record does not throw', () => {
      const histogram = noOpMetricsContext.histogram('test_histogram');
      expect(() => histogram.record(0.5)).not.toThrow();
      expect(() => histogram.record(123.45, { label: 'value' })).not.toThrow();
    });
  });
});
