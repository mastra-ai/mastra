import type { LanguageModelV2Usage, SharedV2ProviderMetadata } from '@ai-sdk/provider-v5';

import type { InputTokenDetails, OutputTokenDetails, UsageStats } from '../../../observability/types/tracing';

/**
 * Provider-specific metadata types for cache token extraction
 */
interface AnthropicProviderMetadata {
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

interface GoogleUsageMetadata {
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

interface GoogleProviderMetadata {
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
 * @returns Normalized UsageStats with inputDetails and outputDetails
 */
export function extractUsageWithCacheTokens(
  usage: LanguageModelV2Usage | undefined,
  providerMetadata?: SharedV2ProviderMetadata,
): UsageStats {
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
  const anthropic = providerMetadata?.anthropic as AnthropicProviderMetadata | undefined;

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
  const google = providerMetadata?.google as GoogleProviderMetadata | undefined;

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

/**
 * Merges two UsageStats objects, summing numeric values and combining details.
 * Useful for aggregating usage across multiple model calls or streaming chunks.
 */
export function mergeUsageStats(base: UsageStats | undefined, addition: UsageStats | undefined): UsageStats {
  if (!base) return addition ?? {};
  if (!addition) return base;

  const merged: UsageStats = {
    inputTokens: (base.inputTokens ?? 0) + (addition.inputTokens ?? 0),
    outputTokens: (base.outputTokens ?? 0) + (addition.outputTokens ?? 0),
  };

  // Merge input details
  if (base.inputDetails || addition.inputDetails) {
    merged.inputDetails = {
      text: sumOptional(base.inputDetails?.text, addition.inputDetails?.text),
      cacheRead: sumOptional(base.inputDetails?.cacheRead, addition.inputDetails?.cacheRead),
      cacheWrite: sumOptional(base.inputDetails?.cacheWrite, addition.inputDetails?.cacheWrite),
      audio: sumOptional(base.inputDetails?.audio, addition.inputDetails?.audio),
      image: sumOptional(base.inputDetails?.image, addition.inputDetails?.image),
    };
    // Remove undefined values
    merged.inputDetails = cleanObject(merged.inputDetails);
  }

  // Merge output details
  if (base.outputDetails || addition.outputDetails) {
    merged.outputDetails = {
      text: sumOptional(base.outputDetails?.text, addition.outputDetails?.text),
      reasoning: sumOptional(base.outputDetails?.reasoning, addition.outputDetails?.reasoning),
      audio: sumOptional(base.outputDetails?.audio, addition.outputDetails?.audio),
      image: sumOptional(base.outputDetails?.image, addition.outputDetails?.image),
    };
    // Remove undefined values
    merged.outputDetails = cleanObject(merged.outputDetails);
  }

  return merged;
}

function sumOptional(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return (a ?? 0) + (b ?? 0);
}

function cleanObject<T extends object>(obj: T): T {
  const cleaned = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  }
  return cleaned as T;
}
