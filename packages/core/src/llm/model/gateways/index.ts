import { MastraError } from '../../../error/index.js';
import type { MastraModelGatewayInterface } from './base.js';
export {
  MastraModelGateway,
  type MastraModelGatewayInterface,
  type ProviderConfig,
  type GatewayLanguageModel,
  type GatewayAuthRequest,
  type GatewayAuthResult,
  type GatewayAuthSource,
} from './base.js';
export {
  AzureOpenAIGateway,
  type AzureAccessToken,
  type AzureOpenAIGatewayConfig,
  type AzureTokenCredential,
} from './azure.js';
export { ModelsDevGateway } from './models-dev.js';
export { MastraGateway, type MastraGatewayConfig } from './mastra.js';
export { NetlifyGateway } from './netlify.js';

export function getGatewayId(gateway: MastraModelGatewayInterface): string {
  return gateway.getId?.() ?? gateway.id;
}

export function shouldEnableGateway(gateway: MastraModelGatewayInterface): boolean {
  return gateway.shouldEnable?.() ?? true;
}

export function serializeGatewayForSpan(
  gateway: MastraModelGatewayInterface,
): { id: string; name: string } & Record<string, unknown> {
  return gateway.serializeForSpan?.() ?? { id: getGatewayId(gateway), name: gateway.name };
}

/**
 * Find the gateway that handles a specific model ID based on gateway ID
 * Gateway ID is used as the prefix (e.g., "netlify" for netlify gateway)
 * Exception: models.dev is a provider registry and doesn't use a prefix
 */
export function findGatewayForModel(
  gatewayId: string,
  gateways: MastraModelGatewayInterface[],
): MastraModelGatewayInterface {
  // First, check for gateways whose ID matches the prefix (true gateways like netlify, openrouter, vercel)
  const prefixedGateway = gateways.find(g => {
    const id = getGatewayId(g);
    return id !== 'models.dev' && (id === gatewayId || gatewayId.startsWith(`${id}/`));
  });
  if (prefixedGateway) {
    return prefixedGateway;
  }

  // Then check models.dev (provider registry without prefix)
  const modelsDevGateway = gateways.find(g => getGatewayId(g) === 'models.dev');
  if (modelsDevGateway) {
    return modelsDevGateway;
  }

  throw new MastraError({
    id: 'MODEL_ROUTER_NO_GATEWAY_FOUND',
    category: 'USER',
    domain: 'MODEL_ROUTER',
    text: `No Mastra model router gateway found for model id ${gatewayId}`,
  });
}
