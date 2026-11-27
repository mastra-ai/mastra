import { THINKING_LEVEL_VALUES } from './model-packs';
import type { ThinkingLevelSetting } from './model-packs';

import type { ThinkingLevelOption } from '@/ds/components/ThinkingLevel';

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

export function thinkingLevelOptions(
  levels: readonly ThinkingLevelSetting[],
): ThinkingLevelOption<ThinkingLevelSetting>[] {
  return levels.map(level => ({
    value: level,
    label: THINKING_LEVEL_LABELS[level],
    emphasis: THINKING_LEVEL_EMPHASIS[level],
  }));
}

export const ALL_THINKING_LEVEL_OPTIONS = thinkingLevelOptions(THINKING_LEVEL_VALUES);
