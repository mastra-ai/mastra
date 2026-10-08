import type { ModelReasoningOption } from '@mastra/core/llm';
import type { JSONValue } from 'ai';
import type { ThinkingLevelSetting } from '../thinking.js';
import { MASTRA_GATEWAY_PREFIX } from './model-ids.js';

export type ThinkingProviderOptions = Record<string, JSONValue>;

export interface ThinkingRequest {
  optionsKey: string;
  optionsByLevel: ReadonlyMap<ThinkingLevelSetting, ThinkingProviderOptions | undefined>;
}

interface EffortFormat {
  acceptedLevels?: readonly ThinkingLevelSetting[];
  toOptions: (effort: string) => ThinkingProviderOptions;
}

interface ThinkingRequestFormat {
  optionsKey: string;
  effort?: EffortFormat;
  toggle?: (enabled: boolean) => ThinkingProviderOptions;
}

export const TOGGLE_ON_LEVEL: ThinkingLevelSetting = 'high';

const LEVEL_FOR_EFFORT: Partial<Record<string, ThinkingLevelSetting>> = {
  none: 'off',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
};

const REQUEST_FORMATS_BY_PROVIDER: Partial<Record<string, ThinkingRequestFormat>> = {
  deepseek: {
    optionsKey: 'deepseek',
    effort: {
      acceptedLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
      toOptions: reasoningEffort => ({ reasoningEffort }),
    },
    toggle: enabled => ({ thinking: { type: enabled ? 'enabled' : 'disabled' } }),
  },
};

function requestFormatFor(modelId: string): ThinkingRequestFormat | undefined {
  if (modelId.startsWith(MASTRA_GATEWAY_PREFIX)) return undefined;
  const [provider = ''] = modelId.split('/');
  return REQUEST_FORMATS_BY_PROVIDER[provider];
}

function acceptedLevelFor(effort: EffortFormat, value: string): ThinkingLevelSetting | undefined {
  const level = LEVEL_FOR_EFFORT[value];
  const rejectedByPackage = level && effort.acceptedLevels && !effort.acceptedLevels.includes(level);
  return rejectedByPackage ? undefined : level;
}

function optionsByLevelFor(
  { effort, toggle }: ThinkingRequestFormat,
  reasoningOptions: readonly ModelReasoningOption[],
): Map<ThinkingLevelSetting, ThinkingProviderOptions | undefined> {
  const optionsByLevel = new Map<ThinkingLevelSetting, ThinkingProviderOptions | undefined>();
  if (effort) {
    for (const value of reasoningOptions.flatMap(option => (option.type === 'effort' ? option.values : []))) {
      const level = acceptedLevelFor(effort, value);
      if (level) optionsByLevel.set(level, effort.toOptions(value));
    }
  }
  if (toggle && reasoningOptions.some(option => option.type === 'toggle')) optionsByLevel.set('off', toggle(false));
  const sendsNoThinkingLevel = [...optionsByLevel.keys()].every(level => level === 'off');
  if (sendsNoThinkingLevel) optionsByLevel.set(TOGGLE_ON_LEVEL, toggle?.(true));
  return optionsByLevel;
}

export function thinkingRequestFor(
  modelId: string,
  reasoningOptions: readonly ModelReasoningOption[] | undefined,
): ThinkingRequest | undefined {
  const format = requestFormatFor(modelId);
  if (!format || !reasoningOptions?.length) return undefined;
  return { optionsKey: format.optionsKey, optionsByLevel: optionsByLevelFor(format, reasoningOptions) };
}
