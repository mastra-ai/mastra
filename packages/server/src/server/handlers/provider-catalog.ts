import { GatewayManager, ModelRouterLanguageModel, PROVIDER_REGISTRY, defaultGateways } from '@mastra/core/llm';
import type { LanguageModel, ProviderConfig } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import type { ProviderListItem } from '../schemas/agents';
import { isProviderConnected } from './provider-connection';

const DEFAULT_GATEWAY_IDS = new Set<string>(defaultGateways.map(gateway => gateway.id));
const PROVIDER_AUTH_TIMEOUT_MS = 5000;

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

async function getConnectedModels(
  authManager: GatewayManager,
  id: string,
  provider: ProviderConfig,
): Promise<string[]> {
  const connectedModels: string[] = [];
  const abortController = new AbortController();
  const errors: unknown[] = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;

  async function checkModels() {
    for (const model of provider.models) {
      if (abortController.signal.aborted) return;
      try {
        const connected = await authManager.hasAuth(`${id}/${model}`);
        if (abortController.signal.aborted) return;
        if (connected) connectedModels.push(model);
      } catch (error) {
        errors.push(error);
      }
    }
  }

  try {
    await Promise.race([
      checkModels(),
      new Promise<void>(resolve => {
        timeout = setTimeout(() => {
          abortController.abort();
          errors.push(new Error('Provider authentication check timed out'));
          resolve();
        }, PROVIDER_AUTH_TIMEOUT_MS);
      }),
    ]);
    if (errors.length) console.warn(`Failed to resolve auth for provider "${id}":`, errors[0]);
    return [...connectedModels];
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildProvidersList(
  mastra: Mastra,
): Promise<(ProviderListItem & { connectedModels: string[] })[]> {
  const blockExternal = externalProvidersBlocked();
  const providers: Record<string, ProviderConfig & Pick<ProviderListItem, 'label' | 'description'>> = blockExternal
    ? {}
    : { ...PROVIDER_REGISTRY };
  const gatewayProviders = await new GatewayManager(catalogGateways(mastra, blockExternal)).listProviders();
  for (const [id, provider] of Object.entries(gatewayProviders)) {
    providers[id] ??= provider;
  }

  const authManager = new GatewayManager(registeredGateways(mastra));
  return Promise.all(
    Object.entries(providers).map(async ([id, provider]) => {
      const connectedModels = await getConnectedModels(authManager, id, provider);
      return {
        id,
        name: provider.name,
        label: provider.label || provider.name,
        description: provider.description || '',
        envVar: provider.apiKeyEnvVar,
        connected: connectedModels.length > 0,
        connectedModels,
        docUrl: provider.docUrl,
        models: [...provider.models],
      };
    }),
  );
}

type ModelIdentity = Pick<LanguageModel, 'provider' | 'modelId'>;

export async function isModelUsable(model: ModelIdentity): Promise<boolean> {
  if (model instanceof ModelRouterLanguageModel) return model.hasAuth();
  return isProviderConnected(model.provider);
}
