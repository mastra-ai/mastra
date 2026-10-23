import { THINKING_LEVEL_VALUES, getAvailableThinkingLevelsForModel, runThinkingLevel } from '@mastra/code-sdk/thinking';
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

function thinkingLevelOptions(levels: readonly ThinkingLevelSetting[]): ThinkingLevelOption<ThinkingLevelSetting>[] {
  return levels.map(level => ({
    value: level,
    label: THINKING_LEVEL_LABELS[level],
    emphasis: THINKING_LEVEL_EMPHASIS[level],
  }));
}

export const ALL_THINKING_LEVEL_OPTIONS = thinkingLevelOptions(THINKING_LEVEL_VALUES);

export function thinkingLevelOptionsForModel(
  modelId: string,
  reasoningOptions: readonly ModelReasoningOption[] | undefined,
): ThinkingLevelOption<ThinkingLevelSetting>[] {
  return thinkingLevelOptions(getAvailableThinkingLevelsForModel(modelId, reasoningOptions));
}

export type ThinkingLevelOrigin = 'session' | 'factory';

export const FACTORY_THINKING_SOURCE_LABEL = 'Factory default';

export interface EffectiveThinkingLevel {
  level: ThinkingLevelSetting;
  origin: ThinkingLevelOrigin;
}

function chosenThinkingLevel(
  override: ThinkingLevelSetting | undefined,
  factoryDefault: ThinkingLevelSetting | undefined,
): EffectiveThinkingLevel | undefined {
  if (override) return { level: override, origin: 'session' };
  if (!factoryDefault) return undefined;
  return { level: factoryDefault, origin: 'factory' };
}

export function resolveEffectiveThinkingLevel({
  modelId,
  reasoningOptions,
  override,
  factoryDefault,
}: {
  modelId: string | undefined;
  reasoningOptions: readonly ModelReasoningOption[] | undefined;
  override: ThinkingLevelSetting | undefined;
  factoryDefault: ThinkingLevelSetting | undefined;
}): EffectiveThinkingLevel | undefined {
  const chosen = chosenThinkingLevel(override, factoryDefault);
  if (!chosen || !modelId) return chosen;
  return { ...chosen, level: runThinkingLevel(modelId, chosen.level, reasoningOptions) };
}
