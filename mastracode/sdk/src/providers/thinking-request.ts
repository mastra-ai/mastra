import type { ModelReasoningOption } from '@mastra/core/llm';
import type { JSONValue } from 'ai';
import type { ThinkingLevelSetting } from '../thinking.js';
import { MASTRA_GATEWAY_PREFIX, stripMastraGatewayPrefix } from './model-ids.js';

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

const sendReasoningEffort = (reasoningEffort: string): ThinkingProviderOptions => ({ reasoningEffort });
const switchReasoning = (enabled: boolean): ThinkingProviderOptions => ({ reasoning: { enabled } });

export const OPENROUTER_OPTIONS_KEY = 'openrouter';

const OPENROUTER_FORMAT: ThinkingRequestFormat = {
  optionsKey: OPENROUTER_OPTIONS_KEY,
  effort: { toOptions: effort => ({ reasoning: { effort } }) },
  toggle: switchReasoning,
};

const REQUEST_FORMATS_BY_PROVIDER: Partial<Record<string, ThinkingRequestFormat>> = {
  deepseek: {
    optionsKey: 'deepseek',
    effort: { acceptedLevels: ['low', 'high', 'max'], toOptions: sendReasoningEffort },
    toggle: enabled => ({ thinking: { type: enabled ? 'enabled' : 'disabled' } }),
  },
  openrouter: OPENROUTER_FORMAT,
  alibaba: { optionsKey: 'alibaba', toggle: enableThinking => ({ enableThinking }) },
  groq: {
    optionsKey: 'groq',
    effort: { acceptedLevels: ['off', 'low', 'medium', 'high'], toOptions: sendReasoningEffort },
  },
  mistral: { optionsKey: 'mistral', effort: { acceptedLevels: ['off', 'high'], toOptions: sendReasoningEffort } },
  xai: {
    optionsKey: 'xai',
    effort: { acceptedLevels: ['off', 'low', 'medium', 'high'], toOptions: sendReasoningEffort },
  },
  togetherai: {
    optionsKey: 'togetherai',
    effort: { acceptedLevels: ['off', 'low', 'medium', 'high'], toOptions: sendReasoningEffort },
    toggle: switchReasoning,
  },
  deepinfra: {
    optionsKey: 'deepinfra',
    effort: { acceptedLevels: ['off', 'low', 'medium', 'high'], toOptions: sendReasoningEffort },
    toggle: switchReasoning,
  },
  cerebras: { optionsKey: 'cerebras', effort: { toOptions: sendReasoningEffort } },
  perplexity: { optionsKey: 'perplexity', effort: { toOptions: effort => ({ reasoning_effort: effort }) } },
};

const THINKING_ADAPTER_PROVIDERS: ReadonlySet<string> = new Set(['anthropic', 'openai', 'google']);

export function isThinkingAdapterProvider(provider: string): boolean {
  return THINKING_ADAPTER_PROVIDERS.has(provider);
}

function requestFormatFor(modelId: string): ThinkingRequestFormat | undefined {
  const routedThroughMastraGateway = modelId.startsWith(MASTRA_GATEWAY_PREFIX);
  const [provider = ''] = stripMastraGatewayPrefix(modelId).split('/');
  if (isThinkingAdapterProvider(provider)) return undefined;
  if (routedThroughMastraGateway) return OPENROUTER_FORMAT;
  return REQUEST_FORMATS_BY_PROVIDER[provider.includes('alibaba') ? 'alibaba' : provider];
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
  const switchableToggle = reasoningOptions.some(option => option.type === 'toggle') ? toggle : undefined;
  if (switchableToggle) optionsByLevel.set('off', switchableToggle(false));
  const sendsNoThinkingLevel = [...optionsByLevel.keys()].every(level => level === 'off');
  if (sendsNoThinkingLevel) optionsByLevel.set(TOGGLE_ON_LEVEL, switchableToggle?.(true));
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
