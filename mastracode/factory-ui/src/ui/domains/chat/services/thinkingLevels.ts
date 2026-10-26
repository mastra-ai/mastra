import { THINKING_LEVEL_VALUES, getAvailableThinkingLevelsForModel, runThinkingLevel } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ModelReasoningOption } from '@mastra/core/llm';
import { DEFAULT_THINKING_LEVEL } from '@mastra/factory/default-thinking-level';
import type { ThinkingLevelOption } from '@mastra/playground-ui/components/ThinkingLevel';

import type { FactoryModelScope } from '../../workspaces/services/github';

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

export type ThinkingDefaultOrigin = 'personal' | 'factory' | 'built-in';
export type ThinkingLevelOrigin = 'session' | ThinkingDefaultOrigin;

export const THINKING_DEFAULT_SOURCE_LABELS: Record<ThinkingDefaultOrigin, string> = {
  personal: 'Personal default',
  factory: 'Factory default',
  'built-in': 'Built-in default',
};

export interface ThinkingDefault {
  level: ThinkingLevelSetting;
  origin: ThinkingDefaultOrigin;
}

export interface EffectiveThinkingLevel {
  level: ThinkingLevelSetting;
  origin: ThinkingLevelOrigin;
}

/** Undefined while loading; null when unset. */
export type PersonalThinkingDefault = ThinkingLevelSetting | null | undefined;

export function personalThinkingDefault(personal: ThinkingLevelSetting | null): ThinkingDefault {
  return personal ? { level: personal, origin: 'personal' } : { level: DEFAULT_THINKING_LEVEL, origin: 'built-in' };
}

export function routedThinkingDefault(
  modelScope: FactoryModelScope | undefined,
  personal: PersonalThinkingDefault,
  factory: ThinkingLevelSetting | undefined,
): ThinkingDefault | undefined {
  if (modelScope === 'factory') return factory ? { level: factory, origin: 'factory' } : undefined;
  if (modelScope === undefined || personal === undefined) return undefined;
  return personalThinkingDefault(personal);
}

export function resolveEffectiveThinkingLevel({
  modelId,
  reasoningOptions,
  override,
  thinkingDefault,
}: {
  modelId: string | undefined;
  reasoningOptions: readonly ModelReasoningOption[] | undefined;
  override: ThinkingLevelSetting | undefined;
  thinkingDefault: ThinkingDefault | undefined;
}): EffectiveThinkingLevel | undefined {
  const chosen: EffectiveThinkingLevel | undefined = override
    ? { level: override, origin: 'session' }
    : thinkingDefault;
  if (!chosen || !modelId) return chosen;
  return { ...chosen, level: runThinkingLevel(modelId, chosen.level, reasoningOptions) };
}
