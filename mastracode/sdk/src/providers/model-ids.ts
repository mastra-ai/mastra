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

/**
 * Kimi For Coding subscriptions are served from `api.kimi.com`, which models.dev
 * lists as `kimi-code-plan-cn`. Mastra Code augments that provider with the
 * Kimi OAuth/API-key credential instead of defining its own.
 */
export const KIMI_CODING_PROVIDER_ID = 'kimi-code-plan-cn';
/** Credential id the Kimi login stores accounts under. */
export const KIMI_CODING_CREDENTIAL_ID = 'kimi-for-coding';

/** Providers Mastra Code used to catalog as `mastracode/<provider>/<model>`. */
const LEGACY_MASTRACODE_NAMESPACED_PROVIDERS = new Set(['amazon-bedrock', 'github-copilot', KIMI_CODING_CREDENTIAL_ID]);
/** Provider ids Mastra Code defined itself before augmenting the models.dev provider. */
const LEGACY_PROVIDER_IDS: Record<string, string> = {
  [KIMI_CODING_CREDENTIAL_ID]: KIMI_CODING_PROVIDER_ID,
};

export function normalizeLegacyProviderId(providerId: string): string {
  return LEGACY_PROVIDER_IDS[providerId] ?? providerId;
}

/**
 * Map model ids saved by older Mastra Code versions (packs, OM settings,
 * thread metadata) to the current catalog id:
 * `mastracode/kimi-for-coding/k3` and `kimi-for-coding/k3` → `kimi-code-plan-cn/k3`,
 * `mastracode/github-copilot/<m>` → `github-copilot/<m>`,
 * `mastracode/amazon-bedrock/<m>` → `amazon-bedrock/<m>`.
 */
export function normalizeLegacyModelId(modelId: string): string {
  let normalized = modelId;
  const namespacedProvider = normalized.startsWith('mastracode/') ? normalized.split('/', 3)[1] : undefined;
  if (namespacedProvider && LEGACY_MASTRACODE_NAMESPACED_PROVIDERS.has(namespacedProvider)) {
    normalized = normalized.slice('mastracode/'.length);
  }
  const slash = normalized.indexOf('/');
  if (slash <= 0) return normalized;
  return `${normalizeLegacyProviderId(normalized.slice(0, slash))}${normalized.slice(slash)}`;
}

/** Credential-store id that authenticates a catalog provider id. */
export function getCredentialProviderId(providerId: string): string {
  if (providerId === 'openai') return 'openai-codex';
  if (providerId === KIMI_CODING_PROVIDER_ID) return KIMI_CODING_CREDENTIAL_ID;
  return providerId;
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
