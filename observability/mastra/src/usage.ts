/**
 * Usage extraction utilities for converting AI SDK usage to Mastra UsageStats
 */

import type { InputTokenDetails, OutputTokenDetails, UsageStats } from '@mastra/core/observability';
import type { LanguageModelUsage, ProviderMetadata } from '@mastra/core/stream';

/**
 * Provider-specific metadata shapes for type-safe access.
 * These match the actual shapes from AI SDK providers.
 */
interface AnthropicMetadata {
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

interface GoogleUsageMetadata {
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
}

interface GoogleMetadata {
  usageMetadata?: GoogleUsageMetadata;
}

/**
 * Extracts and normalizes token usage from AI SDK response, including
 * provider-specific cache tokens from providerMetadata.
 *
 * Handles:
 * - OpenAI: cachedInputTokens in usage object
 * - Anthropic: cacheCreationInputTokens, cacheReadInputTokens in providerMetadata.anthropic
 * - Google/Gemini: cachedContentTokenCount, thoughtsTokenCount in providerMetadata.google.usageMetadata
 * - OpenRouter: Uses OpenAI-compatible structure (cache tokens in usage)
 *
 * @param usage - The LanguageModelV2Usage from AI SDK response
 * @param providerMetadata - Optional provider-specific metadata
 * @returns UsageStats with inputDetails and outputDetails
 */
export function extractUsageMetrics(usage?: LanguageModelUsage, providerMetadata?: ProviderMetadata): UsageStats {
  if (!usage) {
    return {};
  }

  const inputDetails: InputTokenDetails = {};
  const outputDetails: OutputTokenDetails = {};

  let inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;

  // ===== OpenAI / OpenRouter =====
  // cachedInputTokens is already in the usage object
  // inputTokens INCLUDES cached tokens (no adjustment needed)
  if (usage.cachedInputTokens) {
    inputDetails.cacheRead = usage.cachedInputTokens;
  }

  // reasoningTokens from usage (OpenAI o1 models)
  if (usage.reasoningTokens) {
    outputDetails.reasoning = usage.reasoningTokens;
  }

  // ===== Anthropic =====
  // Cache tokens are in providerMetadata.anthropic
  // inputTokens does NOT include cache tokens - need to sum them
  const anthropic = providerMetadata?.anthropic as AnthropicMetadata | undefined;

  if (anthropic) {
    if (anthropic.cacheReadInputTokens) {
      inputDetails.cacheRead = anthropic.cacheReadInputTokens;
    }
    if (anthropic.cacheCreationInputTokens) {
      inputDetails.cacheWrite = anthropic.cacheCreationInputTokens;
    }

    // For Anthropic, adjust inputTokens to include cache tokens
    // Per Anthropic docs: "Total input tokens is the summation of input_tokens,
    // cache_creation_input_tokens, and cache_read_input_tokens"
    if (anthropic.cacheReadInputTokens || anthropic.cacheCreationInputTokens) {
      inputDetails.text = usage.inputTokens;
      inputTokens =
        (usage.inputTokens ?? 0) + (anthropic.cacheReadInputTokens ?? 0) + (anthropic.cacheCreationInputTokens ?? 0);
    }
  }

  // ===== Google/Gemini =====
  // Cache tokens and thoughts are in providerMetadata.google.usageMetadata
  // Available in @ai-sdk/google@1.2.23+
  const google = providerMetadata?.google as GoogleMetadata | undefined;

  if (google?.usageMetadata) {
    if (google.usageMetadata.cachedContentTokenCount) {
      inputDetails.cacheRead = google.usageMetadata.cachedContentTokenCount;
    }
    // Gemini "thoughts" are similar to reasoning tokens
    if (google.usageMetadata.thoughtsTokenCount) {
      outputDetails.reasoning = google.usageMetadata.thoughtsTokenCount;
    }
  }

  // Build the final UsageStats object
  const result: UsageStats = {
    inputTokens,
    outputTokens,
  };

  // Only include details if there's data
  if (Object.keys(inputDetails).length > 0) {
    result.inputDetails = inputDetails;
  }
  if (Object.keys(outputDetails).length > 0) {
    result.outputDetails = outputDetails;
  }

  return result;
}
