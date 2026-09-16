import { GatewayManager, ModelRouterLanguageModel, PROVIDER_REGISTRY, defaultGateways } from '@mastra/core/llm';
import type { LanguageModel, ProviderConfig } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import type { ProviderListItem } from '../schemas/agents';
import { isProviderConnected } from './provider-connection';

const DEFAULT_GATEWAY_IDS = new Set<string>(defaultGateways.map(gateway => gateway.id));

function externalProvidersBlocked(): boolean {
  const flag = process.env.AUTO_BLOCK_EXTERNAL_PROVIDERS;
  return flag === 'true' || flag === '1';
}

function registeredGateways(mastra: Mastra) {
  return Object.values(mastra.listGateways() ?? {});
}

// models.dev rows already come from PROVIDER_REGISTRY, and its fetchProviders is a network call
function catalogGateways(mastra: Mastra, blockExternal: boolean) {
  return registeredGateways(mastra).filter(
    gateway => gateway.id !== 'models.dev' && !(blockExternal && DEFAULT_GATEWAY_IDS.has(gateway.id)),
  );
}

export async function buildProvidersList(mastra: Mastra): Promise<ProviderListItem[]> {
  const blockExternal = externalProvidersBlocked();
  const providers: Record<string, ProviderConfig & Pick<ProviderListItem, 'label' | 'description'>> = blockExternal
    ? {}
    : { ...PROVIDER_REGISTRY };
  const gatewayProviders = await new GatewayManager(catalogGateways(mastra, blockExternal)).listProviders();
  for (const [id, provider] of Object.entries(gatewayProviders)) {
    providers[id] ??= provider;
  }

  const authManager = new GatewayManager(registeredGateways(mastra));
  return Object.entries(providers).map(([id, provider]) => ({
    id,
    name: provider.name,
    label: provider.label || provider.name,
    description: provider.description || '',
    envVar: provider.apiKeyEnvVar,
    connected: authManager.hasProviderCredentials(id) ?? isProviderConnected(id, providers),
    docUrl: provider.docUrl,
    models: [...provider.models],
  }));
}

type ModelIdentity = Pick<LanguageModel, 'provider' | 'modelId'>;

export async function isModelUsable(model: ModelIdentity): Promise<boolean> {
  if (model instanceof ModelRouterLanguageModel) return model.hasAuth();
  return isProviderConnected(model.provider);
}
