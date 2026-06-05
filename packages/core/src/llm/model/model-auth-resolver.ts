import type { GatewayAuthRequest, GatewayAuthResult, MastraModelGatewayInterface } from './gateways/base.js';

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

function hasExplicitAuth(explicit?: Pick<GatewayAuthResult, 'apiKey' | 'headers' | 'bearerToken'>): boolean {
  return Boolean(
    explicit?.apiKey || explicit?.bearerToken || (explicit?.headers && Object.keys(explicit.headers).length > 0),
  );
}

export async function resolveModelAuth({
  gateway,
  request,
  explicit,
}: ResolveModelAuthArgs): Promise<GatewayAuthResult> {
  if (hasExplicitAuth(explicit)) {
    return mergeAuthHeaders({ ...explicit, source: 'explicit' }) ?? { source: 'explicit' };
  }

  const gatewayAuth = mergeAuthHeaders(await gateway.resolveAuth?.(request));
  if (gatewayAuth?.apiKey || gatewayAuth?.headers || gatewayAuth?.bearerToken) {
    return { ...gatewayAuth, source: gatewayAuth.source ?? 'gateway' };
  }

  return {
    apiKey: await gateway.getApiKey(request.routerId),
    source: 'legacy',
  };
}
