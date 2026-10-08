import { runCatalogThinkingLevel } from '../thinking-catalog.js';
import type { ActiveThinkingLevel, ThinkingLevelSetting } from '../thinking.js';
import { ANTHROPIC_THINKING_BUDGET_TOKENS, getAnthropicThinkingCapability } from './anthropic-thinking.js';
import { resolveGoogleThinkingConfig } from './google-thinking.js';
import { MASTRA_GATEWAY_PREFIX, normalizeAnthropicModelId } from './model-ids.js';
import { providerThinkingOptions } from './provider-thinking.js';
import type { ProviderThinkingOptions } from './provider-thinking.js';
import { isThinkingAdapterProvider, OPENROUTER_OPTIONS_KEY } from './thinking-request.js';
import type { ThinkingAdapterProvider } from './thinking-request.js';

type OpenRouterReasoning = { effort: string } | { max_tokens: number };

function anthropicReasoning(modelId: string, level: ActiveThinkingLevel): OpenRouterReasoning | undefined {
  const bareModelId = normalizeAnthropicModelId(modelId);
  const runLevel = runCatalogThinkingLevel(`anthropic/${bareModelId}`, level);
  if (runLevel === 'off') return undefined;
  if (getAnthropicThinkingCapability(bareModelId) === 'budget') {
    return { max_tokens: ANTHROPIC_THINKING_BUDGET_TOKENS[runLevel] };
  }
  return { effort: runLevel };
}

function openaiReasoning(modelId: string, level: ActiveThinkingLevel): OpenRouterReasoning | undefined {
  const runLevel = runCatalogThinkingLevel(`openai/${modelId}`, level);
  return runLevel === 'off' ? undefined : { effort: runLevel };
}

function googleReasoning(modelId: string, level: ActiveThinkingLevel): OpenRouterReasoning | undefined {
  const config = resolveGoogleThinkingConfig(modelId, level);
  if (!config) return undefined;
  return 'thinkingBudget' in config ? { max_tokens: config.thinkingBudget } : { effort: config.thinkingLevel };
}

const REASONING_BY_ADAPTER_PROVIDER: Record<
  ThinkingAdapterProvider,
  (modelId: string, level: ActiveThinkingLevel) => OpenRouterReasoning | undefined
> = {
  anthropic: anthropicReasoning,
  openai: openaiReasoning,
  google: googleReasoning,
};

function adapterThinkingOptions(
  provider: ThinkingAdapterProvider,
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): ProviderThinkingOptions | undefined {
  if (!level || level === 'off') return undefined;
  const reasoning = REASONING_BY_ADAPTER_PROVIDER[provider](modelId, level);
  return (
    reasoning && { optionsKey: OPENROUTER_OPTIONS_KEY, options: { reasoning }, controlKeys: new Set(['reasoning']) }
  );
}

export function mastraGatewayThinkingOptions(
  providerId: string,
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): ProviderThinkingOptions | undefined {
  if (isThinkingAdapterProvider(providerId)) return adapterThinkingOptions(providerId, modelId, level);
  return providerThinkingOptions(`${MASTRA_GATEWAY_PREFIX}${providerId}/${modelId}`, level);
}
