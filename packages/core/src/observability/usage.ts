import type { LanguageModelUsage, ProviderMetadata } from '../stream/types';
import type { InputTokenDetails, OutputTokenDetails, UsageStats } from './types';

const usageCountKeys = [
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'reasoningTokens',
  'cachedInputTokens',
  'cacheCreationInputTokens',
  'cacheCreationInputTokens5m',
  'cacheCreationInputTokens1h',
] as const;

export function isUsageIncomplete(usage: LanguageModelUsage | undefined): boolean {
  return usage?.inputTokens === undefined || usage.outputTokens === undefined || usage.totalTokens === undefined;
}

/**
 * Usage left after removing what earlier generations of the same run already reported.
 * A resumed run reports cumulative usage, but its suspended legs already recorded part of it.
 */
export function subtractReportedUsage(
  usage: LanguageModelUsage | undefined,
  reported: LanguageModelUsage | undefined,
): LanguageModelUsage | undefined {
  if (!usage || !reported) return usage;
  const remaining: LanguageModelUsage = { ...usage };
  for (const key of usageCountKeys) {
    const value = usage[key];
    if (value !== undefined) {
      remaining[key] = Math.max(0, value - (reported[key] ?? 0));
    }
  }
  return remaining;
}

export function calculateObservedUsage(steps: Array<{ usage?: LanguageModelUsage | undefined }>): LanguageModelUsage {
  const usage: LanguageModelUsage = {
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
  };

  for (const step of steps) {
    for (const key of usageCountKeys) {
      const value = step.usage?.[key];
      if (value !== undefined) {
        usage[key] = (usage[key] ?? 0) + value;
      }
    }
  }

  if (usage.inputTokens !== undefined && usage.outputTokens !== undefined) {
    usage.totalTokens = usage.inputTokens + usage.outputTokens;
  }

  return usage;
}

/**
 * Provider-specific metadata shapes for type-safe access.
 * These match the actual shapes from AI SDK providers.
 */
interface AnthropicCacheCreation {
  ephemeral_5m_input_tokens?: number;
  ephemeral_1h_input_tokens?: number;
  ephemeral5mInputTokens?: number;
  ephemeral1hInputTokens?: number;
}

interface AnthropicMetadata {
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheCreation?: AnthropicCacheCreation;
  /** Raw API usage object; @ai-sdk/anthropic passes the TTL split through here, not as `cacheCreation`. */
  usage?: { cache_creation?: AnthropicCacheCreation };
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
 * Kept in sync with `observability/mastra/src/usage.ts` (duplicated so exporters do not need a newer core).
 * Change both copies together; the parity test in @mastra/observability fails if they drift.
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
  if (isDefined(usage.cacheCreationInputTokens5m)) {
    inputDetails.cacheWrite5m = usage.cacheCreationInputTokens5m;
  }
  if (isDefined(usage.cacheCreationInputTokens1h)) {
    inputDetails.cacheWrite1h = usage.cacheCreationInputTokens1h;
  }
  if (!isDefined(inputDetails.cacheWrite) && isDefined(usage.cacheCreationInputTokens)) {
    inputDetails.cacheWrite = usage.cacheCreationInputTokens;
  }
  // Anthropic cache-creation TTL split. @ai-sdk/anthropic never sets `cacheCreation`; the split
  // arrives raw as `cache_creation` on providerMetadata.anthropic.usage and on usage.raw.
  const anthropic = providerMetadata?.anthropic as AnthropicMetadata | undefined;
  const cacheCreation =
    anthropic?.cacheCreation ??
    anthropic?.usage?.cache_creation ??
    (usage.raw as { cache_creation?: AnthropicCacheCreation } | undefined)?.cache_creation;
  const cacheWrite5m = cacheCreation?.ephemeral_5m_input_tokens ?? cacheCreation?.ephemeral5mInputTokens;
  const cacheWrite1h = cacheCreation?.ephemeral_1h_input_tokens ?? cacheCreation?.ephemeral1hInputTokens;
  if (!isDefined(inputDetails.cacheWrite5m) && isDefined(cacheWrite5m)) {
    inputDetails.cacheWrite5m = cacheWrite5m;
  }
  if (!isDefined(inputDetails.cacheWrite1h) && isDefined(cacheWrite1h)) {
    inputDetails.cacheWrite1h = cacheWrite1h;
  }
  if (
    !isDefined(inputDetails.cacheWrite) &&
    (isDefined(inputDetails.cacheWrite5m) || isDefined(inputDetails.cacheWrite1h))
  ) {
    inputDetails.cacheWrite = (inputDetails.cacheWrite5m ?? 0) + (inputDetails.cacheWrite1h ?? 0);
  }

  // reasoningTokens from usage (OpenAI o1 models)
  if (isDefined(usage.reasoningTokens)) {
    outputDetails.reasoning = usage.reasoningTokens;
  }

  // ===== Anthropic =====
  // inputTokens does NOT include cache tokens - need to sum them
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
