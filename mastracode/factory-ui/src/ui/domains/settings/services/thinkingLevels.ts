import { getAvailableThinkingLevelsForModel } from '@mastra/code-sdk/thinking';
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
