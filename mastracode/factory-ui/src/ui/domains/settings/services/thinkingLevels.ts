import { getAvailableThinkingLevelsForModel, THINKING_LEVEL_VALUES } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelOption } from '@mastra/playground-ui/components/ThinkingLevel';

export const THINKING_LEVEL_OPTIONS: ThinkingLevelOption<ThinkingLevelSetting>[] = [
  { value: 'off', label: 'Off', emphasis: 'muted' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high', emphasis: 'warning' },
  { value: 'max', label: 'Max', emphasis: 'warning' },
];

export function thinkingLevelOptionsForModel(modelId: string): ThinkingLevelOption<ThinkingLevelSetting>[] {
  const available = getAvailableThinkingLevelsForModel(modelId);
  return THINKING_LEVEL_OPTIONS.filter(option => available.includes(option.value));
}

export function clampThinkingLevel(modelId: string, level: ThinkingLevelSetting): ThinkingLevelSetting {
  const available = getAvailableThinkingLevelsForModel(modelId);
  const levelsUpToRequested = THINKING_LEVEL_VALUES.slice(0, THINKING_LEVEL_VALUES.indexOf(level) + 1);
  return levelsUpToRequested.filter(candidate => available.includes(candidate)).at(-1) ?? 'off';
}
