import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { getAttributes } from './gen-ai-semantics';

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

  it('should extract cacheRead from inputDetails', () => {
    const span = createModelGenerationSpan({
      model: 'claude-3-opus',
      provider: 'anthropic',
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.cached_input_tokens']).toBe(800);
    expect(attrs['llm.token_count.prompt_details.cache_read']).toBe(800);
  });

  it('should extract cacheWrite from inputDetails', () => {
    const span = createModelGenerationSpan({
      model: 'claude-3-opus',
      provider: 'anthropic',
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['llm.token_count.prompt_details.cache_write']).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const span = createModelGenerationSpan({
      model: 'o1-preview',
      provider: 'openai',
      usage: { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.reasoning_tokens']).toBe(400);
    expect(attrs['llm.token_count.completion_details.reasoning']).toBe(400);
  });

  it('should fallback to legacy cachedInputTokens', () => {
    const span = createModelGenerationSpan({
      model: 'gpt-4',
      provider: 'openai',
      usage: { inputTokens: 1000, outputTokens: 200, cachedInputTokens: 800 },
    });
    const attrs = getAttributes(span);
    expect(attrs['gen_ai.usage.cached_input_tokens']).toBe(800);
  });
});
