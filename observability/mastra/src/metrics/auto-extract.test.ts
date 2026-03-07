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
    // Capture only metric events emitted by the extractor
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

  describe('SPAN_STARTED metrics', () => {
    it('should emit mastra_agent_runs_started for agent spans', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({ type: SpanType.AGENT_RUN, entityName: 'my-agent' }),
      });

      expect(emittedMetrics).toHaveLength(1);
      expect(emittedMetrics[0]!.metric.name).toBe('mastra_agent_runs_started');
      expect(emittedMetrics[0]!.metric.metricType).toBe('counter');
      expect(emittedMetrics[0]!.metric.value).toBe(1);
      expect(emittedMetrics[0]!.metric.labels).toEqual({ entity_type: 'agent', entity_name: 'my-agent' });
    });

    it('should emit mastra_tool_calls_started for tool spans', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({ type: SpanType.TOOL_CALL, entityType: EntityType.TOOL, entityName: 'my-tool' }),
      });

      expect(emittedMetrics).toHaveLength(1);
      expect(emittedMetrics[0]!.metric.name).toBe('mastra_tool_calls_started');
      expect(emittedMetrics[0]!.metric.labels).toEqual({ entity_type: 'tool', entity_name: 'my-tool' });
    });

    it('should emit mastra_workflow_runs_started for workflow spans', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({
          type: SpanType.WORKFLOW_RUN,
          entityType: EntityType.WORKFLOW_RUN,
          entityName: 'my-workflow',
        }),
      });

      expect(emittedMetrics).toHaveLength(1);
      expect(emittedMetrics[0]!.metric.name).toBe('mastra_workflow_runs_started');
      expect(emittedMetrics[0]!.metric.labels).toEqual({ entity_type: 'workflow_run', entity_name: 'my-workflow' });
    });

    it('should emit mastra_model_requests_started for model generation spans', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({
          type: SpanType.MODEL_GENERATION,
          entityType: undefined,
          entityName: undefined,
          attributes: { model: 'gpt-4', provider: 'openai' },
        }),
      });

      expect(emittedMetrics).toHaveLength(1);
      expect(emittedMetrics[0]!.metric.name).toBe('mastra_model_requests_started');
      expect(emittedMetrics[0]!.metric.labels).toEqual({ model: 'gpt-4', provider: 'openai' }); // no entity_type/name since entityName is undefined
    });

    it('should NOT emit metrics for unsupported span types', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({ type: SpanType.GENERIC }),
      });

      expect(emittedMetrics).toHaveLength(0);
    });
  });

  describe('SPAN_ENDED metrics', () => {
    it('should emit ended counter and duration histogram for agent spans', () => {
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

      expect(emittedMetrics).toHaveLength(2);

      // Ended counter
      const endedMetric = emittedMetrics.find(m => m.metric.name === 'mastra_agent_runs_ended');
      expect(endedMetric).toBeDefined();
      expect(endedMetric!.metric.metricType).toBe('counter');
      expect(endedMetric!.metric.labels).toEqual({ entity_type: 'agent', entity_name: 'my-agent', status: 'ok' });

      // Duration histogram
      const durationMetric = emittedMetrics.find(m => m.metric.name === 'mastra_agent_duration_ms');
      expect(durationMetric).toBeDefined();
      expect(durationMetric!.metric.metricType).toBe('histogram');
      expect(durationMetric!.metric.value).toBe(1500);
    });

    it('should set status=error when span has errorInfo', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: createMockSpan({
          type: SpanType.TOOL_CALL,
          entityName: 'my-tool',
          startTime: new Date('2026-01-01T00:00:00Z'),
          endTime: new Date('2026-01-01T00:00:00.200Z'),
          errorInfo: { message: 'tool failed', name: 'Error' },
        }),
      });

      const endedMetric = emittedMetrics.find(m => m.metric.name === 'mastra_tool_calls_ended');
      expect(endedMetric!.metric.labels.status).toBe('error');
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
      expect(metricNames).toContain('mastra_model_requests_ended');
      expect(metricNames).toContain('mastra_model_duration_ms');
      expect(metricNames).toContain('mastra_model_input_tokens');
      expect(metricNames).toContain('mastra_model_output_tokens');
      expect(metricNames).toContain('mastra_model_cache_read_tokens');
      expect(metricNames).toContain('mastra_model_cache_write_tokens');

      const inputTokens = emittedMetrics.find(m => m.metric.name === 'mastra_model_input_tokens');
      expect(inputTokens!.metric.value).toBe(100);
      const outputTokens = emittedMetrics.find(m => m.metric.name === 'mastra_model_output_tokens');
      expect(outputTokens!.metric.value).toBe(50);
    });

    it('should NOT emit metrics for SPAN_UPDATED events', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan: createMockSpan({ type: SpanType.AGENT_RUN }),
      });

      expect(emittedMetrics).toHaveLength(0);
    });
  });

  describe('Score auto-extraction', () => {
    it('should emit mastra_scores_total and mastra_score_value for score events', () => {
      setup();
      extractor.processScoreEvent({
        type: 'score',
        score: {
          timestamp: new Date(),
          traceId: 'trace-1',
          scorerName: 'relevance',
          score: 0.85,
        },
      });

      expect(emittedMetrics).toHaveLength(2);
      expect(emittedMetrics[0]!.metric.name).toBe('mastra_scores_total');
      expect(emittedMetrics[0]!.metric.metricType).toBe('counter');
      expect(emittedMetrics[0]!.metric.value).toBe(1);
      expect(emittedMetrics[0]!.metric.labels).toEqual({ scorer: 'relevance' });

      expect(emittedMetrics[1]!.metric.name).toBe('mastra_score_value');
      expect(emittedMetrics[1]!.metric.metricType).toBe('gauge');
      expect(emittedMetrics[1]!.metric.value).toBe(0.85);
      expect(emittedMetrics[1]!.metric.labels).toEqual({ scorer: 'relevance' });
    });

    it('should include experiment label when present', () => {
      setup();
      extractor.processScoreEvent({
        type: 'score',
        score: {
          timestamp: new Date(),
          traceId: 'trace-1',
          scorerName: 'quality',
          score: 0.9,
          experimentId: 'exp-1',
        },
      });

      expect(emittedMetrics[0]!.metric.labels).toEqual({
        scorer: 'quality',
        experiment: 'exp-1',
      });
    });
  });

  describe('Feedback auto-extraction', () => {
    it('should emit mastra_feedback_total and mastra_feedback_value for feedback events', () => {
      setup();
      extractor.processFeedbackEvent({
        type: 'feedback',
        feedback: {
          timestamp: new Date(),
          traceId: 'trace-1',
          source: 'user',
          feedbackType: 'thumbs',
          value: 1,
        },
      });

      expect(emittedMetrics).toHaveLength(2);
      expect(emittedMetrics[0]!.metric.name).toBe('mastra_feedback_total');
      expect(emittedMetrics[0]!.metric.labels).toEqual({
        feedback_type: 'thumbs',
        source: 'user',
      });

      expect(emittedMetrics[1]!.metric.name).toBe('mastra_feedback_value');
      expect(emittedMetrics[1]!.metric.metricType).toBe('gauge');
      expect(emittedMetrics[1]!.metric.value).toBe(1);
    });

    it('should not emit mastra_feedback_value for non-numeric feedback', () => {
      setup();
      extractor.processFeedbackEvent({
        type: 'feedback',
        feedback: {
          timestamp: new Date(),
          traceId: 'trace-1',
          source: 'user',
          feedbackType: 'correction',
          value: 'fixed text',
        },
      });

      expect(emittedMetrics).toHaveLength(1);
      expect(emittedMetrics[0]!.metric.name).toBe('mastra_feedback_total');
    });

    it('should include experiment label when present', () => {
      setup();
      extractor.processFeedbackEvent({
        type: 'feedback',
        feedback: {
          timestamp: new Date(),
          traceId: 'trace-1',
          source: 'user',
          feedbackType: 'rating',
          value: 5,
          experimentId: 'exp-2',
        },
      });

      expect(emittedMetrics[0]!.metric.labels).toEqual({
        feedback_type: 'rating',
        source: 'user',
        experiment: 'exp-2',
      });
    });
  });

  describe('CardinalityFilter integration', () => {
    it('should filter auto-extracted labels through CardinalityFilter when provided', () => {
      bus = new ObservabilityBus();
      bus.emit = (event: any) => {
        if (event.type === 'metric') {
          emittedMetrics.push(event as MetricEvent);
        }
      };
      const filter = new CardinalityFilter({ blockedLabels: ['entity_name'] });
      extractor = new AutoExtractedMetrics(bus, filter);

      extractor.processTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({ type: SpanType.AGENT_RUN, entityName: 'my-agent' }),
      });

      expect(emittedMetrics).toHaveLength(1);
      // entity_name should be filtered out, entity_type should remain
      expect(emittedMetrics[0]!.metric.labels).toEqual({ entity_type: 'agent' });
    });

    it('should pass all labels through when no CardinalityFilter is provided', () => {
      setup();
      extractor.processTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createMockSpan({ type: SpanType.AGENT_RUN, entityName: 'my-agent' }),
      });

      expect(emittedMetrics[0]!.metric.labels).toEqual({ entity_type: 'agent', entity_name: 'my-agent' });
    });
  });
});
