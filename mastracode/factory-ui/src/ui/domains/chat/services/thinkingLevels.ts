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

export type ThinkingDefaultOrigin = 'personal' | 'factory';
export type ThinkingLevelOrigin = 'session' | ThinkingDefaultOrigin;

export const THINKING_DEFAULT_SOURCE_LABELS: Record<ThinkingDefaultOrigin, string> = {
  personal: 'Personal default',
  factory: 'Factory default',
};

export interface ThinkingDefault {
  level: ThinkingLevelSetting;
  origin: ThinkingDefaultOrigin;
}

export interface EffectiveThinkingLevel {
  level: ThinkingLevelSetting;
  origin: ThinkingLevelOrigin;
}

/** Undefined while loading; null when it follows the Factory. */
export type PersonalThinkingDefault = ThinkingLevelSetting | null | undefined;

export function routedThinkingDefault(
  personal: PersonalThinkingDefault,
  factory: ThinkingLevelSetting | undefined,
): ThinkingDefault | undefined {
  if (personal) return { level: personal, origin: 'personal' };
  if (personal === undefined || !factory) return undefined;
  return { level: factory, origin: 'factory' };
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
