import type { UsageStats } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { formatUsageMetrics } from './tracing';

describe('formatUsageMetrics', () => {
  it('should extract basic tokens', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 50 };
    const result = formatUsageMetrics(usage);
    expect(result.$ai_input_tokens).toBe(100);
    expect(result.$ai_output_tokens).toBe(50);
  });

  it('should extract cacheRead from inputDetails and subtract from input', () => {
    // inputTokens from usage.ts is the total (non-cached + cached)
    // PostHog expects $ai_input_tokens to be NON-cached only for cost calculation
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } };
    const result = formatUsageMetrics(usage);
    expect(result.$ai_cache_read_input_tokens).toBe(800);
    // $ai_input_tokens should be non-cached: 1000 - 800 = 200
    expect(result.$ai_input_tokens).toBe(200);
    expect(result.$ai_output_tokens).toBe(200);
  });

  it('should extract cacheWrite from inputDetails and subtract from input', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } };
    const result = formatUsageMetrics(usage);
    expect(result.$ai_cache_creation_input_tokens).toBe(500);
    // $ai_input_tokens should be non-cached: 1000 - 500 = 500
    expect(result.$ai_input_tokens).toBe(500);
    expect(result.$ai_output_tokens).toBe(200);
  });

  it('should handle both cacheRead and cacheWrite together', () => {
    // Simulates Anthropic usage: inputTokens = non-cached + cacheRead + cacheWrite
    // e.g., 5627 non-cached + 24440 cacheRead + 1000 cacheWrite = 31067 total
    const usage: UsageStats = {
      inputTokens: 31067,
      outputTokens: 169,
      inputDetails: { cacheRead: 24440, cacheWrite: 1000 },
    };
    const result = formatUsageMetrics(usage);
    expect(result.$ai_cache_read_input_tokens).toBe(24440);
    expect(result.$ai_cache_creation_input_tokens).toBe(1000);
    // $ai_input_tokens should be non-cached: 31067 - 24440 - 1000 = 5627
    expect(result.$ai_input_tokens).toBe(5627);
    expect(result.$ai_output_tokens).toBe(169);
  });

  it('should return empty metrics for undefined usage', () => {
    const result = formatUsageMetrics(undefined);
    expect(result).toEqual({});
  });

  it('should clamp input tokens to zero if cache exceeds total', () => {
    // Edge case: if cache tokens somehow exceed inputTokens, don't go negative
    const usage: UsageStats = { inputTokens: 100, outputTokens: 50, inputDetails: { cacheRead: 150 } };
    const result = formatUsageMetrics(usage);
    expect(result.$ai_cache_read_input_tokens).toBe(150);
    expect(result.$ai_input_tokens).toBe(0); // Clamped to 0, not -50
    expect(result.$ai_output_tokens).toBe(50);
  });
});
