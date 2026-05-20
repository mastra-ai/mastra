/**
 * Unit tests for AutoExtractedMetrics
 */

import fs from 'node:fs';
import path from 'node:path';
import { SpanType, EntityType } from '@mastra/core/observability';
import type { AnySpan, MetricEvent } from '@mastra/core/observability';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ObservabilityBus } from '../bus';
import { MetricsContextImpl } from '../context/metrics';
import { emitAutoExtractedMetrics } from './auto-extract';
import { CardinalityFilter } from './cardinality';
import * as estimatorModule from './estimator';
import { PricingRegistry } from './pricing-registry';

const fixturePath = path.join(import.meta.dirname, '__fixtures__', 'pricing-data-test.jsonl');
const pricingRegistry = PricingRegistry.fromText(fs.readFileSync(fixturePath, 'utf-8'));

function createMockSpan(overrides: Partial<AnySpan> = {}): AnySpan {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    name: 'test-span',
    type: SpanType.AGENT_RUN,
    isEvent: false,
    isInternal: false,
    isValid: true,
    startTime: new Date('2026-01-01T00:00:00Z'),
    entityType: EntityType.AGENT,
    entityName: 'test-agent',
    end: () => {},
    error: () => {},
    update: () => {},
    createChildSpan: () => {
      throw new Error('not implemented');
    },
    exportSpan: () => {
      throw new Error('not implemented');
    },
    asEvent: () => {
      throw new Error('not implemented');
    },
    executeInContext: async fn => fn(),
    executeInContextSync: fn => fn(),
    observabilityInstance: {} as any,
    ...overrides,
  } as AnySpan;
}

