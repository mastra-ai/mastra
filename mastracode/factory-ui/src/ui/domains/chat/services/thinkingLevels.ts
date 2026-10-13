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

export type ThinkingLevelOrigin = 'session' | 'default';

export const DEFAULT_THINKING_SOURCE_LABEL = 'default';

export interface EffectiveThinkingLevel {
  level: ThinkingLevelSetting;
  origin: ThinkingLevelOrigin;
}

function chosenThinkingLevel(
  override: ThinkingLevelSetting | undefined,
  defaultLevel: ThinkingLevelSetting | undefined,
): EffectiveThinkingLevel | undefined {
  if (override) return { level: override, origin: 'session' };
  if (!defaultLevel) return undefined;
  return { level: defaultLevel, origin: 'default' };
}

export function resolveEffectiveThinkingLevel({
  modelId,
  reasoningOptions,
  override,
  defaultLevel,
}: {
  modelId: string | undefined;
  reasoningOptions: readonly ModelReasoningOption[] | undefined;
  override: ThinkingLevelSetting | undefined;
  defaultLevel: ThinkingLevelSetting | undefined;
}): EffectiveThinkingLevel | undefined {
  const chosen = chosenThinkingLevel(override, defaultLevel);
  if (!chosen || !modelId) return chosen;
  return { ...chosen, level: runThinkingLevel(modelId, chosen.level, reasoningOptions) };
}
