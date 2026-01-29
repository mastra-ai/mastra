import type { UsageStats } from '@mastra/core/observability';
import { describe, it, expect } from 'vitest';
import { formatUsageMetrics } from './metrics';

describe('formatUsageMetrics', () => {
  it('should extract basic tokens', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 50 };
    const result = formatUsageMetrics(usage);
    expect(result?.input).toBe(100);
    expect(result?.output).toBe(50);
    expect(result?.total).toBe(150);
  });

  it('should extract cacheRead from inputDetails and subtract from input', () => {
    // inputTokens from usage.ts is the total (non-cached + cached)
    // Langfuse expects 'input' to be NON-cached only
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheRead: 800 } };
    const result = formatUsageMetrics(usage);
    expect(result?.cache_read_input_tokens).toBe(800);
    // input should be non-cached: 1000 - 800 = 200
    expect(result?.input).toBe(200);
    // total = input (200) + output (200) + cache_read (800) = 1200
    expect(result?.total).toBe(1200);
  });

  it('should extract cacheWrite from inputDetails and subtract from input', () => {
    const usage: UsageStats = { inputTokens: 1000, outputTokens: 200, inputDetails: { cacheWrite: 500 } };
    const result = formatUsageMetrics(usage);
    expect(result?.cache_write_input_tokens).toBe(500);
    // input should be non-cached: 1000 - 500 = 500
    expect(result?.input).toBe(500);
    // total = input (500) + output (200) + cache_write (500) = 1200
    expect(result?.total).toBe(1200);
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
    expect(result?.cache_read_input_tokens).toBe(24440);
    expect(result?.cache_write_input_tokens).toBe(1000);
    // input should be non-cached: 31067 - 24440 - 1000 = 5627
    expect(result?.input).toBe(5627);
    // total = input (5627) + output (169) + cache_read (24440) + cache_write (1000) = 31236
    expect(result?.total).toBe(31236);
  });

  it('should extract reasoning from outputDetails', () => {
    const usage: UsageStats = { inputTokens: 100, outputTokens: 500, outputDetails: { reasoning: 400 } };
    const result = formatUsageMetrics(usage);
    expect(result?.reasoning).toBe(400);
  });
});
