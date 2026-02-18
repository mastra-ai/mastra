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

  function captureEvents() {
    bus.emit = (event: any) => {
      if (event.type === 'metric') {
        emittedEvents.push(event as MetricEvent);
      }
    };
  }

  afterEach(async () => {
    emittedEvents.length = 0;
    await bus?.shutdown();
  });

  it('should emit counter metric', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const metrics = new MetricsContextImpl({
      baseLabels: { agent: 'test-agent' },
      observabilityBus: bus,
      cardinalityFilter: new CardinalityFilter(),
    });

    metrics.counter('mastra_agent_runs').add(1);

    expect(emittedEvents).toHaveLength(1);
    const m = emittedEvents[0]!.metric;
    expect(m.name).toBe('mastra_agent_runs');
    expect(m.metricType).toBe('counter');
    expect(m.value).toBe(1);
    expect(m.labels).toEqual({ agent: 'test-agent' });
  });

  it('should emit gauge metric', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const metrics = new MetricsContextImpl({
      baseLabels: {},
      observabilityBus: bus,
      cardinalityFilter: new CardinalityFilter(),
    });

    metrics.gauge('active_connections').set(42);

    expect(emittedEvents).toHaveLength(1);
    const m = emittedEvents[0]!.metric;
    expect(m.name).toBe('active_connections');
    expect(m.metricType).toBe('gauge');
    expect(m.value).toBe(42);
  });

  it('should emit histogram metric', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const metrics = new MetricsContextImpl({
      baseLabels: {},
      observabilityBus: bus,
      cardinalityFilter: new CardinalityFilter(),
    });

    metrics.histogram('request_duration_ms').record(150);

    expect(emittedEvents).toHaveLength(1);
    const m = emittedEvents[0]!.metric;
    expect(m.name).toBe('request_duration_ms');
    expect(m.metricType).toBe('histogram');
    expect(m.value).toBe(150);
  });

  it('should merge base labels with additional labels', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const metrics = new MetricsContextImpl({
      baseLabels: { agent: 'test-agent' },
      observabilityBus: bus,
      cardinalityFilter: new CardinalityFilter(),
    });

    metrics.counter('calls').add(1, { status: 'ok' });

    expect(emittedEvents[0]!.metric.labels).toEqual({
      agent: 'test-agent',
      status: 'ok',
    });
  });

  it('should apply cardinality filter to labels', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const metrics = new MetricsContextImpl({
      baseLabels: {},
      observabilityBus: bus,
      cardinalityFilter: new CardinalityFilter(), // blocks trace_id, user_id, etc.
    });

    metrics.counter('calls').add(1, {
      status: 'ok',
      trace_id: 'should-be-filtered',
      user_id: 'should-be-filtered',
    });

    expect(emittedEvents[0]!.metric.labels).toEqual({ status: 'ok' });
  });

  it('should include context in metadata', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const metrics = new MetricsContextImpl({
      baseLabels: {},
      observabilityBus: bus,
      cardinalityFilter: new CardinalityFilter(),
      context: { serviceName: 'my-service', environment: 'production' },
    });

    metrics.counter('calls').add(1);

    expect(emittedEvents[0]!.metric.metadata).toEqual({
      serviceName: 'my-service',
      environment: 'production',
    });
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
      baseLabels: {},
      observabilityBus: bus,
      cardinalityFilter: new CardinalityFilter(),
    });

    metrics.counter('test_counter').add(5);

    expect(onMetricEvent).toHaveBeenCalledTimes(1);
    expect(onMetricEvent.mock.calls[0]![0].metric.name).toBe('test_counter');
  });
});
