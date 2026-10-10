import { runCatalogThinkingLevel } from '../thinking-catalog.js';
import type { ThinkingLevelSetting } from '../thinking.js';
import { MASTRA_GATEWAY_PREFIX } from './model-ids.js';
import { providerThinkingOptions } from './provider-thinking.js';
import type { ProviderThinkingOptions } from './provider-thinking.js';
import { isThinkingAdapterProvider, OPENROUTER_OPTIONS_KEY } from './thinking-request.js';

function adapterProviderThinkingOptions(
  routedModelId: string,
  level: ThinkingLevelSetting | undefined,
): ProviderThinkingOptions | undefined {
  if (!level || level === 'off') return undefined;
  const effort = runCatalogThinkingLevel(routedModelId, level);
  if (effort === 'off') return undefined;
  return {
    optionsKey: OPENROUTER_OPTIONS_KEY,
    options: { reasoning: { effort } },
    controlKeys: new Set(['reasoning']),
  };
}

export function mastraGatewayThinkingOptions(
  providerId: string,
  modelId: string,
  level: ThinkingLevelSetting | undefined,
): ProviderThinkingOptions | undefined {
  const routedModelId = `${MASTRA_GATEWAY_PREFIX}${providerId}/${modelId}`;
  if (isThinkingAdapterProvider(providerId)) return adapterProviderThinkingOptions(routedModelId, level);
  return providerThinkingOptions(routedModelId, level);
}
