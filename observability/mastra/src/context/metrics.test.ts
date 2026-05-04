/**
 * Unit tests for MetricsContextImpl
 */

import type { MetricEvent } from '@mastra/core/observability';
import { EntityType } from '@mastra/core/observability';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ObservabilityBus } from '../bus';
import { CardinalityFilter } from '../metrics/cardinality';
import { MetricsContextImpl } from './metrics';

describe('MetricsContextImpl', () => {
  let bus: ObservabilityBus;
  const emittedEvents: MetricEvent[] = [];

  function setupBus() {
    bus = new ObservabilityBus();
    // Capture metric events emitted through MetricsContextImpl -> bus.emit
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
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      observabilityBus: bus,
    });

    metrics.emit('mastra_agent_runs', 1, { agent: 'test-agent' });

    expect(emittedEvents).toHaveLength(1);
    const m = emittedEvents[0]!.metric;
    expect(m.name).toBe('mastra_agent_runs');
    expect(m.value).toBe(1);
    expect(m.labels).toEqual({ agent: 'test-agent' });
  });

  it('should include labels passed to emit()', () => {
    setupBus();
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      observabilityBus: bus,
    });

    metrics.emit('calls', 1, { agent: 'test-agent', status: 'ok' });

    expect(emittedEvents[0]!.metric.labels).toEqual({
      agent: 'test-agent',
      status: 'ok',
    });
  });

  it('should apply cardinality filter in MetricsContextImpl', () => {
    const cardinalityFilter = new CardinalityFilter(); // blocks trace_id, user_id, etc.
    setupBus();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
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
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      observabilityBus: bus,
    });

    metrics.emit('calls', NaN);
    metrics.emit('calls', Infinity);
    metrics.emit('calls', -Infinity);

    expect(emittedEvents).toHaveLength(0);
  });

  it('should drop negative values', () => {
    setupBus();
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      observabilityBus: bus,
    });

    metrics.emit('calls', -1);

    expect(emittedEvents).toHaveLength(0);
  });

  it('should not include metadata on emitted metrics', () => {
    setupBus();
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      observabilityBus: bus,
    });

    metrics.emit('calls', 1, { service_name: 'my-service' });

    expect(emittedEvents[0]!.metric.metadata).toBeUndefined();
    expect(emittedEvents[0]!.metric.labels).toEqual({ service_name: 'my-service' });
  });

  it('should include correlationContext when provided', () => {
    setupBus();
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      traceId: 'trace-1',
      spanId: 'span-1',
      correlationContext: {
        entityType: EntityType.AGENT,
        entityName: 'test-agent',
        environment: 'test',
      },
      observabilityBus: bus,
    });

    metrics.emit('calls', 1, { agent: 'test-agent' });

    expect(emittedEvents[0]!.metric.correlationContext).toEqual({
      entityType: EntityType.AGENT,
      entityName: 'test-agent',
      environment: 'test',
    });
    expect(emittedEvents[0]!.metric.traceId).toBe('trace-1');
    expect(emittedEvents[0]!.metric.spanId).toBe('span-1');
  });

  it('should include metadata when provided', () => {
    setupBus();
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      observabilityBus: bus,
      metadata: { source: 'context-metadata' },
    });

    metrics.emit('calls', 1);

    expect(emittedEvents[0]!.metric.metadata).toEqual({ source: 'context-metadata' });
  });

  it('should include costContext when provided at emit time', () => {
    setupBus();
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      observabilityBus: bus,
    });

    metrics.emit('mastra_model_total_input_tokens', 100, undefined, {
      costContext: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        estimatedCost: 0.001,
        costUnit: 'usd',
        costMetadata: { pricingRowId: 'fixture-row' },
      },
    });

    expect(emittedEvents[0]!.metric.costContext).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      estimatedCost: 0.001,
      costUnit: 'usd',
      costMetadata: { pricingRowId: 'fixture-row' },
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
      cardinalityFilter: new CardinalityFilter(),
      observabilityBus: bus,
    });

    metrics.emit('test_metric', 5);

    expect(onMetricEvent).toHaveBeenCalledTimes(1);
    expect(onMetricEvent.mock.calls[0]![0].metric.name).toBe('test_metric');
  });

  it('should fall back to deprecated traceId and spanId on correlationContext', () => {
    setupBus();
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      observabilityBus: bus,
      correlationContext: {
        traceId: 'legacy-trace',
        spanId: 'legacy-span',
        entityType: EntityType.AGENT,
      },
    });

    metrics.emit('calls', 1);

    const metric = emittedEvents[0]!.metric;
    expect(metric.traceId).toBe('legacy-trace');
    expect(metric.spanId).toBe('legacy-span');
    expect(metric.correlationContext).toEqual({
      traceId: 'legacy-trace',
      spanId: 'legacy-span',
      entityType: EntityType.AGENT,
    });
  });

  it('should prefer top-level traceId and spanId over deprecated correlationContext values', () => {
    setupBus();
    const cardinalityFilter = new CardinalityFilter();

    const metrics = new MetricsContextImpl({
      cardinalityFilter,
      observabilityBus: bus,
      traceId: 'top-level-trace',
      spanId: 'top-level-span',
      correlationContext: {
        traceId: 'legacy-trace',
        spanId: 'legacy-span',
        entityType: EntityType.AGENT,
      },
    });

    metrics.emit('calls', 1);

    const metric = emittedEvents[0]!.metric;
    expect(metric.traceId).toBe('top-level-trace');
    expect(metric.spanId).toBe('top-level-span');
    expect(metric.correlationContext).toEqual({
      traceId: 'legacy-trace',
      spanId: 'legacy-span',
      entityType: EntityType.AGENT,
    });
  });
});
