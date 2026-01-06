/**
 * Tests for metrics transformation utilities
 */

import { describe, it, expect } from 'vitest';
import { formatUsageMetrics } from './metrics';

describe('formatUsageMetrics', () => {
  it('transforms OpenInference usage metrics format to Datadog metrics format', () => {
    const result = formatUsageMetrics({
      inputTokens: 200,
      outputTokens: 100,
      inputDetails: {
        cacheRead: 100,
        cacheWrite: 50,
      },
      outputDetails: {
        reasoning: 20,
      },
    });

    expect(result).toEqual({
      inputTokens: 200,
      outputTokens: 100,
      totalTokens: 300,
      cachedInputTokens: 100,
      cachedOutputTokens: 50,
      reasoningTokens: 20,
    });
  });

  it('calculates total tokens from input and output', () => {
    const result = formatUsageMetrics({
      inputTokens: 50,
      outputTokens: 25,
    });

    expect(result).toEqual({
      inputTokens: 50,
      outputTokens: 25,
      totalTokens: 75,
    });
  });

  it('returns undefined for undefined usage', () => {
    const result = formatUsageMetrics(undefined);
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty usage object', () => {
    const result = formatUsageMetrics({});
    expect(result).toBeUndefined();
  });

  it('handles partial usage data', () => {
    const result = formatUsageMetrics({
      inputTokens: 100,
    });

    expect(result).toEqual({
      inputTokens: 100,
    });
  });

  it('extracts reasoning tokens from outputDetails', () => {
    const result = formatUsageMetrics({
      inputTokens: 100,
      outputTokens: 50,
      outputDetails: {
        reasoning: 20,
      },
    });

    expect(result).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      reasoningTokens: 20,
    });
  });

  it('extracts cached tokens from inputDetails', () => {
    const result = formatUsageMetrics({
      inputTokens: 100,
      outputTokens: 50,
      inputDetails: {
        cacheRead: 30,
      },
    });

    expect(result).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cachedInputTokens: 30,
    });
  });
});
