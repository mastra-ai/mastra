import type { GatewayAuthRequest, GatewayAuthResult, MastraModelGatewayInterface } from './gateways/base.js';
import { hasAuthCredentials } from './gateways/gateway-helpers.js';

export type ResolveModelAuthArgs = {
  gateway: MastraModelGatewayInterface;
  request: GatewayAuthRequest;
  explicit?: Pick<GatewayAuthResult, 'apiKey' | 'headers' | 'bearerToken'>;
};

function mergeAuthHeaders(auth: GatewayAuthResult | undefined): GatewayAuthResult | undefined {
  if (!auth?.bearerToken) return auth;
  return {
    ...auth,
    headers: {
      ...auth.headers,
      Authorization: `Bearer ${auth.bearerToken}`,
    },
  };
}

/**
 * @deprecated This function is deprecated and will be removed in a future release.
 * Auth resolution is now handled internally by {@link ModelRouterLanguageModel}.
 * This function is kept for backward compatibility.
 */
export async function resolveModelAuth({
  gateway,
  request,
  explicit,
}: ResolveModelAuthArgs): Promise<GatewayAuthResult> {
  if (hasAuthCredentials(explicit)) {
    return mergeAuthHeaders({ ...explicit, source: 'explicit' }) ?? { source: 'explicit' };
  }

  const gatewayAuth = mergeAuthHeaders(await gateway.resolveAuth?.(request));
  if (hasAuthCredentials(gatewayAuth)) {
    return { ...gatewayAuth, source: gatewayAuth.source ?? 'gateway' };
  }

  return {
    apiKey: await gateway.getApiKey(request.routerId),
    source: 'legacy',
  };
}
