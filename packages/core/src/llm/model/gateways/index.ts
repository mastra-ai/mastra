import { MastraError } from '../../../error/index.js';
import type { MastraModelGateway } from './base.js';
export { MastraModelGateway, type ProviderConfig, type GatewayLanguageModel } from './base.js';
export { AzureOpenAIGateway, type AzureOpenAIGatewayConfig } from './azure.js';
export { ModelsDevGateway } from './models-dev.js';
export { NetlifyGateway } from './netlify.js';
export { MastraProxyGateway, type MastraProxyGatewayConfig } from './proxy.js';

/**
 * Find the gateway that handles a specific model ID based on gateway ID
 * Gateway ID is used as the prefix (e.g., "netlify" for netlify gateway)
 * Exception: models.dev is a provider registry and doesn't use a prefix
 */
export function findGatewayForModel(gatewayId: string, gateways: MastraModelGateway[]): MastraModelGateway {
  // First, check for catch-all gateways (e.g., proxy gateways) via matchesModel
  const catchAllGateway = gateways.find((g: MastraModelGateway) => g.matchesModel(gatewayId));
  if (catchAllGateway) {
    return catchAllGateway;
  }

  // Then, check for gateways whose ID matches the prefix (true gateways like netlify, openrouter, vercel)
  const prefixedGateway = gateways.find(
    (g: MastraModelGateway) => g.id !== 'models.dev' && (g.id === gatewayId || gatewayId.startsWith(`${g.id}/`)),
  );
  if (prefixedGateway) {
    return prefixedGateway;
  }

  // Then check models.dev (provider registry without prefix)
  const modelsDevGateway = gateways.find((g: MastraModelGateway) => g.id === 'models.dev');
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
