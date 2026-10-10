import {
  getAvailableThinkingLevelsForModel,
  resolveDefaultThinkingLevel,
  runThinkingLevel,
} from '@mastra/code-sdk/thinking';
import type { ThinkingDefaults, ThinkingLevelSetting, ThinkingLevelSource } from '@mastra/code-sdk/thinking';
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

export type ThinkingLevelOrigin = 'session' | ThinkingLevelSource;

export interface EffectiveThinkingLevel {
  level: ThinkingLevelSetting;
  origin: ThinkingLevelOrigin;
}

export function thinkingSourceLabel(source: ThinkingLevelSource, modeId: string | undefined): string {
  return source === 'mode-default' && modeId ? `${modeId} mode default` : 'global default';
}

function chosenThinkingLevel(
  override: ThinkingLevelSetting | undefined,
  defaults: ThinkingDefaults | undefined,
  modeId: string | undefined,
): EffectiveThinkingLevel | undefined {
  if (override) return { level: override, origin: 'session' };
  if (!defaults) return undefined;
  const { level, source } = resolveDefaultThinkingLevel(defaults, modeId);
  return { level, origin: source };
}

export function resolveEffectiveThinkingLevel({
  modelId,
  reasoningOptions,
  override,
  defaults,
  modeId,
}: {
  modelId: string | undefined;
  reasoningOptions: readonly ModelReasoningOption[] | undefined;
  override: ThinkingLevelSetting | undefined;
  defaults: ThinkingDefaults | undefined;
  modeId: string | undefined;
}): EffectiveThinkingLevel | undefined {
  const chosen = chosenThinkingLevel(override, defaults, modeId);
  if (!chosen || !modelId) return chosen;
  return { ...chosen, level: runThinkingLevel(modelId, chosen.level, reasoningOptions) };
}
