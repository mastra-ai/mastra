/**
 * Google (Gemini) thinking-level middleware.
 *
 * Maps the Mastra Code session thinking level (`off|low|medium|high|xhigh|max`)
 * onto the thinking control each Gemini family accepts:
 * - Gemini 3+: `thinkingConfig.thinkingLevel` (Gemini 3 Pro only accepts `low|high`).
 * - Gemini 2.5: `thinkingConfig.thinkingBudget` (token budget).
 * Unknown model families get no thinking config, so requests are unchanged.
 */

import type { LanguageModelMiddleware } from 'ai';
import { getGoogleThinkingFamily, resolveThinkingLevelForModel } from '../thinking.js';
import type { ThinkingLevelSetting } from '../thinking.js';

type GoogleThinkingConfig = { thinkingLevel: 'minimal' | 'low' | 'medium' | 'high' } | { thinkingBudget: number };

type GoogleThinkingLevel = 'low' | 'medium' | 'high';

// Budgets stay within the smallest Gemini 2.5 maximum (24576 for Flash / Flash-Lite).
const GEMINI_25_BUDGETS: Record<GoogleThinkingLevel, number> = { low: 1024, medium: 8192, high: 24576 };

function isGoogleThinkingLevel(level: ThinkingLevelSetting): level is GoogleThinkingLevel {
  return level === 'low' || level === 'medium' || level === 'high';
}

/**
 * Resolve the Google thinking config for a model and session level.
 * Returns `undefined` for `off`, unset levels, and unrecognized model families.
 */
export function resolveGoogleThinkingConfig(
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): GoogleThinkingConfig | undefined {
  const family = getGoogleThinkingFamily(modelId);
  if (!level || family === 'none') return undefined;
  const effective = resolveThinkingLevelForModel(modelId, level);
  if (!isGoogleThinkingLevel(effective)) return undefined;
  if (family === 'budget') return { thinkingBudget: GEMINI_25_BUDGETS[effective] };
  if (family === 'minimal-high') return { thinkingLevel: effective === 'low' ? 'minimal' : 'high' };
  return { thinkingLevel: effective };
}

/**
 * Create middleware that injects the resolved config into
 * `providerOptions.google.thinkingConfig`. Returns `undefined` when there is
 * nothing to inject, so callers wrap nothing.
 */
export function createGoogleThinkingMiddleware(
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): LanguageModelMiddleware | undefined {
  const config = resolveGoogleThinkingConfig(modelId, level);
  if (!config) return undefined;

  return {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
      const google = (params.providerOptions?.google ?? {}) as Record<string, unknown>;
      const thinkingConfig = (google.thinkingConfig ?? {}) as Record<string, unknown>;
      // Explicit caller settings win; Google rejects budget and level together.
      if (thinkingConfig.thinkingBudget !== undefined || thinkingConfig.thinkingLevel !== undefined) return params;
      params.providerOptions = {
        ...params.providerOptions,
        google: { ...google, thinkingConfig: { ...thinkingConfig, ...config } },
      } as typeof params.providerOptions;
      return params;
    },
  };
}
