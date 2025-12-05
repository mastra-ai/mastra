import type { LanguageModelV2Usage, SharedV2ProviderMetadata } from '@ai-sdk/provider-v5';
import { describe, it, expect } from 'vitest';
import type { UsageStats } from '../../../observability/types/tracing';
import { extractUsageWithCacheTokens, mergeUsageStats } from './usage';

describe('extractUsageWithCacheTokens', () => {
  describe('basic usage extraction', () => {
    it('should return empty object when usage is undefined', () => {
      const result = extractUsageWithCacheTokens(undefined);
      expect(result).toEqual({});
    });

    it('should extract basic input and output tokens', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      const result = extractUsageWithCacheTokens(usage);

      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
      expect(result.totalTokens).toBe(150);
    });
  });

  describe('OpenAI / OpenRouter cache tokens', () => {
    it('should extract cachedInputTokens from usage object', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 1000,
        outputTokens: 200,
        totalTokens: 1200,
        cachedInputTokens: 800,
      };

      const result = extractUsageWithCacheTokens(usage);

      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(200);
      expect(result.inputDetails?.cacheRead).toBe(800);
      // Legacy fields for backward compatibility
      expect(result.cachedInputTokens).toBe(800);
      expect(result.promptCacheHitTokens).toBe(800);
    });

    it('should extract reasoningTokens from usage object (OpenAI o1 models)', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 100,
        outputTokens: 500,
        totalTokens: 600,
        reasoningTokens: 400,
      };

      const result = extractUsageWithCacheTokens(usage);

      expect(result.outputDetails?.reasoning).toBe(400);
      expect(result.reasoningTokens).toBe(400);
    });
  });

  describe('Anthropic cache tokens', () => {
    it('should extract cache tokens from providerMetadata.anthropic', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 100, // Base input tokens (does NOT include cache)
        outputTokens: 50,
        totalTokens: 150,
      };

      const providerMetadata: SharedV2ProviderMetadata = {
        anthropic: {
          cacheReadInputTokens: 800,
          cacheCreationInputTokens: 200,
        },
      };

      const result = extractUsageWithCacheTokens(usage, providerMetadata);

      // For Anthropic, total input = base + cacheRead + cacheCreation
      expect(result.inputTokens).toBe(1100); // 100 + 800 + 200
      expect(result.outputTokens).toBe(50);
      expect(result.inputDetails?.text).toBe(100);
      expect(result.inputDetails?.cacheRead).toBe(800);
      expect(result.inputDetails?.cacheWrite).toBe(200);
      // Legacy fields
      expect(result.cachedInputTokens).toBe(800);
      expect(result.promptCacheHitTokens).toBe(800);
      expect(result.promptCacheMissTokens).toBe(200);
    });

    it('should handle Anthropic with only cache read tokens', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 50,
        outputTokens: 100,
        totalTokens: 150,
      };

      const providerMetadata: SharedV2ProviderMetadata = {
        anthropic: {
          cacheReadInputTokens: 500,
        },
      };

      const result = extractUsageWithCacheTokens(usage, providerMetadata);

      expect(result.inputTokens).toBe(550); // 50 + 500
      expect(result.inputDetails?.text).toBe(50);
      expect(result.inputDetails?.cacheRead).toBe(500);
      expect(result.inputDetails?.cacheWrite).toBeUndefined();
    });

    it('should handle Anthropic with only cache creation tokens', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      const providerMetadata: SharedV2ProviderMetadata = {
        anthropic: {
          cacheCreationInputTokens: 1000,
        },
      };

      const result = extractUsageWithCacheTokens(usage, providerMetadata);

      expect(result.inputTokens).toBe(1100); // 100 + 1000
      expect(result.inputDetails?.text).toBe(100);
      expect(result.inputDetails?.cacheWrite).toBe(1000);
      expect(result.inputDetails?.cacheRead).toBeUndefined();
    });
  });

  describe('Google/Gemini cache and thought tokens', () => {
    it('should extract cache tokens from providerMetadata.google.usageMetadata', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
      };

      const providerMetadata: SharedV2ProviderMetadata = {
        google: {
          usageMetadata: {
            cachedContentTokenCount: 300,
          },
        },
      };

      const result = extractUsageWithCacheTokens(usage, providerMetadata);

      expect(result.inputTokens).toBe(500);
      expect(result.inputDetails?.cacheRead).toBe(300);
      expect(result.cachedInputTokens).toBe(300);
    });

    it('should extract thought tokens from providerMetadata.google.usageMetadata', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 100,
        outputTokens: 500,
        totalTokens: 600,
      };

      const providerMetadata: SharedV2ProviderMetadata = {
        google: {
          usageMetadata: {
            thoughtsTokenCount: 300,
          },
        },
      };

      const result = extractUsageWithCacheTokens(usage, providerMetadata);

      expect(result.outputDetails?.reasoning).toBe(300);
      expect(result.reasoningTokens).toBe(300);
    });

    it('should extract both cache and thought tokens from Google', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 200,
        outputTokens: 400,
        totalTokens: 600,
      };

      const providerMetadata: SharedV2ProviderMetadata = {
        google: {
          usageMetadata: {
            cachedContentTokenCount: 150,
            thoughtsTokenCount: 250,
          },
        },
      };

      const result = extractUsageWithCacheTokens(usage, providerMetadata);

      expect(result.inputDetails?.cacheRead).toBe(150);
      expect(result.outputDetails?.reasoning).toBe(250);
    });
  });

  describe('edge cases', () => {
    it('should handle zero token counts', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };

      const result = extractUsageWithCacheTokens(usage);

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.totalTokens).toBe(0);
    });

    it('should not include inputDetails if empty', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      const result = extractUsageWithCacheTokens(usage);

      expect(result.inputDetails).toBeUndefined();
      expect(result.outputDetails).toBeUndefined();
    });

    it('should handle empty providerMetadata', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      const result = extractUsageWithCacheTokens(usage, {});

      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
    });

    it('should handle providerMetadata with empty anthropic object', () => {
      const usage: LanguageModelV2Usage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      const providerMetadata: SharedV2ProviderMetadata = {
        anthropic: {},
      };

      const result = extractUsageWithCacheTokens(usage, providerMetadata);

      expect(result.inputTokens).toBe(100);
      expect(result.inputDetails).toBeUndefined();
    });
  });
});

