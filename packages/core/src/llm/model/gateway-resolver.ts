export type ResolvedModelConfig = {
  url: string | false;
  headers: Record<string, string>;
  resolvedModelId: string;
  fullModelId: string;
};

export function parseModelRouterId(routerId: string, gatewayPrefix?: string): { providerId: string; modelId: string } {
  if (gatewayPrefix && !routerId.startsWith(`${gatewayPrefix}/`)) {
    throw new Error(`Expected ${gatewayPrefix}/ in model router ID ${routerId}`);
  }

  const idParts = routerId.split('/');

  if (gatewayPrefix && idParts.length < 3) {
    throw new Error(
      `Expected atleast 3 id parts ${gatewayPrefix}/provider/model, but only saw ${idParts.length} in ${routerId}`,
    );
  }

  const providerId = idParts.at(gatewayPrefix ? 1 : 0);
  const modelId = idParts.slice(gatewayPrefix ? 2 : 1).join(`/`);

  if (!routerId.includes(`/`) || !providerId || !modelId) {
    throw new Error(
      `Attempted to parse provider/model from ${routerId} but this ID doesn't appear to contain a provider`,
    );
  }

  return {
    providerId,
    modelId,
  };
}
