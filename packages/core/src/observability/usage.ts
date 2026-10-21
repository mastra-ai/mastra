import type { LanguageModelUsage } from '../stream/types';

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
