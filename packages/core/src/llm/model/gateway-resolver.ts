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

  // Azure OpenAI uses 2-part format (azure-openai/deployment), others use 3-part (gateway/provider/model)
  if (gatewayPrefix === 'azure-openai') {
    if (idParts.length < 2) {
      throw new Error(`Expected format azure-openai/deployment-name, but got ${routerId}`);
    }
    return {
      providerId: 'azure-openai',
      modelId: idParts.slice(1).join('/'), // Deployment name
    };
  }

  // Standard 3-part format for other prefixed gateways (Netlify, etc.)
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
