import type { ActiveThinkingLevel } from '../thinking.js';

// counts toward max_tokens: stay under the 32k output cap of Opus 4.0/4.1
export const ANTHROPIC_THINKING_BUDGET_TOKENS: Record<ActiveThinkingLevel, number> = {
  low: 4096,
  medium: 8192,
  high: 16384,
  xhigh: 24576,
  max: 24576,
};

const ANTHROPIC_XHIGH_EFFORT_RE = /claude-(?:opus-4-[78]|opus-5|sonnet-5|fable-5)/;
const ADAPTIVE_THINKING_RE = /claude-(?:sonnet-4-6|opus-4-[678]|opus-5|sonnet-5|fable-5)/;
const BUDGET_THINKING_RE = /claude-(?:3-7|sonnet-4|opus-4|haiku-4-5)/;
const NO_THINKING_RE = /claude-(?:instant|v?2(?:[-.:]|$)|3(?:[-.]|$)|3-5)/;

export function getAnthropicThinkingCapability(modelId: string): 'adaptive' | 'budget' | 'none' {
  if (ADAPTIVE_THINKING_RE.test(modelId)) return 'adaptive';
  if (BUDGET_THINKING_RE.test(modelId)) return 'budget';
  if (NO_THINKING_RE.test(modelId)) return 'none';
  return 'adaptive';
}

export function supportsAnthropicXhighEffort(modelId: string): boolean {
  return ANTHROPIC_XHIGH_EFFORT_RE.test(modelId);
}
