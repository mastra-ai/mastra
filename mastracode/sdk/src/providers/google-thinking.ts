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
import type { ThinkingLevelSetting } from '../thinking.js';

type GoogleThinkingConfig = { thinkingLevel: 'low' | 'medium' | 'high' } | { thinkingBudget: number };

// Budgets stay within the smallest Gemini 2.5 maximum (24576 for Flash / Flash-Lite).
const GEMINI_25_BUDGETS = { low: 1024, medium: 8192, high: 24576 } as const;

/**
 * Resolve the Google thinking config for a model and session level.
 * Returns `undefined` for `off`, unset levels, and unrecognized model families.
 */
export function resolveGoogleThinkingConfig(
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): GoogleThinkingConfig | undefined {
  if (!level || level === 'off') return undefined;
  const clamped = level === 'xhigh' || level === 'max' ? 'high' : level;
  const id = modelId.toLowerCase();

  if (id.startsWith('gemini-2.5')) {
    return { thinkingBudget: GEMINI_25_BUDGETS[clamped] };
  }
  if (/^gemini-3(\.\d+)?-pro/.test(id)) {
    return { thinkingLevel: clamped === 'low' ? 'low' : 'high' };
  }
  if (/^gemini-\d/.test(id) && !id.startsWith('gemini-1') && !id.startsWith('gemini-2')) {
    return { thinkingLevel: clamped };
  }
  return undefined;
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
      params.providerOptions = {
        ...params.providerOptions,
        google: { ...google, thinkingConfig: { ...thinkingConfig, ...config } },
      } as typeof params.providerOptions;
      return params;
    },
  };
}
