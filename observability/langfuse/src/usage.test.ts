import type { UsageStats } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { formatUsageMetrics } from './tracing';

describe('formatUsageMetrics', () => {
  it('should extract basic tokens', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 50 };
    const result = formatUsageMetrics(usage);
    expect(result?.input).toBe(100);
    expect(result?.output).toBe(50);
    expect(result?.total).toBe(150);
  });

  it('should extract cacheRead from inputDetails', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } };
    const result = formatUsageMetrics(usage);
    expect(result?.cache_read_input_tokens).toBe(800);
  });

  it('should extract cacheWrite from inputDetails', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } };
    const result = formatUsageMetrics(usage);
    expect(result?.cache_write_input_tokens).toBe(500);
    // cacheWrite tokens are subtracted from input
    expect(result?.input).toBe(500);
  });

  it('should extract reasoning from outputDetails', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } };
    const result = formatUsageMetrics(usage);
    expect(result?.reasoning).toBe(400);
  });
});