describe('mergeUsageStats', () => {
  it('should return empty object when both inputs are undefined', () => {
    const result = mergeUsageStats(undefined, undefined);
    expect(result).toEqual({});
  });

  it('should return base when addition is undefined', () => {
    const base: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
    };

    const result = mergeUsageStats(base, undefined);

    expect(result).toEqual(base);
  });

  it('should return addition when base is undefined', () => {
    const addition: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
    };

    const result = mergeUsageStats(undefined, addition);

    expect(result).toEqual(addition);
  });

  it('should sum basic token counts', () => {
    const base: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
    };

    const addition: UsageStats = {
      inputTokens: 200,
      outputTokens: 100,
    };

    const result = mergeUsageStats(base, addition);

    expect(result.inputTokens).toBe(300);
    expect(result.outputTokens).toBe(150);
    expect(result.totalTokens).toBe(450);
  });

  it('should merge inputDetails', () => {
    const base: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
      inputDetails: {
        text: 50,
        cacheRead: 50,
      },
    };

    const addition: UsageStats = {
      inputTokens: 200,
      outputTokens: 100,
      inputDetails: {
        text: 100,
        cacheRead: 100,
        cacheWrite: 50,
      },
    };

    const result = mergeUsageStats(base, addition);

    expect(result.inputDetails?.text).toBe(150);
    expect(result.inputDetails?.cacheRead).toBe(150);
    expect(result.inputDetails?.cacheWrite).toBe(50);
  });

  it('should merge outputDetails', () => {
    const base: UsageStats = {
      inputTokens: 100,
      outputTokens: 200,
      outputDetails: {
        text: 100,
        reasoning: 100,
      },
    };

    const addition: UsageStats = {
      inputTokens: 100,
      outputTokens: 300,
      outputDetails: {
        text: 150,
        reasoning: 150,
      },
    };

    const result = mergeUsageStats(base, addition);

    expect(result.outputDetails?.text).toBe(250);
    expect(result.outputDetails?.reasoning).toBe(250);
  });

  it('should update legacy fields when merging', () => {
    const base: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
      inputDetails: {
        cacheRead: 50,
        cacheWrite: 25,
      },
      outputDetails: {
        reasoning: 20,
      },
    };

    const addition: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
      inputDetails: {
        cacheRead: 50,
        cacheWrite: 25,
      },
      outputDetails: {
        reasoning: 30,
      },
    };

    const result = mergeUsageStats(base, addition);

    expect(result.cachedInputTokens).toBe(100);
    expect(result.promptCacheHitTokens).toBe(100);
    expect(result.promptCacheMissTokens).toBe(50);
    expect(result.reasoningTokens).toBe(50);
  });

  it('should handle merging with partial inputDetails', () => {
    const base: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
      inputDetails: {
        cacheRead: 50,
      },
    };

    const addition: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
      // No inputDetails
    };

    const result = mergeUsageStats(base, addition);

    expect(result.inputDetails?.cacheRead).toBe(50);
  });

  it('should handle audio tokens in details', () => {
    const base: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
      inputDetails: {
        audio: 20,
      },
      outputDetails: {
        audio: 10,
      },
    };

    const addition: UsageStats = {
      inputTokens: 100,
      outputTokens: 50,
      inputDetails: {
        audio: 30,
      },
      outputDetails: {
        audio: 20,
      },
    };

    const result = mergeUsageStats(base, addition);

    expect(result.inputDetails?.audio).toBe(50);
    expect(result.outputDetails?.audio).toBe(30);
  });
});
