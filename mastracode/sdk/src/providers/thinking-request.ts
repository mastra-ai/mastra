import type { ModelReasoningOption } from '@mastra/core/llm';
import type { JSONValue } from 'ai';
import type { ActiveThinkingLevel } from '../thinking.js';
import { MASTRA_GATEWAY_PREFIX, stripMastraGatewayPrefix } from './model-ids.js';

type ThinkingProviderOptions = Record<string, JSONValue>;

export interface ThinkingRequestFormat {
  optionsKey: string;
  sendEffort?: (effort: ActiveThinkingLevel | 'none') => ThinkingProviderOptions;
  acceptedEfforts?: readonly ActiveThinkingLevel[];
  acceptsNoneEffort?: true;
  enableThinking?: ThinkingProviderOptions;
  disableThinking?: ThinkingProviderOptions;
}

const LOW_TO_HIGH: readonly ActiveThinkingLevel[] = ['low', 'medium', 'high'];
const sendReasoningEffort = (reasoningEffort: ActiveThinkingLevel | 'none'): ThinkingProviderOptions => ({
  reasoningEffort,
});
const ENABLE_REASONING: ThinkingProviderOptions = { reasoning: { enabled: true } };

const OPENROUTER_FORMAT: ThinkingRequestFormat = {
  optionsKey: 'openrouter',
  sendEffort: effort => ({ reasoning: { effort } }),
  acceptsNoneEffort: true,
  enableThinking: ENABLE_REASONING,
};

const REQUEST_FORMATS_BY_PROVIDER: Partial<Record<string, ThinkingRequestFormat>> = {
  deepseek: {
    optionsKey: 'deepseek',
    sendEffort: sendReasoningEffort,
    enableThinking: { thinking: { type: 'enabled' } },
    disableThinking: { thinking: { type: 'disabled' } },
  },
  openrouter: OPENROUTER_FORMAT,
  alibaba: {
    optionsKey: 'alibaba',
    enableThinking: { enableThinking: true },
    disableThinking: { enableThinking: false },
  },
  groq: { optionsKey: 'groq', sendEffort: sendReasoningEffort, acceptedEfforts: LOW_TO_HIGH, acceptsNoneEffort: true },
  mistral: {
    optionsKey: 'mistral',
    sendEffort: sendReasoningEffort,
    acceptedEfforts: ['high'],
    acceptsNoneEffort: true,
  },
  xai: { optionsKey: 'xai', sendEffort: sendReasoningEffort, acceptedEfforts: LOW_TO_HIGH, acceptsNoneEffort: true },
  togetherai: {
    optionsKey: 'togetherai',
    sendEffort: sendReasoningEffort,
    acceptedEfforts: LOW_TO_HIGH,
    enableThinking: ENABLE_REASONING,
  },
  deepinfra: {
    optionsKey: 'deepinfra',
    sendEffort: sendReasoningEffort,
    acceptedEfforts: LOW_TO_HIGH,
    acceptsNoneEffort: true,
    enableThinking: ENABLE_REASONING,
  },
  cerebras: { optionsKey: 'cerebras', sendEffort: sendReasoningEffort, acceptsNoneEffort: true },
  perplexity: { optionsKey: 'perplexity', sendEffort: effort => ({ reasoning_effort: effort }) },
};

const THINKING_ADAPTER_PROVIDERS: ReadonlySet<string> = new Set(['anthropic', 'openai', 'google']);

export function isThinkingAdapterProvider(provider: string): boolean {
  return THINKING_ADAPTER_PROVIDERS.has(provider);
}

const PROVIDERS_ROUTED_WITHOUT_THINKING: ReadonlySet<string> = new Set([
  'github-copilot',
  'kimi-for-coding',
  'moonshotai',
  'amazon-bedrock',
]);

export function isRoutedWithoutThinking(modelId: string): boolean {
  const [provider = ''] = stripMastraGatewayPrefix(modelId).split('/');
  return PROVIDERS_ROUTED_WITHOUT_THINKING.has(provider);
}

export function thinkingRequestFormatFor(modelId: string): ThinkingRequestFormat | undefined {
  const routedThroughMastraGateway = modelId.startsWith(MASTRA_GATEWAY_PREFIX);
  const [provider = ''] = stripMastraGatewayPrefix(modelId).split('/');
  if (isThinkingAdapterProvider(provider)) return undefined;
  if (routedThroughMastraGateway) return OPENROUTER_FORMAT;
  return REQUEST_FORMATS_BY_PROVIDER[provider.includes('alibaba') ? 'alibaba' : provider];
}

export function thinkingOffOptions(
  format: ThinkingRequestFormat,
  reasoningOptions: readonly ModelReasoningOption[] | undefined,
): ThinkingProviderOptions | undefined {
  const listsToggle = reasoningOptions?.some(option => option.type === 'toggle');
  if (listsToggle && format.disableThinking) return format.disableThinking;
  if (!format.acceptsNoneEffort) return undefined;
  const listsNoneEffort = reasoningOptions?.some(option => option.type === 'effort' && option.values.includes('none'));
  return listsNoneEffort ? format.sendEffort?.('none') : undefined;
}
