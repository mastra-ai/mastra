import type { ModelProviderOverride, ProviderConfig } from './base.js';

export const OPENCODE_CONSOLE_PROVIDER_ID = 'opencode-console';
export const OPENCODE_CONSOLE_CATALOG_TIMEOUT_MS = 2_000;
export const OPENCODE_CONSOLE_MODELS_URL = 'https://opencode.ai/inference/v1/models';
export const OPENCODE_CONSOLE_OPENAI_URL = 'https://opencode.ai/inference/openai/v1';
export const OPENCODE_CONSOLE_ANTHROPIC_URL = 'https://opencode.ai/inference/anthropic/v1';
export const OPENCODE_CONSOLE_GOOGLE_URL = 'https://opencode.ai/inference/google/v1beta';
export const OPENCODE_CONSOLE_DOC_URL = 'https://opencode.ai/console/guides/inference';

/**
 * Last-known Console model catalog used when the live `/inference/v1/models`
 * request fails. Keep this in sync with that endpoint, excluding the `test` model.
 */
export const OPENCODE_CONSOLE_FALLBACK_MODELS = [
  'big-pickle',
  'claude-fable-5',
  'claude-fable-5-1',
  'claude-haiku-4-5',
  'claude-opus-4-5',
  'claude-opus-4-6',
  'claude-opus-4-7',
  'claude-opus-4-8',
  'claude-opus-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-6',
  'claude-sonnet-5',
  'deepseek-v4-flash',
  'deepseek-v4-flash-vision-exp',
  'deepseek-v4-pro',
  'gemini-3-flash',
  'gemini-3.1-pro',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'glm-5',
  'glm-5.1',
  'glm-5.2',
  'glm-5.3',
  'glm-5.3-flash',
  'gpt-5',
  'gpt-5-codex',
  'gpt-5-nano',
  'gpt-5.1',
  'gpt-5.1-codex',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'gpt-5.4-pro',
  'gpt-5.5',
  'gpt-5.5-pro',
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-6-astra',
  'grok-4.5',
  'grok-4.6',
  'grok-build-0.1',
  'kimi-k2.5',
  'kimi-k2.6',
  'kimi-k2.7-code',
  'kimi-k3',
  'ling-3.0-flash-fin-free',
  'mimo-v2.5-free',
  'minimax-m2.5',
  'minimax-m2.7',
  'minimax-m3',
  'muse-spark-1.2',
  'muse-spark-1.2-contributor-free',
  'muse-spark-1.3',
  'muse-spark-1.3-contributor-free',
  'nemotron-3-ultra-free',
  'nemotron-3.5-lightning-free',
  'qwen3.5-plus',
  'qwen3.6-plus',
] as const;

export function getOpenCodeConsoleModelOverride(modelId: string): ModelProviderOverride | undefined {
  if (modelId.startsWith('gpt-')) {
    return { shape: 'responses', npm: '@ai-sdk/openai' };
  }

  if (modelId.startsWith('claude-') || modelId.startsWith('qwen')) {
    return { api: OPENCODE_CONSOLE_ANTHROPIC_URL, npm: '@ai-sdk/anthropic' };
  }

  if (modelId.startsWith('gemini-')) {
    return { api: OPENCODE_CONSOLE_GOOGLE_URL, npm: '@ai-sdk/google' };
  }

  // Console documents grok-build-0.1 on chat completions. The existing Responses
  // mapping for other Grok and Muse models is not verified by the Console guide.
  if (modelId.startsWith('muse-spark') || (modelId.startsWith('grok-') && modelId !== 'grok-build-0.1')) {
    return { shape: 'responses', npm: '@ai-sdk/openai' };
  }
}

function isUsableConsoleModelId(modelId: string): boolean {
  return modelId.trim().length > 0 && modelId === modelId.trim() && modelId !== 'test';
}

export async function fetchOpenCodeConsoleModelIds(): Promise<string[]> {
  const controller = new AbortController();
  const fallback = () => [...OPENCODE_CONSOLE_FALLBACK_MODELS].sort();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<string[]>(resolve => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve(fallback());
    }, OPENCODE_CONSOLE_CATALOG_TIMEOUT_MS);
  });

  const request = (async () => {
    const response = await fetch(OPENCODE_CONSOLE_MODELS_URL, { signal: controller.signal });
    if (!response?.ok) return fallback();

    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const modelIds = (payload.data ?? [])
      .map(model => model.id)
      .filter((modelId): modelId is string => typeof modelId === 'string' && isUsableConsoleModelId(modelId));

    return modelIds.length > 0 ? [...new Set(modelIds)].sort() : fallback();
  })();

  try {
    return await Promise.race([deadline, request]);
  } catch {
    return fallback();
  } finally {
    clearTimeout(timeout);
    void request.catch(() => {});
  }
}

/** Use Console's Bearer contract instead of native SDK legacy authentication headers. */
export function createOpenCodeConsoleFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.delete('x-api-key');
    headers.delete('x-goog-api-key');
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${apiKey}`);
    return globalThis.fetch(input, { ...init, headers });
  };
}

export function buildOpenCodeConsoleProvider({
  modelIds,
  attachmentModels = [],
  temperatureModels = [],
  structuredOutputModels = [],
}: {
  modelIds: string[];
  attachmentModels?: string[];
  temperatureModels?: string[];
  structuredOutputModels?: string[];
}): {
  config: ProviderConfig;
  attachment: string[];
  temperature: string[];
  structuredOutput: string[];
} {
  const models = [...new Set(modelIds.filter(isUsableConsoleModelId))].sort();
  const modelSet = new Set(models);
  const modelOverrides: Record<string, ModelProviderOverride> = {};

  for (const modelId of models) {
    const override = getOpenCodeConsoleModelOverride(modelId);
    if (override) modelOverrides[modelId] = override;
  }

  return {
    config: {
      url: OPENCODE_CONSOLE_OPENAI_URL,
      apiKeyEnvVar: 'OPENCODE_CONSOLE_API_KEY',
      apiKeyHeader: 'Authorization',
      name: 'OpenCode Console',
      models,
      docUrl: OPENCODE_CONSOLE_DOC_URL,
      gateway: 'models.dev',
      modelOverrides: Object.keys(modelOverrides).length > 0 ? modelOverrides : undefined,
    },
    attachment: [...new Set(attachmentModels.filter(modelId => modelSet.has(modelId)))].sort(),
    temperature: [...new Set(temperatureModels.filter(modelId => modelSet.has(modelId)))].sort(),
    structuredOutput: [...new Set(structuredOutputModels.filter(modelId => modelSet.has(modelId)))].sort(),
  };
}
