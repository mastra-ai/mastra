/**
 * Regression tests for the span -> context factory methods on
 * BaseObservabilityInstance.
 *
 * Creating a logger or metrics context must deep-copy the span's metadata
 * exactly once: the context implementations snapshot what they are given, so
 * the factories must not copy it again on the way in.
 */

import type { AnySpan, LogEvent, MetricEvent, ObservabilityExporter, TracingEvent } from '@mastra/core/observability';
import { SamplingStrategyType } from '@mastra/core/observability';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DefaultObservabilityInstance } from './default';

class CapturingExporter implements ObservabilityExporter {
  name = 'capturing-exporter';
  logEvents: LogEvent[] = [];
  metricEvents: MetricEvent[] = [];

  async exportTracingEvent(_event: TracingEvent): Promise<void> {}

  async onLogEvent(event: LogEvent): Promise<void> {
    this.logEvents.push(event);
  }

  async onMetricEvent(event: MetricEvent): Promise<void> {
    this.metricEvents.push(event);
  }

  async flush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}

function createInstance(exporter: CapturingExporter) {
  return new DefaultObservabilityInstance({
    serviceName: 'test-service',
    name: 'test-instance',
    sampling: { type: SamplingStrategyType.ALWAYS },
    exporters: [exporter],
    logging: { level: 'info' },
  });
}

/**
 * A plain object cast to AnySpan: the factories only read metadata, traceId and
 * the optional getExportedSpanId() (the same fixture style as the legacy-span
 * case in tracing.test.ts).
 */
function createSpan(metadata: Record<string, unknown>): AnySpan {
  return { id: 'span-1', traceId: 'trace-1', metadata } as unknown as AnySpan;
}

describe('context factories', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deep-copies span metadata once when creating a logger context', () => {
    const exporter = new CapturingExporter();
    const instance = createInstance(exporter);
    const cloneSpy = vi.spyOn(globalThis, 'structuredClone');

    instance.getLoggerContext(createSpan({ runId: 'run-1', nested: { depth: 1 } }));

    expect(cloneSpy).toHaveBeenCalledTimes(1);
  });

  it('deep-copies span metadata once when creating a metrics context', () => {
    const exporter = new CapturingExporter();
    const instance = createInstance(exporter);
    const cloneSpy = vi.spyOn(globalThis, 'structuredClone');

    instance.getMetricsContext(createSpan({ runId: 'run-1', nested: { depth: 1 } }));

    expect(cloneSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps logger metadata a snapshot when the span metadata is mutated later', async () => {
    const exporter = new CapturingExporter();
    const instance = createInstance(exporter);
    const metadata = { runId: 'run-1', nested: { depth: 1 } };

    const logger = instance.getLoggerContext(createSpan(metadata));
    metadata.nested.depth = 2;

    logger.warn('after mutation');
    await instance.flush();

    expect(exporter.logEvents).toHaveLength(1);
    expect(exporter.logEvents[0]!.log.metadata).toEqual({ runId: 'run-1', nested: { depth: 1 } });
  });

  it('keeps metrics metadata a snapshot when the span metadata is mutated later', async () => {
    const exporter = new CapturingExporter();
    const instance = createInstance(exporter);
    const metadata = { runId: 'run-1', nested: { depth: 1 } };

    const metrics = instance.getMetricsContext(createSpan(metadata));
    metadata.nested.depth = 2;

    metrics.emit('mastra_agent_runs', 1);
    await instance.flush();

    expect(exporter.metricEvents).toHaveLength(1);
    expect(exporter.metricEvents[0]!.metric.metadata).toEqual({ runId: 'run-1', nested: { depth: 1 } });
  });
});