describe('AutoExtractedMetrics', () => {
  let bus: ObservabilityBus;
  let cardinalityFilter: CardinalityFilter;
  const emittedMetrics: MetricEvent[] = [];

  function createMetricsContext(span: AnySpan) {
    return new MetricsContextImpl({
      correlationContext: {
        traceId: span.traceId,
        spanId: span.id,
        entityType: span.entityType,
        entityName: span.entityName,
      },
      cardinalityFilter,
      observabilityBus: bus,
    });
  }

  function setup(filterOverride?: CardinalityFilter) {
    bus = new ObservabilityBus();
    const filter = filterOverride ?? new CardinalityFilter();
    // Share the exact filter instance used by MetricsContextImpl in this test.
    cardinalityFilter = filter;
    bus.emit = (event: any) => {
      if (event.type === 'metric') {
        emittedMetrics.push(event as MetricEvent);
      }
    };
  }

  afterEach(async () => {
    emittedMetrics.length = 0;
    vi.restoreAllMocks();
    await bus?.shutdown();
  });

  it('should emit duration metric for agent spans', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.AGENT_RUN,
      entityName: 'my-agent',
      endTime: new Date('2026-01-01T00:00:01.500Z'),
    });

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    expect(emittedMetrics).toHaveLength(1);
    const m = emittedMetrics[0]!;
    expect(m.metric.name).toBe('mastra_agent_duration_ms');
    expect(m.metric.value).toBe(1500);
    expect(m.metric.labels).toEqual({ status: 'ok' });
    expect(m.metric.correlationContext).toEqual({
      traceId: 'trace-1',
      spanId: 'span-1',
      entityType: EntityType.AGENT,
      entityName: 'my-agent',
    });
  });

  it('should emit duration metric for tool spans', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.TOOL_CALL,
      entityType: EntityType.TOOL,
      entityName: 'my-tool',
      endTime: new Date('2026-01-01T00:00:00.200Z'),
    });

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    expect(emittedMetrics).toHaveLength(1);
    expect(emittedMetrics[0]!.metric.name).toBe('mastra_tool_duration_ms');
    expect(emittedMetrics[0]!.metric.value).toBe(200);
  });

  it('should emit duration metric for workflow spans', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.WORKFLOW_RUN,
      entityType: EntityType.WORKFLOW_RUN,
      entityName: 'my-workflow',
      endTime: new Date('2026-01-01T00:00:05Z'),
    });

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    expect(emittedMetrics).toHaveLength(1);
    expect(emittedMetrics[0]!.metric.name).toBe('mastra_workflow_duration_ms');
    expect(emittedMetrics[0]!.metric.value).toBe(5000);
  });

  it('should set status=error when span has errorInfo', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.TOOL_CALL,
      entityType: EntityType.TOOL,
      entityName: 'my-tool',
      endTime: new Date('2026-01-01T00:00:00.200Z'),
      errorInfo: { message: 'tool failed', id: 'Error' },
    });

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    expect(emittedMetrics[0]!.metric.labels.status).toBe('error');
  });

  it('should extract token usage metrics for model generation', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.MODEL_GENERATION,
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
    });

    vi.spyOn(PricingRegistry, 'getGlobal').mockReturnValue(pricingRegistry);

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    const metricNames = emittedMetrics.map(m => m.metric.name);
    expect(metricNames).toContain('mastra_model_duration_ms');
    expect(metricNames).toContain('mastra_model_total_input_tokens');
    expect(metricNames).toContain('mastra_model_total_output_tokens');
    expect(metricNames).toContain('mastra_model_input_cache_read_tokens');
    expect(metricNames).toContain('mastra_model_input_cache_write_tokens');

    const inputTokens = emittedMetrics.find(m => m.metric.name === 'mastra_model_total_input_tokens');
    expect(inputTokens!.metric.value).toBe(100);
    expect(inputTokens!.metric.correlationContext).toEqual({
      traceId: 'trace-1',
      spanId: 'span-1',
      entityType: EntityType.AGENT,
      entityName: 'test-agent',
    });
    expect(inputTokens!.metric.labels).toEqual({});
    expect(inputTokens!.metric.costContext).toEqual({
      provider: 'openai',
      model: 'gpt-4',
      costMetadata: {
        error: 'no_matching_model',
      },
    });
    const outputTokens = emittedMetrics.find(m => m.metric.name === 'mastra_model_total_output_tokens');
    expect(outputTokens!.metric.value).toBe(50);
  });

  it('should extract all InputTokenDetails and OutputTokenDetails', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.MODEL_GENERATION,
      endTime: new Date('2026-01-01T00:00:01Z'),
      attributes: {
        model: 'gpt-4o-mini',
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
    });

    vi.spyOn(PricingRegistry, 'getGlobal').mockReturnValue(pricingRegistry);

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    const byName = (name: string) => emittedMetrics.find(m => m.metric.name === name);
    expect(byName('mastra_model_total_input_tokens')!.metric.value).toBe(500);
    expect(byName('mastra_model_total_output_tokens')!.metric.value).toBe(200);
    expect(byName('mastra_model_input_text_tokens')!.metric.value).toBe(400);
    expect(byName('mastra_model_input_cache_read_tokens')!.metric.value).toBe(50);
    expect(byName('mastra_model_input_cache_write_tokens')!.metric.value).toBe(30);
    expect(byName('mastra_model_input_audio_tokens')!.metric.value).toBe(15);
    expect(byName('mastra_model_input_image_tokens')!.metric.value).toBe(5);
    expect(byName('mastra_model_output_text_tokens')!.metric.value).toBe(150);
    expect(byName('mastra_model_output_reasoning_tokens')!.metric.value).toBe(30);
    expect(byName('mastra_model_output_audio_tokens')!.metric.value).toBe(10);
    expect(byName('mastra_model_output_image_tokens')!.metric.value).toBe(10);
    expect(byName('mastra_model_total_input_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.00006375);
    expect(byName('mastra_model_total_input_tokens')!.metric.costContext?.costMetadata).toEqual({
      pricing_id: 'openai-gpt-4o-mini',
      tier_index: 0,
      error: 'partial_cost',
    });
    expect(byName('mastra_model_total_output_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.00009);
    expect(byName('mastra_model_total_output_tokens')!.metric.costContext?.costMetadata).toEqual({
      pricing_id: 'openai-gpt-4o-mini',
      tier_index: 0,
      error: 'partial_cost',
    });
    expect(byName('mastra_model_input_text_tokens')!.metric.costContext).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openai-gpt-4o-mini',
        tier_index: 0,
      },
    });
    expect(byName('mastra_model_input_text_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.00006);
    expect(byName('mastra_model_input_cache_read_tokens')!.metric.costContext).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openai-gpt-4o-mini',
        tier_index: 0,
      },
    });
    expect(byName('mastra_model_input_cache_read_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.00000375);
    expect(byName('mastra_model_output_text_tokens')!.metric.costContext).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      costUnit: 'USD',
      costMetadata: {
        pricing_id: 'openai-gpt-4o-mini',
        tier_index: 0,
      },
    });
    expect(byName('mastra_model_output_text_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.00009);
    expect(byName('mastra_model_output_reasoning_tokens')!.metric.costContext).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      costMetadata: {
        pricing_id: 'openai-gpt-4o-mini',
        tier_index: 0,
        error: 'no_pricing_for_usage_type',
      },
    });
  });

  it('should skip total token metrics when aggregate counts are missing', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.MODEL_GENERATION,
      endTime: new Date('2026-01-01T00:00:01Z'),
      attributes: {
        model: 'gpt-4o-mini',
        provider: 'openai',
        usage: {
          inputDetails: {
            text: 400,
            cacheRead: 50,
          },
          outputDetails: {
            text: 150,
            reasoning: 30,
          },
        },
      },
    });

    vi.spyOn(PricingRegistry, 'getGlobal').mockReturnValue(pricingRegistry);

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    const metricNames = emittedMetrics.map(m => m.metric.name);
    expect(metricNames).not.toContain('mastra_model_total_input_tokens');
    expect(metricNames).not.toContain('mastra_model_total_output_tokens');
    expect(metricNames).toContain('mastra_model_input_text_tokens');
    expect(metricNames).toContain('mastra_model_input_cache_read_tokens');
    expect(metricNames).toContain('mastra_model_output_text_tokens');
    expect(metricNames).toContain('mastra_model_output_reasoning_tokens');
  });

  it('should emit zero-valued total token metrics when aggregate counts are explicitly provided', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.MODEL_GENERATION,
      endTime: new Date('2026-01-01T00:00:01Z'),
      attributes: {
        model: 'gpt-4o-mini',
        provider: 'openai',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
      },
    });

    vi.spyOn(PricingRegistry, 'getGlobal').mockReturnValue(pricingRegistry);

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    const byName = (name: string) => emittedMetrics.find(m => m.metric.name === name);
    expect(byName('mastra_model_total_input_tokens')!.metric.value).toBe(0);
    expect(byName('mastra_model_total_output_tokens')!.metric.value).toBe(0);
  });

  it('should skip undefined token detail fields silently', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.MODEL_GENERATION,
      endTime: new Date('2026-01-01T00:00:01Z'),
      attributes: {
        model: 'claude-3',
        provider: 'anthropic',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
        },
      },
    });

    vi.spyOn(PricingRegistry, 'getGlobal').mockReturnValue(pricingRegistry);

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    const metricNames = emittedMetrics.map(m => m.metric.name);
    expect(metricNames).toContain('mastra_model_duration_ms');
    expect(metricNames).toContain('mastra_model_total_input_tokens');
    expect(metricNames).toContain('mastra_model_total_output_tokens');
    expect(metricNames).not.toContain('mastra_model_input_text_tokens');
    expect(metricNames).not.toContain('mastra_model_input_cache_read_tokens');
    expect(metricNames).not.toContain('mastra_model_output_reasoning_tokens');
  });

  it('should still emit token metrics when cost estimation throws', () => {
    setup();
    vi.spyOn(estimatorModule, 'estimateCosts').mockImplementation(() => {
      throw new Error('boom');
    });
    const span = createMockSpan({
      type: SpanType.MODEL_GENERATION,
      endTime: new Date('2026-01-01T00:00:01Z'),
      attributes: {
        model: 'gpt-4o-mini',
        provider: 'openai',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
        },
      },
    });

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    const inputTokens = emittedMetrics.find(m => m.metric.name === 'mastra_model_total_input_tokens');
    const outputTokens = emittedMetrics.find(m => m.metric.name === 'mastra_model_total_output_tokens');
    expect(inputTokens).toBeDefined();
    expect(outputTokens).toBeDefined();
    expect(inputTokens!.metric.value).toBe(100);
    expect(outputTokens!.metric.value).toBe(50);
    expect(inputTokens!.metric.costContext).toBeUndefined();
    expect(outputTokens!.metric.costContext).toBeUndefined();
  });

  it('should keep total output cost only when no output detail row has a successful cost', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.MODEL_GENERATION,
      endTime: new Date('2026-01-01T00:00:01Z'),
      attributes: {
        model: 'gpt-4o-mini',
        provider: 'openai',
        usage: {
          inputTokens: 100,
          outputTokens: 80,
          inputDetails: {
            text: 100,
          },
          outputDetails: {
            text: 50,
            reasoning: 30,
          },
        },
      },
    });

    vi.spyOn(PricingRegistry, 'getGlobal').mockReturnValue(pricingRegistry);

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    const byName = (name: string) => emittedMetrics.find(m => m.metric.name === name);
    expect(byName('mastra_model_total_input_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.000015);
    expect(byName('mastra_model_input_text_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.000015);
    expect(byName('mastra_model_total_output_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.00003);
    expect(byName('mastra_model_total_output_tokens')!.metric.costContext?.costMetadata).toEqual({
      pricing_id: 'openai-gpt-4o-mini',
      tier_index: 0,
      error: 'partial_cost',
    });
    expect(byName('mastra_model_output_text_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.00003);
    expect(byName('mastra_model_output_reasoning_tokens')!.metric.costContext).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      costMetadata: {
        pricing_id: 'openai-gpt-4o-mini',
        tier_index: 0,
        error: 'no_pricing_for_usage_type',
      },
    });
  });

  it('should use detail costs for both modes when all non-zero detail meters are priced', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.MODEL_GENERATION,
      endTime: new Date('2026-01-01T00:00:01Z'),
      attributes: {
        model: 'claude-sonnet-4-5',
        provider: 'anthropic',
        usage: {
          inputTokens: 160,
          outputTokens: 40,
          inputDetails: {
            text: 120,
            cacheRead: 40,
          },
          outputDetails: {
            text: 40,
          },
        },
      },
    });

    vi.spyOn(PricingRegistry, 'getGlobal').mockReturnValue(pricingRegistry);

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    const byName = (name: string) => emittedMetrics.find(m => m.metric.name === name);
    expect(byName('mastra_model_total_input_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.000372);
    expect(byName('mastra_model_total_output_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.0006);
    expect(byName('mastra_model_input_text_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.00036);
    expect(byName('mastra_model_input_cache_read_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.000012);
    expect(byName('mastra_model_output_text_tokens')!.metric.costContext?.estimatedCost).toBeCloseTo(0.0006);
  });

  it('should NOT emit metrics for unsupported span types', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.GENERIC,
      endTime: new Date('2026-01-01T00:00:01Z'),
    });

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    expect(emittedMetrics).toHaveLength(0);
  });

  it('should drop negative values from emit', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.AGENT_RUN,
      startTime: new Date('2026-01-01T00:00:01Z'),
      endTime: new Date('2026-01-01T00:00:00Z'),
    });

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    expect(emittedMetrics).toHaveLength(0);
  });

  it('should filter emitted labels through CardinalityFilter in MetricsContextImpl', () => {
    setup(new CardinalityFilter({ blockedLabels: ['status'] }));
    const span = createMockSpan({
      type: SpanType.AGENT_RUN,
      entityName: 'my-agent',
      endTime: new Date('2026-01-01T00:00:01Z'),
    });

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    expect(emittedMetrics).toHaveLength(1);
    expect(emittedMetrics[0]!.metric.labels).toEqual({});
  });

  it('should preserve status labels with the default filter behavior', () => {
    setup();
    const span = createMockSpan({
      type: SpanType.AGENT_RUN,
      entityName: 'my-agent',
      endTime: new Date('2026-01-01T00:00:01Z'),
    });

    emitAutoExtractedMetrics(span, createMetricsContext(span));

    expect(emittedMetrics[0]!.metric.labels).toEqual({ status: 'ok' });
  });
});
