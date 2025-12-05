import type { UsageStats } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { formatUsageMetrics, extractTimeToFirstToken } from './metrics';

describe('formatUsageMetrics', () => {
  it('should extract basic tokens', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 50 };
    const result = formatUsageMetrics(usage);
    expect(result.prompt_tokens).toBe(100);
    expect(result.completion_tokens).toBe(50);
    expect(result.tokens).toBe(150);
  });

  it('should extract cacheRead from inputDetails', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } };
    const result = formatUsageMetrics(usage);
    expect(result.prompt_cached_tokens).toBe(800);
  });

  it('should extract cacheWrite from inputDetails', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } };
    const result = formatUsageMetrics(usage);
    expect(result.prompt_cache_creation_tokens).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } };
    const result = formatUsageMetrics(usage);
    expect(result.completion_reasoning_tokens).toBe(400);
  });

  it('should return empty metrics for undefined usage', () => {
    const result = formatUsageMetrics(undefined);
    expect(result).toEqual({});
  });
});

describe('extractTimeToFirstToken', () => {
  it('should extract TTFT from Date', () => {
    const date = new Date('2025-01-01T00:00:00.000Z');
    const result = extractTimeToFirstToken(date);
    expect(result).toBe(date.getTime());
  });

  it('should extract TTFT from number', () => {
    const result = extractTimeToFirstToken(1234567890);
    expect(result).toBe(1234567890);
  });

  it('should extract TTFT from string', () => {
    const dateStr = '2025-01-01T00:00:00.000Z';
    const result = extractTimeToFirstToken(dateStr);
    expect(result).toBe(new Date(dateStr).getTime());
  });

  it('should return undefined for undefined input', () => {
    const result = extractTimeToFirstToken(undefined);
    expect(result).toBeUndefined();
  });
});
