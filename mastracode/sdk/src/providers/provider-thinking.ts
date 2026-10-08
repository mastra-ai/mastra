import { getModelReasoningOptions } from '@mastra/core/llm';
import type { ModelReasoningOption } from '@mastra/core/llm';
import type { JSONValue, LanguageModelMiddleware } from 'ai';
import { runThinkingLevel, THINKING_LEVEL_VALUES } from '../thinking.js';
import type { ThinkingLevelSetting } from '../thinking.js';

type ThinkingProviderOptions = Record<string, JSONValue>;
type ReasoningOptions = readonly ModelReasoningOption[] | undefined;

interface ModelThinking {
  runLevel: ThinkingLevelSetting;
  reasoningOptions: ReasoningOptions;
}

type ThinkingOptionsFor = (thinking: ModelThinking) => ThinkingProviderOptions | undefined;

function listedEfforts(reasoningOptions: ReasoningOptions): string[] {
  return reasoningOptions?.flatMap(option => (option.type === 'effort' ? option.values : [])) ?? [];
}

function listsToggle(reasoningOptions: ReasoningOptions): boolean {
  return reasoningOptions?.some(option => option.type === 'toggle') ?? false;
}

function effortAtOrBelow(
  runLevel: ThinkingLevelSetting,
  reasoningOptions: ReasoningOptions,
  acceptedEfforts: readonly string[] | undefined,
): string | undefined {
  const listed = listedEfforts(reasoningOptions);
  const sendable = THINKING_LEVEL_VALUES.filter(
    level => level !== 'off' && listed.includes(level) && (!acceptedEfforts || acceptedEfforts.includes(level)),
  );
  const runRank = THINKING_LEVEL_VALUES.indexOf(runLevel);
  return sendable.filter(level => THINKING_LEVEL_VALUES.indexOf(level) <= runRank).at(-1) ?? sendable[0];
}

function reasoningEffortOptions({
  field = 'reasoningEffort',
  acceptedEfforts,
}: { field?: string; acceptedEfforts?: readonly string[] } = {}): ThinkingOptionsFor {
  return ({ runLevel, reasoningOptions }) => {
    if (runLevel === 'off') {
      return listedEfforts(reasoningOptions).includes('none') ? { [field]: 'none' } : undefined;
    }
    const effort = effortAtOrBelow(runLevel, reasoningOptions, acceptedEfforts);
    return effort ? { [field]: effort } : undefined;
  };
}

function deepSeekThinkingOptions({ runLevel }: ModelThinking): ThinkingProviderOptions {
  if (runLevel === 'off') return { thinking: { type: 'disabled' } };
  return { reasoningEffort: runLevel };
}

function openRouterThinkingOptions({ runLevel, reasoningOptions }: ModelThinking): ThinkingProviderOptions | undefined {
  if (runLevel === 'off') {
    const canTurnOff = listsToggle(reasoningOptions) || listedEfforts(reasoningOptions).includes('none');
    return canTurnOff ? { reasoning: { enabled: false } } : undefined;
  }
  const effort = effortAtOrBelow(runLevel, reasoningOptions, undefined);
  if (effort) return { reasoning: { effort } };
  return listsToggle(reasoningOptions) ? { reasoning: { enabled: true } } : undefined;
}

function alibabaThinkingOptions({ runLevel, reasoningOptions }: ModelThinking): ThinkingProviderOptions | undefined {
  if (!listsToggle(reasoningOptions)) return undefined;
  return { enableThinking: runLevel !== 'off' };
}

const THINKING_OPTIONS_BY_PROVIDER: Record<string, ThinkingOptionsFor> = {
  deepseek: deepSeekThinkingOptions,
  openrouter: openRouterThinkingOptions,
  alibaba: alibabaThinkingOptions,
  groq: reasoningEffortOptions({ acceptedEfforts: ['low', 'medium', 'high'] }),
  mistral: reasoningEffortOptions({ acceptedEfforts: ['high'] }),
  xai: reasoningEffortOptions({ acceptedEfforts: ['low', 'medium', 'high'] }),
  togetherai: reasoningEffortOptions(),
  deepinfra: reasoningEffortOptions(),
  cerebras: reasoningEffortOptions(),
  perplexity: reasoningEffortOptions({ field: 'reasoning_effort' }),
};

function optionsProviderFor(providerId: string): string {
  return providerId.includes('alibaba') ? 'alibaba' : providerId;
}

export function createProviderThinkingMiddleware({
  optionsProvider,
  catalogModelId,
  level,
}: {
  optionsProvider: string;
  catalogModelId: string;
  level: ThinkingLevelSetting | undefined;
}): LanguageModelMiddleware | undefined {
  const optionsKey = optionsProviderFor(optionsProvider);
  const thinkingOptionsFor = THINKING_OPTIONS_BY_PROVIDER[optionsKey];
  if (!thinkingOptionsFor || !level) return undefined;
  const reasoningOptions = getModelReasoningOptions(catalogModelId);
  const thinkingOptions = thinkingOptionsFor({
    runLevel: runThinkingLevel(catalogModelId, level, reasoningOptions),
    reasoningOptions,
  });
  if (!thinkingOptions) return undefined;

  return {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
      params.providerOptions = {
        ...params.providerOptions,
        [optionsKey]: { ...thinkingOptions, ...params.providerOptions?.[optionsKey] },
      };
      return params;
    },
  };
}
