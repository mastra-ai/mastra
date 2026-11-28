/**
 * Google (Gemini) thinking levels.
 *
 * Maps the Mastra Code session thinking level (`off|low|medium|high|xhigh|max`)
 * onto the thinking control each Gemini family accepts:
 * - Gemini 3+: `thinkingConfig.thinkingLevel` (Gemini 3 Pro only accepts `low|high`).
 * - Gemini 2.5: `thinkingConfig.thinkingBudget` (token budget).
 * Unknown model families get no thinking config, so requests are unchanged.
 */

import type { ActiveThinkingLevel, ThinkingLevelSetting } from './thinking';

type GeminiLevel = 'low' | 'medium' | 'high';
type GeminiThinkingFamily = 'budget' | 'low-high' | 'minimal-high' | 'levels';
export type GoogleThinkingConfig = { thinkingLevel: 'minimal' | GeminiLevel } | { thinkingBudget: number };

// Budgets stay within the smallest Gemini 2.5 maximum (24576 for Flash / Flash-Lite).
const GEMINI_25_BUDGETS: Record<GeminiLevel, number> = { low: 1024, medium: 8192, high: 24576 };

function getGeminiThinkingFamily(modelId: string): GeminiThinkingFamily | undefined {
  const id = modelId.toLowerCase();
  if (id.startsWith('gemini-2.5')) return 'budget';
  // Only Gemini 3 Pro lacks `medium`; Gemini 3.1 Pro accepts it.
  if (id.startsWith('gemini-3-pro')) return 'low-high';
  // Gemini 3.1 Flash Image models only accept `minimal|high`.
  if (id.startsWith('gemini-3.1-flash-image') || id.startsWith('gemini-3.1-flash-lite-image')) return 'minimal-high';
  if (/^gemini-\d/.test(id) && !id.startsWith('gemini-1') && !id.startsWith('gemini-2')) return 'levels';
  return undefined;
}

function geminiLevelForFamily(family: GeminiThinkingFamily, level: ActiveThinkingLevel): GeminiLevel {
  const cappedAtHigh = level === 'xhigh' || level === 'max' ? 'high' : level;
  const hasNoMedium = family === 'low-high' || family === 'minimal-high';
  if (hasNoMedium && cappedAtHigh === 'medium') return 'high';
  return cappedAtHigh;
}

export function runGeminiThinkingLevel(modelId: string, level: ActiveThinkingLevel): ThinkingLevelSetting {
  const family = getGeminiThinkingFamily(modelId);
  return family ? geminiLevelForFamily(family, level) : 'off';
}

/**
 * Resolve the Google thinking config for a model and session level.
 * Returns `undefined` for `off`, unset levels, and unrecognized model families.
 */
export function resolveGoogleThinkingConfig(
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): GoogleThinkingConfig | undefined {
  if (!level || level === 'off') return undefined;
  const family = getGeminiThinkingFamily(modelId);
  if (!family) return undefined;

  const geminiLevel = geminiLevelForFamily(family, level);
  if (family === 'budget') return { thinkingBudget: GEMINI_25_BUDGETS[geminiLevel] };
  if (family === 'minimal-high') return { thinkingLevel: geminiLevel === 'low' ? 'minimal' : 'high' };
  return { thinkingLevel: geminiLevel };
}
