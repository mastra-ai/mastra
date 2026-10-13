import { getAvailableThinkingLevelsForModel, runThinkingLevel } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ModelReasoningOption } from '@mastra/core/llm';
import type { ThinkingLevelOption } from '@mastra/playground-ui/components/ThinkingLevel';

export const THINKING_LEVEL_LABELS: Record<ThinkingLevelSetting, string> = {
  off: 'Off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
};

const THINKING_LEVEL_EMPHASIS: Partial<Record<ThinkingLevelSetting, ThinkingLevelOption['emphasis']>> = {
  off: 'muted',
  xhigh: 'warning',
  max: 'warning',
};

export function thinkingLevelOptionsForModel(
  modelId: string,
  reasoningOptions: readonly ModelReasoningOption[] | undefined,
): ThinkingLevelOption<ThinkingLevelSetting>[] {
  return getAvailableThinkingLevelsForModel(modelId, reasoningOptions).map(level => ({
    value: level,
    label: THINKING_LEVEL_LABELS[level],
    emphasis: THINKING_LEVEL_EMPHASIS[level],
  }));
}

export type ThinkingLevelOrigin = 'session' | 'global';

export interface EffectiveThinkingLevel {
  level: ThinkingLevelSetting;
  origin: ThinkingLevelOrigin;
}

function chosenThinkingLevel(
  override: ThinkingLevelSetting | undefined,
  globalDefault: ThinkingLevelSetting | undefined,
): EffectiveThinkingLevel | undefined {
  if (override) return { level: override, origin: 'session' };
  if (!globalDefault) return undefined;
  return { level: globalDefault, origin: 'global' };
}

export function resolveEffectiveThinkingLevel({
  modelId,
  reasoningOptions,
  override,
  globalDefault,
}: {
  modelId: string | undefined;
  reasoningOptions: readonly ModelReasoningOption[] | undefined;
  override: ThinkingLevelSetting | undefined;
  globalDefault: ThinkingLevelSetting | undefined;
}): EffectiveThinkingLevel | undefined {
  const chosen = chosenThinkingLevel(override, globalDefault);
  if (!chosen || !modelId) return chosen;
  return { ...chosen, level: runThinkingLevel(modelId, chosen.level, reasoningOptions) };
}
