import { MastraError } from '../../error/index.js';
import type { MastraModelGateway } from './gateways/base.js';
import { ModelsDevGateway } from './gateways/models-dev.js';
import { NetlifyGateway } from './gateways/netlify.js';
import { PROVIDER_REGISTRY } from './provider-registry.generated.js';

function getStaticProvidersByGateway(name: string) {
  return Object.fromEntries(Object.entries(PROVIDER_REGISTRY).filter(([_provider, config]) => config.gateway === name));
}

const gateways = [new NetlifyGateway(), new ModelsDevGateway(getStaticProvidersByGateway(`models.dev`))];

/**
 * Find the gateway that handles a specific model ID based on prefix
 */
export function findGatewayForModel(gatewayId: string): MastraModelGateway {
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

export type ResolvedModelConfig = {
  url: string | false;
  headers: Record<string, string>;
  resolvedModelId: string;
  fullModelId: string;
};
/**
 * Resolve URL and headers for a model using runtime gateways
 */
export async function resolveModelConfig(
  modelId: string,
  envVars: Record<string, string> = process.env as Record<string, string>,
): Promise<ResolvedModelConfig> {
  const gateway = findGatewayForModel(modelId);

  if (!gateway) {
    return { url: false, headers: {}, resolvedModelId: modelId, fullModelId: modelId };
  }

  const url = await gateway.buildUrl(modelId, envVars);
  if (url === false) {
    return { url: false, headers: {}, resolvedModelId: modelId, fullModelId: modelId };
  }

  const headers = gateway.buildHeaders ? await gateway.buildHeaders(modelId, envVars) : {};

  let resolvedModelId = modelId;

  // remove any gateway prefix
  const prefix = gateway.prefix ? `${gateway.prefix}/` : null;
  if (prefix && resolvedModelId.startsWith(prefix)) {
    resolvedModelId = resolvedModelId.substring(prefix.length);
  }

  // remove the provider id
  const firstSlashIndex = resolvedModelId.indexOf('/');
  if (firstSlashIndex !== -1) {
    resolvedModelId = resolvedModelId.substring(firstSlashIndex + 1);
  }

  return { url, headers, resolvedModelId, fullModelId: modelId };
}
