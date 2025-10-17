import { MastraError } from '../../../error/index.js';
import type { MastraModelGateway } from './base.js';
export { MastraModelGateway, type ProviderConfig } from './base.js';
export { ModelsDevGateway } from './models-dev.js';
export { NetlifyGateway } from './netlify.js';

/**
 * Find the gateway that handles a specific model ID based on prefix
 */
export function findGatewayForModel(gatewayId: string, gateways: MastraModelGateway[]): MastraModelGateway {
  // First, check for gateways with specific prefixes
  const prefixedGateway = gateways.find((g: MastraModelGateway) => g.prefix && gatewayId.startsWith(`${g.prefix}/`));
  if (prefixedGateway) {
    return prefixedGateway;
  }

  // Then check gateways without prefixes (like models.dev) that might handle the model
  const unprefixedGateways = gateways.filter((g: MastraModelGateway) => !g.prefix);
  for (const gateway of unprefixedGateways) {
    // These gateways will check internally if they can handle the model
    return gateway; // For now, return the first unprefixed gateway (models.dev)
  }

  throw new MastraError({
    id: 'MODEL_ROUTER_NO_GATEWAY_FOUND',
    category: 'USER',
    domain: 'MODEL_ROUTER',
    text: `No Mastra model router gateway found for model id ${gatewayId}`,
  });
}
