import type { ModelGenerationAttributes } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { normalizeUsageMetrics } from './metrics';

describe('normalizeUsageMetrics', () => {
  it('should extract basic tokens', () => {
    const modelAttr: ModelGenerationAttributes = {
      usage: { inputTokens: 100, outputTokens: 50 },
    };
    const result = normalizeUsageMetrics(modelAttr);
    expect(result.input_tokens).toBe(100);
    expect(result.output_tokens).toBe(50);
    expect(result.total_tokens).toBe(150);
  });

  it('should extract cacheRead from inputDetails', () => {
    const modelAttr: ModelGenerationAttributes = {
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } },
    };
    const result = normalizeUsageMetrics(modelAttr);
    expect(result.input_token_details?.cache_read).toBe(800);
  });

  it('should extract cacheWrite from inputDetails', () => {
    const modelAttr: ModelGenerationAttributes = {
      usage: { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } },
    };
    const result = normalizeUsageMetrics(modelAttr);
    expect(result.input_token_details?.cache_write).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const modelAttr: ModelGenerationAttributes = {
      usage: { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } },
    };
    const result = normalizeUsageMetrics(modelAttr);
    expect(result.output_token_details?.reasoning_tokens).toBe(400);
  });
});
