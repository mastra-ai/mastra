import type { ModelGenerationAttributes } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { normalizeUsageMetrics } from './metrics';

describe('normalizeUsageMetrics', () => {
  it('should extract basic tokens', () => {
    const modelAttr: ModelGenerationAttributes = {
      usage: { inputTokens: 100, outputTokens: 50 },
    };
    const result = normalizeUsageMetrics(modelAttr);
    expect(result.prompt_tokens).toBe(100);
    expect(result.completion_tokens).toBe(50);
    expect(result.tokens).toBe(150);
  });

  it('should extract cacheRead from inputDetails', () => {
    const modelAttr: ModelGenerationAttributes = {
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } },
    };
    const result = normalizeUsageMetrics(modelAttr);
    expect(result.prompt_cached_tokens).toBe(800);
  });

  it('should extract cacheWrite from inputDetails', () => {
    const modelAttr: ModelGenerationAttributes = {
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } },
    };
    const result = normalizeUsageMetrics(modelAttr);
    expect(result.prompt_cache_creation_tokens).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const modelAttr: ModelGenerationAttributes = {
      usage: { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } },
    };
    const result = normalizeUsageMetrics(modelAttr);
    expect(result.completion_reasoning_tokens).toBe(400);
  });
});
