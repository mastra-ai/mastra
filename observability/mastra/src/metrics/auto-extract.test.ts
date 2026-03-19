/**
 * Unit tests for AutoExtractedMetrics
 */

import { SpanType, TracingEventType, EntityType } from '@mastra/core/observability';
import type { AnyExportedSpan, MetricEvent } from '@mastra/core/observability';
import { describe, it, expect, afterEach } from 'vitest';
import { ObservabilityBus } from '../bus';
import { AutoExtractedMetrics } from './auto-extract';
import { CardinalityFilter } from './cardinality';

function createMockSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    name: 'test-span',
    type: SpanType.AGENT_RUN,
    isRootSpan: true,
    isEvent: false,
    startTime: new Date('2026-01-01T00:00:00Z'),
    entityType: EntityType.AGENT,
    entityName: 'test-agent',
    ...overrides,
  } as AnyExportedSpan;
}

describe('AutoExtractedMetrics', () => {
  let bus: ObservabilityBus;
  let extractor: AutoExtractedMetrics;
  const emittedMetrics: MetricEvent[] = [];

  function setup() {
    bus = new ObservabilityBus();
    bus.emit = (event: any) => {
      if (event.type === 'metric') {
        emittedMetrics.push(event as MetricEvent);
      }
    };
    extractor = new AutoExtractedMetrics(bus);
  }

  afterEach(async () => {
    emittedMetrics.length = 0;
    await bus?.shutdown();
  });

  describe('SPAN_STARTED - no metrics emitted', () => {
    it('should NOT emit metrics for SPAN_STARTED events', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({ type: SpanType.AGENT_RUN, entityName: 'my-agent' }),
      });

      expect(emittedMetrics).toHaveLength(0);
    });
  });

  describe('SPAN_ENDED metrics', () => {
    it('should emit duration metric for agent spans', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.AGENT_RUN,
          entityName: 'my-agent',
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:01.500Z'),
        }),
      });

      expect(emittedMetrics).toHaveLength(1);
      const m = emittedMetrics[0]!;
      expect(m.metric.name).toBe('mastra_agent_duration_ms');
      expect(m.metric.value).toBe(1500);
      expect(m.metric.labels).toEqual({ entity_type: 'agent', entity_name: 'my-agent', status: 'ok' });
    });

    it('should emit duration metric for tool spans', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.TOOL_CALL,
          entityType: EntityType.TOOL,
          entityName: 'my-tool',
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:00.200Z'),
        }),
      });

      expect(emittedMetrics).toHaveLength(1);
      expect(emittedMetrics[0]!.metric.name).toBe('mastra_tool_duration_ms');
      expect(emittedMetrics[0]!.metric.value).toBe(200);
    });

    it('should emit duration metric for workflow spans', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.WORKFLOW_RUN,
          entityType: EntityType.WORKFLOW_RUN,
          entityName: 'my-workflow',
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:05Z'),
        }),
      });

      expect(emittedMetrics).toHaveLength(1);
      expect(emittedMetrics[0]!.metric.name).toBe('mastra_workflow_duration_ms');
      expect(emittedMetrics[0]!.metric.value).toBe(5000);
    });

    it('should set status=error when span has errorInfo', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.TOOL_CALL,
          entityType: EntityType.TOOL,
          entityName: 'my-tool',
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:00.200Z'),
          errorInfo: { message: 'tool failed', name: 'Error' },
        }),
      });

      expect(emittedMetrics[0]!.metric.labels.status).toBe('error');
    });

    it('should extract token usage metrics for model generation', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.MODEL_GENERATION,
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:02Z'),
          attributes: {
            model: 'gpt-4',
            provider: 'openai',
            usage: {
              inputTokens: 100,
              outputTokens: 50,
              inputDetails: {
                cacheRead: 20,
                cacheWrite: 10,
              },
            },
          },
        }),
      });

      const metricNames = emittedMetrics.map(m => m.metric.name);
      expect(metricNames).toContain('mastra_model_duration_ms');
      expect(metricNames).toContain('mastra_model_total_input_tokens');
      expect(metricNames).toContain('mastra_model_total_output_tokens');
      expect(metricNames).toContain('mastra_model_input_cache_read_tokens');
      expect(metricNames).toContain('mastra_model_input_cache_write_tokens');

      const inputTokens = emittedMetrics.find(m => m.metric.name === 'mastra_model_total_input_tokens');
      expect(inputTokens!.metric.value).toBe(100);
      const outputTokens = emittedMetrics.find(m => m.metric.name === 'mastra_model_total_output_tokens');
      expect(outputTokens!.metric.value).toBe(50);
    });

    it('should extract all InputTokenDetails and OutputTokenDetails', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.MODEL_GENERATION,
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:01Z'),
          attributes: {
            model: 'gpt-4o',
            provider: 'openai',
            usage: {
              inputTokens: 500,
              outputTokens: 200,
              inputDetails: {
                text: 400,
                cacheRead: 50,
                cacheWrite: 30,
                audio: 15,
                image: 5,
              },
              outputDetails: {
                text: 150,
                reasoning: 30,
                audio: 10,
                image: 10,
              },
            },
          },
        }),
      });

      const byName = (name: string) => emittedMetrics.find(m => m.metric.name === name);

      // Top-level
      expect(byName('mastra_model_total_input_tokens')!.metric.value).toBe(500);
      expect(byName('mastra_model_total_output_tokens')!.metric.value).toBe(200);

      // Input details
      expect(byName('mastra_model_input_text_tokens')!.metric.value).toBe(400);
      expect(byName('mastra_model_input_cache_read_tokens')!.metric.value).toBe(50);
      expect(byName('mastra_model_input_cache_write_tokens')!.metric.value).toBe(30);
      expect(byName('mastra_model_input_audio_tokens')!.metric.value).toBe(15);
      expect(byName('mastra_model_input_image_tokens')!.metric.value).toBe(5);

      // Output details
      expect(byName('mastra_model_output_text_tokens')!.metric.value).toBe(150);
      expect(byName('mastra_model_output_reasoning_tokens')!.metric.value).toBe(30);
      expect(byName('mastra_model_output_audio_tokens')!.metric.value).toBe(10);
      expect(byName('mastra_model_output_image_tokens')!.metric.value).toBe(10);
    });

    it('should skip undefined token detail fields silently', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.MODEL_GENERATION,
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:01Z'),
          attributes: {
            model: 'claude-3',
            provider: 'anthropic',
            usage: {
              inputTokens: 100,
              outputTokens: 50,
              // no inputDetails or outputDetails
            },
          },
        }),
      });

      const metricNames = emittedMetrics.map(m => m.metric.name);
      // Should have duration + input + output = 3 metrics
      expect(metricNames).toContain('mastra_model_duration_ms');
      expect(metricNames).toContain('mastra_model_total_input_tokens');
      expect(metricNames).toContain('mastra_model_total_output_tokens');
      // Should NOT have any detail metrics
      expect(metricNames).not.toContain('mastra_model_input_text_tokens');
      expect(metricNames).not.toContain('mastra_model_input_cache_read_tokens');
      expect(metricNames).not.toContain('mastra_model_output_reasoning_tokens');
    });

    it('should NOT emit metrics for SPAN_UPDATED events', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: createMockSpan({ type: SpanType.AGENT_RUN }),
      });

      expect(emittedMetrics).toHaveLength(0);
    });

    it('should NOT emit metrics for unsupported span types', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.GENERIC,
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:01Z'),
        }),
      });

      expect(emittedMetrics).toHaveLength(0);
    });

    it('should drop negative values from emit', () => {
      setup();
      // This tests the guard in emit() — a span with endTime before startTime
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.AGENT_RUN,
          startTime: new Date('2026-01-01T00:00:01Z'),
          endTime: new Date('2026-01-01T00:00:00Z'),
        }),
      });

      expect(emittedMetrics).toHaveLength(0);
    });
  });

  describe('CardinalityFilter integration', () => {
    it('should filter auto-extracted labels through CardinalityFilter on the bus', () => {
      const filter = new CardinalityFilter({ blockedLabels: ['entity_name'] });
      bus = new ObservabilityBus({ cardinalityFilter: filter });
      // Override emit so emitMetric -> emit is captured
      const originalEmit = bus.emit.bind(bus);
      bus.emit = (event: any) => {
        if (event.type === 'metric') {
          emittedMetrics.push(event as MetricEvent);
        }
        originalEmit(event);
      };
      extractor = new AutoExtractedMetrics(bus);

      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.AGENT_RUN,
          entityName: 'my-agent',
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:01Z'),
        }),
      });

      expect(emittedMetrics).toHaveLength(1);
      expect(emittedMetrics[0]!.metric.labels).toEqual({ entity_type: 'agent', status: 'ok' });
    });

    it('should pass all labels through when no CardinalityFilter is provided', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.AGENT_RUN,
          entityName: 'my-agent',
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:01Z'),
        }),
      });

      expect(emittedMetrics[0]!.metric.labels).toEqual({
        entity_type: 'agent',
        entity_name: 'my-agent',
        status: 'ok',
      });
    });
  });
});
