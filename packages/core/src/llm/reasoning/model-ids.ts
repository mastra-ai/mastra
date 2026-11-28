export const MASTRA_GATEWAY_PREFIX = 'mastra/';

/** Anthropic's API only accepts dashed ids (`claude-opus-4-6`), but catalogs may list dotted ones. */
export function normalizeAnthropicModelId(modelId: string): string {
  return modelId.replace(/\.(?=\d)/g, '-');
}

export function stripMastraGatewayPrefix(modelId: string): string {
  return modelId.startsWith(MASTRA_GATEWAY_PREFIX) ? modelId.substring(MASTRA_GATEWAY_PREFIX.length) : modelId;
}
