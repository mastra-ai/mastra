import type { MastraModelGateway } from './gateways/base.js';
import { GATEWAYS } from './provider-registry.generated.js';

/**
 * Find the gateway that handles a specific model ID based on prefix
 */
function findGatewayForModel(modelId: string): MastraModelGateway | null {
  // First, check for gateways with specific prefixes
  const prefixedGateway = GATEWAYS.find((g: MastraModelGateway) => g.prefix && modelId.startsWith(`${g.prefix}/`));
  if (prefixedGateway) {
    return prefixedGateway;
  }

  // Then check gateways without prefixes (like models.dev) that might handle the model
  const unprefixedGateways = GATEWAYS.filter((g: MastraModelGateway) => !g.prefix);
  for (const gateway of unprefixedGateways) {
    // These gateways will check internally if they can handle the model
    return gateway; // For now, return the first unprefixed gateway (models.dev)
  }

  return null;
}

/**
 * Resolve URL and headers for a model using runtime gateways
 */
export async function resolveModelConfig(
  modelId: string,
  envVars: Record<string, string> = process.env as Record<string, string>,
): Promise<{
  url: string | false;
  headers: Record<string, string>;
  resolvedModelId: string;
}> {
  const gateway = findGatewayForModel(modelId);

  if (!gateway) {
    return { url: false, headers: {}, resolvedModelId: modelId };
  }

  const url = await gateway.buildUrl(modelId, envVars);
  if (url === false) {
    return { url: false, headers: {}, resolvedModelId: modelId };
  }

  const headers = gateway.buildHeaders ? await gateway.buildHeaders(modelId, envVars) : {};

  // Resolve the model ID to the format expected by the provider
  const resolvedModelId = gateway.resolveModelId ? gateway.resolveModelId(modelId) : modelId;

  return { url, headers, resolvedModelId };
}

/**
 * Check if a model can be resolved by any gateway
 */
export async function canResolveModel(
  modelId: string,
  envVars: Record<string, string> = process.env as Record<string, string>,
): Promise<boolean> {
  const gateway = findGatewayForModel(modelId);
  if (!gateway) {
    return false;
  }

  const url = await gateway.buildUrl(modelId, envVars);
  return url !== false;
}
