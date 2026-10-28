import type { JSONValue } from 'ai';
import type { ActiveThinkingLevel } from '../thinking.js';
import { MASTRA_GATEWAY_PREFIX, stripMastraGatewayPrefix } from './model-ids.js';

type ThinkingProviderOptions = Record<string, JSONValue>;

export interface ThinkingRequestFormat {
  optionsKey: string;
  sendEffort?: (effort: ActiveThinkingLevel) => ThinkingProviderOptions;
  acceptedEfforts?: readonly ActiveThinkingLevel[];
  enableThinking?: ThinkingProviderOptions;
  /** Provider option aliases that also override the session's thinking level. */
  callerControlKeys?: readonly string[];
}

const LOW_TO_HIGH: readonly ActiveThinkingLevel[] = ['low', 'medium', 'high'];
const sendReasoningEffort = (reasoningEffort: ActiveThinkingLevel): ThinkingProviderOptions => ({ reasoningEffort });
const ENABLE_REASONING: ThinkingProviderOptions = { reasoning: { enabled: true } };

const OPENROUTER_FORMAT: ThinkingRequestFormat = {
  optionsKey: 'openrouter',
  sendEffort: effort => ({ reasoning: { effort } }),
  enableThinking: ENABLE_REASONING,
};

const MISTRAL_MULTI_EFFORT_MODELS = new Set(['zai-glm-5', 'zai-glm-5-3', 'zai-glm-5-3-flash', 'zai-glm-latest']);
const MISTRAL_FORMAT: ThinkingRequestFormat = {
  optionsKey: 'mistral',
  sendEffort: sendReasoningEffort,
  acceptedEfforts: ['high'],
};
const PERPLEXITY_FORMAT: ThinkingRequestFormat = {
  optionsKey: 'perplexity',
  sendEffort: effort => ({ reasoning: { effort } }),
  acceptedEfforts: [...LOW_TO_HIGH, 'xhigh'],
  callerControlKeys: ['reasoning_effort'],
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
  perplexity: PERPLEXITY_FORMAT,
  'perplexity-agent': PERPLEXITY_FORMAT,
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
  const [provider = '', ...modelParts] = stripMastraGatewayPrefix(modelId).split('/');
  if (isThinkingAdapterProvider(provider)) return undefined;
  if (routedThroughMastraGateway) return OPENROUTER_FORMAT;
  if (provider === 'mistral') {
    return MISTRAL_MULTI_EFFORT_MODELS.has(modelParts.join('/'))
      ? { ...MISTRAL_FORMAT, acceptedEfforts: ['low', 'high', 'max'] }
      : MISTRAL_FORMAT;
  }
  return REQUEST_FORMATS_BY_PROVIDER[provider.includes('alibaba') ? 'alibaba' : provider];
}
