import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan, ModelGenerationAttributes, UsageStats } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { getAttributes, formatUsageMetrics } from './gen-ai-semantics';

function createModelGenerationSpan(attributes: ModelGenerationAttributes): AnyExportedSpan {
  return {
    id: 'test-span-id',
    traceId: 'test-trace-id',
    name: 'test-generation',
    type: SpanType.MODEL_GENERATION,
    startTime: new Date(),
    isRootSpan: false,
    isEvent: false,
    attributes,
  } as AnyExportedSpan;
}

function createSpan(type: SpanType, metadata?: Record<string, unknown>): AnyExportedSpan {
  return {
    id: 'test-span-id',
    traceId: 'test-trace-id',
    name: 'test-span',
    type,
    startTime: new Date(),
    isRootSpan: false,
    isEvent: false,
    metadata,
    attributes: {},
  } as AnyExportedSpan;
}

describe('getAttributes - token usage', () => {
  it('should extract basic tokens', () => {
    const span = createModelGenerationSpan({
      model: 'gpt-4',
      provider: 'openai',
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.input_tokens']).toBe(100);
    expect(attrs['gen_ai.usage.output_tokens']).toBe(50);
  });

  it('should extract cacheRead from inputDetails using OTel-spec attribute name', () => {
    const span = createModelGenerationSpan({
      model: 'claude-3-opus',
      provider: 'anthropic',
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.cache_read.input_tokens']).toBe(800);
  });

  it('should extract cacheWrite from inputDetails using OTel-spec attribute name', () => {
    const span = createModelGenerationSpan({
      model: 'claude-3-opus',
      provider: 'anthropic',
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.cache_creation.input_tokens']).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const span = createModelGenerationSpan({
      model: 'o1-preview',
      provider: 'openai',
      usage: { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.reasoning_tokens']).toBe(400);
  });
});

describe('formatUsageMetrics', () => {
  it('should extract basic tokens', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 50 };
    const result = formatUsageMetrics(usage);
    expect(result['gen_ai.usage.input_tokens']).toBe(100);
    expect(result['gen_ai.usage.output_tokens']).toBe(50);
  });

  it('should extract cacheRead from inputDetails using OTel-spec attribute name', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } };
    const result = formatUsageMetrics(usage);
    expect(result['gen_ai.usage.cache_read.input_tokens']).toBe(800);
  });

  it('should extract cacheWrite from inputDetails using OTel-spec attribute name', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } };
    const result = formatUsageMetrics(usage);
    expect(result['gen_ai.usage.cache_creation.input_tokens']).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } };
    const result = formatUsageMetrics(usage);
    expect(result['gen_ai.usage.reasoning_tokens']).toBe(400);
  });

  it('should not emit non-spec cache attribute names that older versions used', () => {
    const usage: UsageStats = {
      inputTokens: 1000,
      outputTokens: 500,
      inputDetails: { cacheRead: 600, cacheWrite: 200 },
    };
    const result = formatUsageMetrics(usage) as Record<string, unknown>;
    expect(result['gen_ai.usage.cached_input_tokens']).toBeUndefined();
    expect(result['gen_ai.usage.cache_write_tokens']).toBeUndefined();
  });

  it('should return empty metrics for undefined usage', () => {
    const result = formatUsageMetrics(undefined);
    expect(result).toEqual({});
  });
});

describe('getAttributes - conversation id', () => {
  it.each([SpanType.MODEL_GENERATION, SpanType.TOOL_CALL, SpanType.MCP_TOOL_CALL])(
    'should set gen_ai.conversation.id from metadata.threadId for %s spans',
    spanType => {
      const attrs = getAttributes(createSpan(spanType, { threadId: 'thread-123' }));

      expect(attrs['gen_ai.conversation.id']).toBe('thread-123');
    },
  );

  it('should not set gen_ai.conversation.id when metadata.threadId is absent', () => {
    const attrs = getAttributes(createSpan(SpanType.MODEL_GENERATION, { resourceId: 'resource-123' }));

    expect(attrs).not.toHaveProperty('gen_ai.conversation.id');
  });
});
