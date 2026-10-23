/**
 * Usage extraction utilities for converting AI SDK usage to Mastra UsageStats
 */

import { extractUsageMetrics } from '@mastra/core/observability';
import type { InputTokenDetails, OutputTokenDetails, UsageStats } from '@mastra/core/observability';
import type { ProviderMetadata } from '@mastra/core/stream';

export { extractUsageMetrics };

export interface OpenRouterCostResult {
  total: number;
  usedCost: boolean;
  usedUpstreamCost: boolean;
}

/**
 * For non-BYOK requests, `usage.cost` is the complete OpenRouter charge and
 * `usage.costDetails.upstreamInferenceCost` is only its upstream breakdown. For BYOK requests,
 * the upstream cost is billed separately and must be added to OpenRouter's own `usage.cost`.
 *
 * OpenRouter reports `usage.is_byok` on the wire, but published `@openrouter/ai-sdk-provider`
 * versions drop it from `providerMetadata.openrouter.usage`. When `isByok` is present it is
 * authoritative. When it is absent, only the unambiguous shapes are used: a non-BYOK response
 * reports an upstream cost that is absent, zero, or equal to `cost`, and a BYOK response reports
 * a zero `cost` with a positive upstream cost. Any other combination falls back to model price
 * inference rather than double-counting a non-BYOK charge or under-reporting a BYOK one.
 */
export function extractOpenRouterCost(providerMetadata?: ProviderMetadata): OpenRouterCostResult | undefined {
  const usage = providerMetadata?.openrouter?.usage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return undefined;

  const cost = usage.cost;
  const isByok = usage.isByok;
  const costDetails = usage.costDetails;
  const upstreamCost =
    costDetails && typeof costDetails === 'object' && !Array.isArray(costDetails)
      ? costDetails.upstreamInferenceCost
      : undefined;

  const isValid = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

  if ((cost != null && !isValid(cost)) || (upstreamCost != null && !isValid(upstreamCost))) return undefined;
  const validCost = isValid(cost) ? cost : undefined;
  const validUpstreamCost = isValid(upstreamCost) ? upstreamCost : undefined;

  const byok = typeof isByok === 'boolean' ? isByok : inferByok(validCost, validUpstreamCost);
  if (byok === undefined) return undefined;

  if (!byok) {
    if (validCost === undefined) return undefined;
    return { total: validCost, usedCost: true, usedUpstreamCost: false };
  }

  if (validCost === undefined && validUpstreamCost === undefined) return undefined;
  const total = (validCost ?? 0) + (validUpstreamCost ?? 0);
  if (!Number.isFinite(total)) return undefined;

  return {
    total,
    usedCost: validCost !== undefined,
    usedUpstreamCost: validUpstreamCost !== undefined,
  };
}

/**
 * Infer the BYOK mode from the cost fields alone. Returns `undefined` when the shape is
 * ambiguous, so the caller falls back to model price inference.
 */
function inferByok(cost: number | undefined, upstreamCost: number | undefined): boolean | undefined {
  if (cost === undefined) return undefined;
  // Non-BYOK: the upstream breakdown is absent, zero, or a copy of the total charge.
  if (upstreamCost === undefined || upstreamCost === 0 || upstreamCost === cost) return false;
  // BYOK inside the free allowance: OpenRouter charges nothing and the upstream key pays.
  if (cost === 0) return true;
  // A positive OpenRouter surcharge next to a different positive upstream charge could be
  // either a BYOK surcharge (sum) or a non-BYOK breakdown (do not sum).
  return undefined;
}

function addOptional(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return (a ?? 0) + (b ?? 0);
}

function mergeInputDetails(
  a: InputTokenDetails | undefined,
  b: InputTokenDetails | undefined,
): InputTokenDetails | undefined {
  if (!a) return b ? { ...b } : undefined;
  if (!b) return { ...a };
  return {
    text: addOptional(a.text, b.text),
    cacheRead: addOptional(a.cacheRead, b.cacheRead),
    cacheWrite: addOptional(a.cacheWrite, b.cacheWrite),
    cacheWrite5m: addOptional(a.cacheWrite5m, b.cacheWrite5m),
    cacheWrite1h: addOptional(a.cacheWrite1h, b.cacheWrite1h),
    audio: addOptional(a.audio, b.audio),
    image: addOptional(a.image, b.image),
  };
}

function mergeOutputDetails(
  a: OutputTokenDetails | undefined,
  b: OutputTokenDetails | undefined,
): OutputTokenDetails | undefined {
  if (!a) return b ? { ...b } : undefined;
  if (!b) return { ...a };
  return {
    text: addOptional(a.text, b.text),
    reasoning: addOptional(a.reasoning, b.reasoning),
    audio: addOptional(a.audio, b.audio),
    image: addOptional(a.image, b.image),
  };
}

/**
 * Sum two UsageStats into a new one. Treats undefined fields as zero when
 * the other side has a value, and preserves undefined when both are absent.
 * Used to roll up internal model-generation usage onto a visible ancestor
 * span so cost / token attribution survives internal-span filtering.
 */
export function addUsageStats(a: UsageStats | undefined, b: UsageStats): UsageStats {
  if (!a) {
    return {
      ...b,
      inputDetails: b.inputDetails ? { ...b.inputDetails } : undefined,
      outputDetails: b.outputDetails ? { ...b.outputDetails } : undefined,
    };
  }
  return {
    inputTokens: addOptional(a.inputTokens, b.inputTokens),
    outputTokens: addOptional(a.outputTokens, b.outputTokens),
    inputDetails: mergeInputDetails(a.inputDetails, b.inputDetails),
    outputDetails: mergeOutputDetails(a.outputDetails, b.outputDetails),
  };
}
