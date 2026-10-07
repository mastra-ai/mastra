import type { ActiveThinkingLevel } from '../thinking.js';

// Extended-thinking budgets for models that predate adaptive thinking/effort.
// Budgets count toward max_tokens, so they stay well below the smallest
// output ceiling of the budget-era models (32k on Opus 4.0/4.1).
export const ANTHROPIC_THINKING_BUDGET_TOKENS: Record<ActiveThinkingLevel, number> = {
  low: 4096,
  medium: 8192,
  high: 16384,
  xhigh: 24576,
  max: 24576,
};

const ANTHROPIC_XHIGH_EFFORT_RE = /claude-(?:opus-4-[78]|opus-5|sonnet-5|fable-5)/;
/** Claude generations that support adaptive thinking + `output_config.effort`. */
const ADAPTIVE_THINKING_RE = /claude-(?:sonnet-4-6|opus-4-[678]|opus-5|sonnet-5|fable-5)/;
/** Older generations that support extended thinking via `budget_tokens`. */
const BUDGET_THINKING_RE = /claude-(?:3-7|sonnet-4|opus-4|haiku-4-5)/;
/** Generations with no extended-thinking support at all. */
const NO_THINKING_RE = /claude-(?:instant|v?2(?:[-.:]|$)|3(?:[-.]|$)|3-5)/;

export function getAnthropicThinkingCapability(modelId: string): 'adaptive' | 'budget' | 'none' {
  if (ADAPTIVE_THINKING_RE.test(modelId)) return 'adaptive';
  if (BUDGET_THINKING_RE.test(modelId)) return 'budget';
  if (NO_THINKING_RE.test(modelId)) return 'none';
  // Unknown (i.e. newer) Claude models: assume the current API surface.
  return 'adaptive';
}

export function supportsAnthropicXhighEffort(modelId: string): boolean {
  return ANTHROPIC_XHIGH_EFFORT_RE.test(modelId);
}
