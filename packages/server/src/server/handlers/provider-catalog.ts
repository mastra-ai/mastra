import { GatewayManager, ModelRouterLanguageModel, PROVIDER_REGISTRY, defaultGateways } from '@mastra/core/llm';
import type { LanguageModel, ProviderConfig } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import type { ProviderListItem } from '../schemas/agents';

const DEFAULT_GATEWAY_IDS = new Set<string>(defaultGateways.map(gateway => gateway.id));

function externalProvidersBlocked(): boolean {
  const flag = process.env.AUTO_BLOCK_EXTERNAL_PROVIDERS;
  return flag === 'true' || flag === '1';
}

function registeredGateways(mastra: Mastra) {
  return Object.values(mastra.listGateways() ?? {});
}

export function createGatewayManager(mastra: Mastra): GatewayManager {
  return new GatewayManager(registeredGateways(mastra));
}

// models.dev rows already come from PROVIDER_REGISTRY, and its fetchProviders is a network call
function catalogGateways(mastra: Mastra, blockExternal: boolean) {
  return registeredGateways(mastra).filter(
    gateway => gateway.id !== 'models.dev' && !(blockExternal && DEFAULT_GATEWAY_IDS.has(gateway.id)),
  );
}

async function isProviderConnected(
  authManager: GatewayManager,
  id: string,
  provider: ProviderConfig,
): Promise<boolean> {
  try {
    return await authManager.hasProviderAuth(id, provider.models);
  } catch (error) {
    console.warn(`Failed to resolve auth for provider "${id}":`, error);
    return false;
  }
}

export async function buildProvidersList(mastra: Mastra): Promise<ProviderListItem[]> {
  const blockExternal = externalProvidersBlocked();
  const providers: Record<string, ProviderConfig> = blockExternal ? {} : { ...PROVIDER_REGISTRY };
  const gatewayProviders = await new GatewayManager(catalogGateways(mastra, blockExternal)).listProviders();
  for (const [id, provider] of Object.entries(gatewayProviders)) {
    providers[id] ??= provider;
  }

  const authManager = createGatewayManager(mastra);
  return Promise.all(
    Object.entries(providers).map(async ([id, provider]) => ({
      id,
      name: provider.name,
      label: (provider as any).label || provider.name,
      description: (provider as any).description || '',
      envVar: provider.apiKeyEnvVar,
      connected: await isProviderConnected(authManager, id, provider),
      docUrl: provider.docUrl,
      models: [...provider.models],
    })),
  );
}

function isVertexProvider(providerId: string): boolean {
  return providerId === 'google-vertex' || providerId.startsWith('google.vertex');
}

// Vertex has no registry row and no gateway; @ai-sdk/google-vertex throws without these two
function vertexConfigured(): boolean {
  return !!(process.env.GOOGLE_VERTEX_PROJECT && process.env.GOOGLE_VERTEX_LOCATION);
}

// AI SDK instances report "openai.responses"; the registry knows "openai"
function registryProviderId(providerId: string): string {
  return providerId.replace(/\..*/, '');
}

type ModelIdentity = Pick<LanguageModel, 'provider' | 'modelId'>;

export async function isModelUsable(authManager: GatewayManager, model: ModelIdentity): Promise<boolean> {
  if (model instanceof ModelRouterLanguageModel) return model.hasAuth();
  if (isVertexProvider(model.provider)) return vertexConfigured();
  return authManager.hasAuth(`${registryProviderId(model.provider)}/${model.modelId}`);
}
