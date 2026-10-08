import type { ModelReasoningOption } from '@mastra/core/llm';
import type { JSONValue } from 'ai';
import type { ThinkingLevelSetting } from '../thinking.js';
import { MASTRA_GATEWAY_PREFIX } from './model-ids.js';

export type ThinkingProviderOptions = Record<string, JSONValue>;

export interface ThinkingRequest {
  optionsKey: string;
  optionsByLevel: ReadonlyMap<ThinkingLevelSetting, ThinkingProviderOptions>;
}

interface EffortRequestShape {
  acceptedLevels?: readonly ThinkingLevelSetting[];
  options: (effort: string) => ThinkingProviderOptions;
}

interface ThinkingRequestShape {
  optionsKey: string;
  effort?: EffortRequestShape;
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

const REQUEST_SHAPES_BY_PROVIDER: Partial<Record<string, ThinkingRequestShape>> = {
  deepseek: {
    optionsKey: 'deepseek',
    effort: {
      acceptedLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
      options: reasoningEffort => ({ reasoningEffort }),
    },
    toggle: enabled => ({ thinking: { type: enabled ? 'enabled' : 'disabled' } }),
  },
};

function requestShapeFor(modelId: string): ThinkingRequestShape | undefined {
  if (modelId.startsWith(MASTRA_GATEWAY_PREFIX)) return undefined;
  const [provider = ''] = modelId.split('/');
  return REQUEST_SHAPES_BY_PROVIDER[provider];
}

function acceptedLevelFor(effort: EffortRequestShape, value: string): ThinkingLevelSetting | undefined {
  const level = LEVEL_FOR_EFFORT[value];
  if (!level) return undefined;
  return (effort.acceptedLevels?.includes(level) ?? true) ? level : undefined;
}

function optionsByLevelFor(
  { effort, toggle }: ThinkingRequestShape,
  reasoningOptions: readonly ModelReasoningOption[],
): Map<ThinkingLevelSetting, ThinkingProviderOptions> {
  const optionsByLevel = new Map<ThinkingLevelSetting, ThinkingProviderOptions>();
  if (effort) {
    for (const value of reasoningOptions.flatMap(option => (option.type === 'effort' ? option.values : []))) {
      const level = acceptedLevelFor(effort, value);
      if (level) optionsByLevel.set(level, effort.options(value));
    }
  }
  if (toggle && reasoningOptions.some(option => option.type === 'toggle')) optionsByLevel.set('off', toggle(false));
  const onlyTurnsOff = optionsByLevel.size === 1 && optionsByLevel.has('off');
  if (onlyTurnsOff) optionsByLevel.set(TOGGLE_ON_LEVEL, toggle?.(true) ?? {});
  return optionsByLevel;
}

export function thinkingRequestFor(
  modelId: string,
  reasoningOptions: readonly ModelReasoningOption[] | undefined,
): ThinkingRequest | undefined {
  const shape = requestShapeFor(modelId);
  if (!shape || !reasoningOptions) return undefined;
  const optionsByLevel = optionsByLevelFor(shape, reasoningOptions);
  if (optionsByLevel.size === 0) return undefined;
  return { optionsKey: shape.optionsKey, optionsByLevel };
}
