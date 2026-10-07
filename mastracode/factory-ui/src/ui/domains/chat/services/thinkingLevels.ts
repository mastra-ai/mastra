import {
  getAvailableThinkingLevelsForModel,
  resolveDefaultThinkingLevel,
  runThinkingLevel,
} from '@mastra/code-sdk/thinking';
import type { ThinkingDefaults, ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
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

export function thinkingLevelOptionsForModel(modelId: string): ThinkingLevelOption<ThinkingLevelSetting>[] {
  return getAvailableThinkingLevelsForModel(modelId).map(level => ({
    value: level,
    label: THINKING_LEVEL_LABELS[level],
    emphasis: THINKING_LEVEL_EMPHASIS[level],
  }));
}

function defaultThinkingLevelForMode(defaults: ThinkingDefaults | undefined, modeId: string | undefined) {
  if (!defaults) return undefined;
  return resolveDefaultThinkingLevel(defaults, modeId).level;
}

export function resolveEffectiveThinkingLevel({
  modelId,
  override,
  defaults,
  modeId,
}: {
  modelId: string | undefined;
  override: ThinkingLevelSetting | undefined;
  defaults: ThinkingDefaults | undefined;
  modeId: string | undefined;
}): ThinkingLevelSetting | undefined {
  const level = override ?? defaultThinkingLevelForMode(defaults, modeId);
  if (!level || !modelId) return level;
  return runThinkingLevel(modelId, level);
}

