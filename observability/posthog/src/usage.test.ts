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

  it('should pass gross input tokens with cache read for PostHog cost calculation', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } };
    const result = formatUsageMetrics(usage);
    expect(result.$ai_input_tokens).toBe(1000);
    expect(result.$ai_cache_read_input_tokens).toBe(800);
    expect(result.$ai_output_tokens).toBe(200);
  });

  it('should pass gross input tokens with cache write', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } };
    const result = formatUsageMetrics(usage);
    expect(result.$ai_input_tokens).toBe(1000);
    expect(result.$ai_cache_creation_input_tokens).toBe(500);
    expect(result.$ai_output_tokens).toBe(200);
  });

  it('should handle both cacheRead and cacheWrite together', () => {
    const usage: UsageStats = {
      inputTokens: 31067,
      outputTokens: 169,
      inputDetails: { cacheRead: 24440, cacheWrite: 1000 },
    };
    const result = formatUsageMetrics(usage);
    expect(result.$ai_input_tokens).toBe(31067);
    expect(result.$ai_cache_read_input_tokens).toBe(24440);
    expect(result.$ai_cache_creation_input_tokens).toBe(1000);
    expect(result.$ai_output_tokens).toBe(169);
  });

  it('should not subtract cache when cache read exceeds input (OpenAI prompt caching)', () => {
    const usage: UsageStats = {
      inputTokens: 10470,
      outputTokens: 2998,
      inputDetails: { cacheRead: 48384 },
    };
    const result = formatUsageMetrics(usage);
    expect(result.$ai_input_tokens).toBe(10470);
    expect(result.$ai_cache_read_input_tokens).toBe(48384);
    expect(result.$ai_output_tokens).toBe(2998);
  });

  it('should return empty metrics for undefined usage', () => {
    const result = formatUsageMetrics(undefined);
    expect(result).toEqual({});
  });
});
