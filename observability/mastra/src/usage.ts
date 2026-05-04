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

interface V3InputUsage {
  total?: number;
  noCache?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

interface V3RawUsage {
  inputTokens?: V3InputUsage;
}

function isV3RawUsage(raw: unknown): raw is V3RawUsage {
  return typeof raw === 'object' && raw !== null && 'inputTokens' in raw;
}

/**
 * AI SDK aggregated input token details.
 * Available on totalUsage in multi-step runs - properly summed across all steps.
 */
interface AISdkInputTokenDetails {
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * Null-safe check: returns true if value is a number (including 0).
 */
function isDefined(value: unknown): value is number {
  return value != null;
}

/**
 * Extracts and normalizes token usage from AI SDK response, including
 * provider-specific cache tokens from providerMetadata.
 *
 * Cache token extraction priority (highest to lowest):
 * 1. AI SDK aggregated inputTokenDetails (properly summed across all steps in multi-step runs)
 * 2. Mastra-aggregated top-level usage fields (usage.cachedInputTokens, usage.cacheCreationInputTokens) -
 *    summed across steps by RunOutput, so they are correct for multi-step runs.
 * 3. Provider-specific providerMetadata (accurate for single-step, LAST STEP ONLY in multi-step).
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

  // ===== AI SDK aggregated format (inputTokenDetails) =====
  // In multi-step runs, providerMetadata only reflects the LAST step.
  // AI SDK's inputTokenDetails is properly aggregated across all steps,
  // so we prefer it as the primary source for cache tokens.
  const aiSdkDetails = (usage as { inputTokenDetails?: AISdkInputTokenDetails }).inputTokenDetails;

  if (isDefined(aiSdkDetails?.cacheReadTokens)) {
    inputDetails.cacheRead = aiSdkDetails.cacheReadTokens;
  }
  if (isDefined(aiSdkDetails?.cacheWriteTokens)) {
    inputDetails.cacheWrite = aiSdkDetails.cacheWriteTokens;
  }

  // Mastra-aggregated fields — summed across steps by RunOutput; prefer over per-step providerMetadata.
  if (!isDefined(inputDetails.cacheRead) && isDefined(usage.cachedInputTokens)) {
    inputDetails.cacheRead = usage.cachedInputTokens;
  }
  if (!isDefined(inputDetails.cacheWrite) && isDefined(usage.cacheCreationInputTokens)) {
    inputDetails.cacheWrite = usage.cacheCreationInputTokens;
  }

  // reasoningTokens from usage (OpenAI o1 models)
  if (isDefined(usage.reasoningTokens)) {
    outputDetails.reasoning = usage.reasoningTokens;
  }

  // ===== Anthropic =====
  // Cache tokens are in providerMetadata.anthropic
  // inputTokens does NOT include cache tokens - need to sum them
  const anthropic = providerMetadata?.anthropic as AnthropicMetadata | undefined;

  if (anthropic) {
    const rawV3InputUsage = isV3RawUsage(usage.raw) ? usage.raw.inputTokens : undefined;
    const hasV3CachedTotals =
      rawV3InputUsage?.total !== undefined &&
      (rawV3InputUsage.cacheRead !== undefined || rawV3InputUsage.cacheWrite !== undefined);

    if (!isDefined(inputDetails.cacheRead) && isDefined(anthropic.cacheReadInputTokens)) {
      inputDetails.cacheRead = anthropic.cacheReadInputTokens;
    }
    if (!isDefined(inputDetails.cacheWrite) && isDefined(anthropic.cacheCreationInputTokens)) {
      inputDetails.cacheWrite = anthropic.cacheCreationInputTokens;
    }

    // Skip adjustment when inputTokens already includes cache tokens (V3 raw or any positive Mastra-aggregated cache field).
    const inputAlreadyIncludesCache =
      hasV3CachedTotals ||
      (isDefined(usage.cachedInputTokens) && usage.cachedInputTokens > 0) ||
      (isDefined(usage.cacheCreationInputTokens) && usage.cacheCreationInputTokens > 0);

    if (!inputAlreadyIncludesCache && (isDefined(inputDetails.cacheRead) || isDefined(inputDetails.cacheWrite))) {
      inputTokens = (usage.inputTokens ?? 0) + (inputDetails.cacheRead ?? 0) + (inputDetails.cacheWrite ?? 0);
    }
  }

  // ===== Google/Gemini =====
  // Cache tokens and thoughts are in providerMetadata.google.usageMetadata
  const google = providerMetadata?.google as GoogleMetadata | undefined;

  if (google?.usageMetadata) {
    if (!isDefined(inputDetails.cacheRead) && isDefined(google.usageMetadata.cachedContentTokenCount)) {
      inputDetails.cacheRead = google.usageMetadata.cachedContentTokenCount;
    }
    // Gemini "thoughts" are similar to reasoning tokens
    if (isDefined(google.usageMetadata.thoughtsTokenCount)) {
      outputDetails.reasoning = google.usageMetadata.thoughtsTokenCount;
    }
  }

  if (isDefined(inputTokens)) {
    inputDetails.text = Math.max(
      0,
      inputTokens - sumDefinedValues(inputDetails, ['cacheRead', 'cacheWrite', 'audio', 'image']),
    );
  }

  if (isDefined(outputTokens)) {
    outputDetails.text = Math.max(0, outputTokens - sumDefinedValues(outputDetails, ['reasoning', 'audio', 'image']));
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

function sumDefinedValues<T extends object, K extends keyof T>(obj: T, keys: K[]): number {
  return keys.reduce((sum, key) => sum + ((obj[key] as number | undefined) ?? 0), 0);
}
