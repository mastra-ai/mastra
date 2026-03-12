/**
 * Unit tests for MetricsContextImpl
 */

import type { MetricEvent } from '@mastra/core/observability';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ObservabilityBus } from '../bus';
import { CardinalityFilter } from '../metrics/cardinality';
import { MetricsContextImpl } from './metrics';

describe('MetricsContextImpl', () => {
  let bus: ObservabilityBus;
  const emittedEvents: MetricEvent[] = [];

  function setupBus(cardinalityFilter?: CardinalityFilter) {
    bus = new ObservabilityBus({ cardinalityFilter });
    // Capture metric events emitted through emitMetric -> emit
    const originalEmit = bus.emit.bind(bus);
    bus.emit = (event: any) => {
      if (event.type === 'metric') {
        emittedEvents.push(event as MetricEvent);
      }
      // Still route to exporters/bridge via original emit
      originalEmit(event);
    };
  }

  afterEach(async () => {
    emittedEvents.length = 0;
    await bus?.shutdown();
  });

  it('should emit metric via emit()', () => {
    setupBus();

    const metrics = new MetricsContextImpl({
      labels: { agent: 'test-agent' },
      observabilityBus: bus,
    });

    metrics.emit('mastra_agent_runs', 1);

    expect(emittedEvents).toHaveLength(1);
    const m = emittedEvents[0]!.metric;
    expect(m.name).toBe('mastra_agent_runs');
    expect(m.value).toBe(1);
    expect(m.labels).toEqual({ agent: 'test-agent' });
  });

  it('should merge base labels with additional labels', () => {
    setupBus();

    const metrics = new MetricsContextImpl({
      labels: { agent: 'test-agent' },
      observabilityBus: bus,
    });

    metrics.emit('calls', 1, { status: 'ok' });

    expect(emittedEvents[0]!.metric.labels).toEqual({
      agent: 'test-agent',
      status: 'ok',
    });
  });

  it('should apply cardinality filter from bus', () => {
    setupBus(new CardinalityFilter()); // blocks trace_id, user_id, etc.

    const metrics = new MetricsContextImpl({
      observabilityBus: bus,
    });

    metrics.emit('calls', 1, {
      status: 'ok',
      trace_id: 'should-be-filtered',
      user_id: 'should-be-filtered',
    });

    expect(emittedEvents[0]!.metric.labels).toEqual({ status: 'ok' });
  });

  it('should drop non-finite values', () => {
    setupBus();

    const metrics = new MetricsContextImpl({
      observabilityBus: bus,
    });

    metrics.emit('calls', NaN);
    metrics.emit('calls', Infinity);
    metrics.emit('calls', -Infinity);

    expect(emittedEvents).toHaveLength(0);
  });

  it('should drop negative values', () => {
    setupBus();

    const metrics = new MetricsContextImpl({
      observabilityBus: bus,
    });

    metrics.emit('calls', -1);

    expect(emittedEvents).toHaveLength(0);
  });

  it('should not include metadata on emitted metrics', () => {
    setupBus();

    const metrics = new MetricsContextImpl({
      labels: { service_name: 'my-service' },
      observabilityBus: bus,
    });

    metrics.emit('calls', 1);

    expect(emittedEvents[0]!.metric.metadata).toBeUndefined();
    expect(emittedEvents[0]!.metric.labels).toEqual({ service_name: 'my-service' });
  });

  it('should route metric events to exporters via bus', () => {
    bus = new ObservabilityBus();
    const onMetricEvent = vi.fn();
    bus.registerExporter({
      name: 'test-exporter',
      onMetricEvent,
      exportTracingEvent: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    });

    const metrics = new MetricsContextImpl({
      observabilityBus: bus,
    });

    metrics.emit('test_metric', 5);

    expect(onMetricEvent).toHaveBeenCalledTimes(1);
    expect(onMetricEvent.mock.calls[0]![0].metric.name).toBe('test_metric');
  });
});
