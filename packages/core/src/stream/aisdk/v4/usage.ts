import type { UsageStats } from '../../../observability';

/**
 * AI SDK v4 LanguageModelUsage type definition
 * (matches the ai package's LanguageModelUsage)
 */
interface LanguageModelUsageV4 {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
}

/**
 * Converts AI SDK v4 LanguageModelUsage to our UsageStats format.
 *
 * @param usage - The LanguageModelUsage from AI SDK v4
 * @returns Normalized UsageStats
 */
export function convertV4Usage(usage: LanguageModelUsageV4 | undefined): UsageStats {
  if (!usage) {
    return {};
  }

  return {
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
  };
}
