import type { ThinkingLevelOption } from './use-thinking-level-stop';

export type Level = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const ALL_LEVELS: ThinkingLevelOption<Level>[] = [
  { value: 'off', label: 'Off', emphasis: 'muted' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high', emphasis: 'warning' },
  { value: 'max', label: 'Max', emphasis: 'warning' },
];

export const LOW_HIGH_LEVELS = ALL_LEVELS.filter(level => ['off', 'low', 'high'].includes(level.value));
export const UP_TO_HIGH_LEVELS = ALL_LEVELS.filter(level => level.emphasis !== 'warning');
export const SONNET_LEVELS = ALL_LEVELS.filter(level => level.value !== 'xhigh');

export const DESCRIPTION = 'More thinking answers harder problems, slower and at a higher cost.';
