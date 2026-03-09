import type { LanguageModelUsage, ProviderMetadata } from '@mastra/core/stream';
import { describe, it, expect } from 'vitest';
import { extractUsageMetrics } from './usage';

describe('extractUsageMetrics', () => {
  describe('basic usage extraction', () => {
    it('should return empty object when usage is undefined', () => {
      const result = extractUsageMetrics(undefined);
      expect(result).toEqual({});
    });

    it('should extract basic input and output tokens', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 100,
        outputTokens: 50,
      };

      const result = extractUsageMetrics(usage);

      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
    });
  });

  describe('OpenAI / OpenRouter cache tokens', () => {
    it('should extract cachedInputTokens from usage object', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 1000,
        outputTokens: 200,
        cachedInputTokens: 800,
      };

      const result = extractUsageMetrics(usage);

      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(200);
      expect(result.inputDetails?.cacheRead).toBe(800);
    });

    it('should extract reasoningTokens from usage object (OpenAI o1 models)', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 100,
        outputTokens: 500,
        reasoningTokens: 400,
      };

      const result = extractUsageMetrics(usage);

      expect(result.outputDetails?.reasoning).toBe(400);
    });
  });

  describe('Anthropic cache tokens', () => {
    it('should extract cache tokens from providerMetadata.anthropic', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 100, // Base input tokens (does NOT include cache)
        outputTokens: 50,
      };

      const providerMetadata: ProviderMetadata = {
        anthropic: {
          cacheReadInputTokens: 800,
          cacheCreationInputTokens: 200,
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      // For Anthropic, total input = base + cacheRead + cacheCreation
      expect(result.inputTokens).toBe(1100); // 100 + 800 + 200
      expect(result.outputTokens).toBe(50);
      expect(result.inputDetails?.text).toBe(100);
      expect(result.inputDetails?.cacheRead).toBe(800);
      expect(result.inputDetails?.cacheWrite).toBe(200);
    });

    it('should handle Anthropic with only cache read tokens', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 50,
        outputTokens: 100,
      };

      const providerMetadata: ProviderMetadata = {
        anthropic: {
          cacheReadInputTokens: 500,
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      expect(result.inputTokens).toBe(550); // 50 + 500
      expect(result.inputDetails?.text).toBe(50);
      expect(result.inputDetails?.cacheRead).toBe(500);
      expect(result.inputDetails?.cacheWrite).toBeUndefined();
    });

    it('should handle Anthropic with only cache creation tokens', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 100,
        outputTokens: 50,
      };

      const providerMetadata: ProviderMetadata = {
        anthropic: {
          cacheCreationInputTokens: 1000,
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      expect(result.inputTokens).toBe(1100); // 100 + 1000
      expect(result.inputDetails?.text).toBe(100);
      expect(result.inputDetails?.cacheWrite).toBe(1000);
      expect(result.inputDetails?.cacheRead).toBeUndefined();
    });
  });

  describe('Google/Gemini cache and thought tokens', () => {
    it('should extract cache tokens from providerMetadata.google.usageMetadata', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 500,
        outputTokens: 200,
      };

      const providerMetadata: ProviderMetadata = {
        google: {
          usageMetadata: {
            cachedContentTokenCount: 300,
          },
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      expect(result.inputTokens).toBe(500);
      expect(result.inputDetails?.cacheRead).toBe(300);
    });

    it('should extract thought tokens from providerMetadata.google.usageMetadata', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 100,
        outputTokens: 500,
      };

      const providerMetadata: ProviderMetadata = {
        google: {
          usageMetadata: {
            thoughtsTokenCount: 300,
          },
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      expect(result.outputDetails?.reasoning).toBe(300);
    });

    it('should extract both cache and thought tokens from Google', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 200,
        outputTokens: 400,
      };

      const providerMetadata: ProviderMetadata = {
        google: {
          usageMetadata: {
            cachedContentTokenCount: 150,
            thoughtsTokenCount: 250,
          },
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      expect(result.inputDetails?.cacheRead).toBe(150);
      expect(result.outputDetails?.reasoning).toBe(250);
    });
  });

  describe('edge cases', () => {
    it('should handle zero token counts', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 0,
        outputTokens: 0,
      };

      const result = extractUsageMetrics(usage);

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });

    it('should not include inputDetails if empty', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 100,
        outputTokens: 50,
      };

      const result = extractUsageMetrics(usage);

      expect(result.inputDetails).toBeUndefined();
      expect(result.outputDetails).toBeUndefined();
    });

    it('should handle empty providerMetadata', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 100,
        outputTokens: 50,
      };

      const result = extractUsageMetrics(usage, {});

      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
    });

    it('should handle providerMetadata with empty anthropic object', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 100,
        outputTokens: 50,
      };

      const providerMetadata: ProviderMetadata = {
        anthropic: {},
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      expect(result.inputTokens).toBe(100);
      expect(result.inputDetails).toBeUndefined();
    });
  });
});
