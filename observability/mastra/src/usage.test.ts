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

    it('should handle cachedInputTokens with value 0', () => {
      const usage = {
        inputTokens: 500,
        outputTokens: 100,
        cachedInputTokens: 0,
      } as LanguageModelUsage;

      const result = extractUsageMetrics(usage);

      expect(result.inputDetails?.cacheRead).toBe(0);
    });

    it('should handle reasoningTokens with value 0', () => {
      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
      } as LanguageModelUsage;

      const result = extractUsageMetrics(usage);

      expect(result.outputDetails?.reasoning).toBe(0);
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

  describe('AI SDK inputTokenDetails (multi-step aggregation)', () => {
    it('should prefer inputTokenDetails.cacheReadTokens over providerMetadata', () => {
      // Simulates multi-step: inputTokenDetails is aggregated, providerMetadata is last step only
      const usage = {
        inputTokens: 500,
        outputTokens: 100,
        inputTokenDetails: {
          cacheReadTokens: 10000, // aggregated across all steps
          cacheWriteTokens: 5000,
        },
      } as LanguageModelUsage;

      const providerMetadata: ProviderMetadata = {
        anthropic: {
          cacheReadInputTokens: 3000, // last step only (wrong for aggregation)
          cacheCreationInputTokens: 0, // last step only
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      // Should use inputTokenDetails values (aggregated), not providerMetadata (last step)
      expect(result.inputDetails?.cacheRead).toBe(10000);
      expect(result.inputDetails?.cacheWrite).toBe(5000);
    });

    it('should use inputTokenDetails as fallback when providerMetadata has no cache data', () => {
      const usage = {
        inputTokens: 500,
        outputTokens: 100,
        inputTokenDetails: {
          cacheReadTokens: 300,
          cacheWriteTokens: 50,
        },
      } as LanguageModelUsage;

      const result = extractUsageMetrics(usage);

      expect(result.inputDetails?.cacheRead).toBe(300);
      expect(result.inputDetails?.cacheWrite).toBe(50);
    });

    it('should handle inputTokenDetails with zero values', () => {
      const usage = {
        inputTokens: 500,
        outputTokens: 100,
        inputTokenDetails: {
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      } as LanguageModelUsage;

      const result = extractUsageMetrics(usage);

      expect(result.inputDetails?.cacheRead).toBe(0);
      expect(result.inputDetails?.cacheWrite).toBe(0);
    });

    it('should fall back to providerMetadata when inputTokenDetails is absent', () => {
      const usage: LanguageModelUsage = {
        inputTokens: 100,
        outputTokens: 50,
      };

      const providerMetadata: ProviderMetadata = {
        anthropic: {
          cacheReadInputTokens: 800,
          cacheCreationInputTokens: 200,
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      expect(result.inputDetails?.cacheRead).toBe(800);
      expect(result.inputDetails?.cacheWrite).toBe(200);
      expect(result.inputTokens).toBe(1100); // Anthropic adjustment: 100 + 800 + 200
    });

    it('should prefer inputTokenDetails over usage.cachedInputTokens', () => {
      const usage = {
        inputTokens: 1000,
        outputTokens: 200,
        cachedInputTokens: 400, // stale or partial value
        inputTokenDetails: {
          cacheReadTokens: 800, // aggregated value
        },
      } as LanguageModelUsage;

      const result = extractUsageMetrics(usage);

      expect(result.inputDetails?.cacheRead).toBe(800);
    });

    it('should use Anthropic inputTokens adjustment with inputTokenDetails values', () => {
      // Multi-step Anthropic run: inputTokenDetails has aggregated cache,
      // providerMetadata has last step only
      const usage = {
        inputTokens: 100, // Anthropic base (does NOT include cache)
        outputTokens: 50,
        inputTokenDetails: {
          cacheReadTokens: 8000,
          cacheWriteTokens: 2000,
        },
      } as LanguageModelUsage;

      const providerMetadata: ProviderMetadata = {
        anthropic: {
          cacheReadInputTokens: 3000, // last step only — should be ignored
          cacheCreationInputTokens: 0,
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      // inputTokenDetails values should be used (aggregated)
      expect(result.inputDetails?.cacheRead).toBe(8000);
      expect(result.inputDetails?.cacheWrite).toBe(2000);
      // Anthropic adjustment uses the correct aggregated values
      expect(result.inputTokens).toBe(10100); // 100 + 8000 + 2000
      expect(result.inputDetails?.text).toBe(100);
    });

    it('should prefer inputTokenDetails over Google providerMetadata for cacheRead', () => {
      const usage = {
        inputTokens: 500,
        outputTokens: 100,
        inputTokenDetails: {
          cacheReadTokens: 7000, // aggregated
        },
      } as LanguageModelUsage;

      const providerMetadata: ProviderMetadata = {
        google: {
          usageMetadata: {
            cachedContentTokenCount: 3000, // last step only
            thoughtsTokenCount: 49,
          },
        },
      };

      const result = extractUsageMetrics(usage, providerMetadata);

      expect(result.inputDetails?.cacheRead).toBe(7000); // inputTokenDetails wins
      expect(result.outputDetails?.reasoning).toBe(49); // thoughts still extracted from Google
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
