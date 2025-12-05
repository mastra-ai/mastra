import type { UsageStats } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { extractUsageProperties } from './tracing';

describe('extractUsageProperties', () => {
  it('should extract basic tokens', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 50 };
    const result = extractUsageProperties(usage);
    expect(result.$ai_input_tokens).toBe(100);
    expect(result.$ai_output_tokens).toBe(50);
    expect(result.$ai_total_tokens).toBe(150); // Computed from inputTokens + outputTokens
  });

  it('should extract cacheRead from inputDetails', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } };
    const result = extractUsageProperties(usage);
    expect(result.cached_input_tokens).toBe(800);
  });

  it('should extract cacheWrite from inputDetails', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } };
    const result = extractUsageProperties(usage);
    expect(result.cache_write_tokens).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } };
    const result = extractUsageProperties(usage);
    expect(result.reasoning_tokens).toBe(400);
  });
});
