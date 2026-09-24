/**
 * Model-id helpers shared by the model gateway and the browser settings
 * module. Kept dependency-free so neither side has to import the other.
 */

export const OPENAI_PREFIX = 'openai/';
export const ANTHROPIC_PREFIX = 'anthropic/';
export const MASTRA_GATEWAY_PREFIX = 'mastra/';

/** Anthropic's API only accepts dashed ids (`claude-opus-4-6`), but catalogs may list dotted ones. */
export function normalizeAnthropicModelId(modelId: string): string {
  return modelId.replace(/\.(?=\d)/g, '-');
}

/**
 * The Codex ChatGPT-account endpoint serves some OpenAI models only under a
 * `-codex` id. Applied wherever a model id is sent over Codex OAuth (chat
 * agents and Stagehand alike) so both paths hit the same upstream model.
 */
const CODEX_OPENAI_MODEL_REMAPS: Record<string, string> = {
  'gpt-5.3': 'gpt-5.3-codex',
  'gpt-5.2': 'gpt-5.2-codex',
  'gpt-5.1': 'gpt-5.1-codex',
  'gpt-5.1-mini': 'gpt-5.1-codex-mini',
  'gpt-5': 'gpt-5-codex',
};

export function stripMastraGatewayPrefix(modelId: string): string {
  return modelId.startsWith(MASTRA_GATEWAY_PREFIX) ? modelId.substring(MASTRA_GATEWAY_PREFIX.length) : modelId;
}

export function remapOpenAIModelForCodexOAuth(modelId: string): string {
  const normalizedModelId = stripMastraGatewayPrefix(modelId);

  if (!normalizedModelId.startsWith(OPENAI_PREFIX)) {
    return modelId;
  }

  const openaiModelId = normalizedModelId.substring(OPENAI_PREFIX.length);

  if (openaiModelId.includes('-codex')) {
    return modelId;
  }

  const codexModelId = CODEX_OPENAI_MODEL_REMAPS[openaiModelId];
  if (!codexModelId) {
    return modelId;
  }

  const remappedModelId = `${OPENAI_PREFIX}${codexModelId}`;
  return modelId.startsWith(MASTRA_GATEWAY_PREFIX) ? `${MASTRA_GATEWAY_PREFIX}${remappedModelId}` : remappedModelId;
}
