import type { JSONValue } from 'ai';
import type { ActiveThinkingLevel } from '../thinking.js';
import { MASTRA_GATEWAY_PREFIX, stripMastraGatewayPrefix } from './model-ids.js';

type ThinkingProviderOptions = Record<string, JSONValue>;

export interface ThinkingRequestFormat {
  optionsKey: string;
  sendEffort?: (effort: ActiveThinkingLevel) => ThinkingProviderOptions;
  acceptedEfforts?: readonly ActiveThinkingLevel[];
  enableThinking?: ThinkingProviderOptions;
}

const LOW_TO_HIGH: readonly ActiveThinkingLevel[] = ['low', 'medium', 'high'];
const sendReasoningEffort = (reasoningEffort: ActiveThinkingLevel): ThinkingProviderOptions => ({ reasoningEffort });
const ENABLE_REASONING: ThinkingProviderOptions = { reasoning: { enabled: true } };

export const OPENROUTER_OPTIONS_KEY = 'openrouter';

const OPENROUTER_FORMAT: ThinkingRequestFormat = {
  optionsKey: OPENROUTER_OPTIONS_KEY,
  sendEffort: effort => ({ reasoning: { effort } }),
  enableThinking: ENABLE_REASONING,
};

const REQUEST_FORMATS_BY_PROVIDER: Partial<Record<string, ThinkingRequestFormat>> = {
  deepseek: {
    optionsKey: 'deepseek',
    sendEffort: sendReasoningEffort,
    enableThinking: { thinking: { type: 'enabled' } },
  },
  openrouter: OPENROUTER_FORMAT,
  alibaba: { optionsKey: 'alibaba', enableThinking: { enableThinking: true } },
  groq: { optionsKey: 'groq', sendEffort: sendReasoningEffort, acceptedEfforts: LOW_TO_HIGH },
  mistral: { optionsKey: 'mistral', sendEffort: sendReasoningEffort, acceptedEfforts: ['high'] },
  xai: { optionsKey: 'xai', sendEffort: sendReasoningEffort, acceptedEfforts: [...LOW_TO_HIGH, 'xhigh'] },
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
    enableThinking: ENABLE_REASONING,
  },
  cerebras: { optionsKey: 'cerebras', sendEffort: sendReasoningEffort },
  perplexity: { optionsKey: 'perplexity', sendEffort: effort => ({ reasoning_effort: effort }) },
};

const THINKING_ADAPTER_PROVIDERS: ReadonlySet<string> = new Set(['anthropic', 'openai', 'google']);

export function isThinkingAdapterProvider(provider: string): boolean {
  return THINKING_ADAPTER_PROVIDERS.has(provider);
}

export function thinkingRequestFormatFor(modelId: string): ThinkingRequestFormat | undefined {
  const routedThroughMastraGateway = modelId.startsWith(MASTRA_GATEWAY_PREFIX);
  const [provider = ''] = stripMastraGatewayPrefix(modelId).split('/');
  if (isThinkingAdapterProvider(provider)) return undefined;
  if (routedThroughMastraGateway) return OPENROUTER_FORMAT;
  return REQUEST_FORMATS_BY_PROVIDER[provider.includes('alibaba') ? 'alibaba' : provider];
}
