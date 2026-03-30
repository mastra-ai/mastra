import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import { wrapLanguageModel } from 'ai';
import { AuthStorage } from '../auth/storage.js';
import {
  LLM_PROXY_DEFAULTS,
  MEMORY_GATEWAY_DEFAULTS,
  MEMORY_GATEWAY_DEFAULT_URL,
  MEMORY_GATEWAY_PROVIDER,
  getCustomProviderId,
  loadSettings,
} from '../onboarding/settings.js';
import type { LlmProxySettings, MemoryGatewaySettings } from '../onboarding/settings.js';
import { opencodeClaudeMaxProvider, promptCacheMiddleware } from '../providers/claude-max.js';
import { openaiCodexProvider } from '../providers/openai-codex.js';
import type { ThinkingLevel } from '../providers/openai-codex.js';

const authStorage = new AuthStorage();

const OPENAI_PREFIX = 'openai/';

const CODEX_OPENAI_MODEL_REMAPS: Record<string, string> = {
  'gpt-5.3': 'gpt-5.3-codex',
  'gpt-5.2': 'gpt-5.2-codex',
  'gpt-5.1': 'gpt-5.1-codex',
  'gpt-5.1-mini': 'gpt-5.1-codex-mini',
  'gpt-5': 'gpt-5-codex',
};

type ResolvedModel =
  | MastraModelConfig
  | ReturnType<typeof openaiCodexProvider>
  | ReturnType<typeof opencodeClaudeMaxProvider>
  | ModelRouterLanguageModel
  | ReturnType<ReturnType<typeof createAnthropic>>
  | ReturnType<ReturnType<typeof createOpenAI>>;

type ModelRequestHeaders = Record<string, string>;

function getHarnessHeaders(requestContext?: RequestContext): ModelRequestHeaders | undefined {
  const harnessContext = requestContext?.get('harness') as HarnessRequestContext<any> | undefined;
  const headers = {
    ...(harnessContext?.threadId ? { 'x-thread-id': harnessContext.threadId } : {}),
    ...(harnessContext?.resourceId ? { 'x-resource-id': harnessContext.resourceId } : {}),
  };

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function remapOpenAIModelForCodexOAuth(modelId: string): string {
  if (!modelId.startsWith(OPENAI_PREFIX)) {
    return modelId;
  }

  const openaiModelId = modelId.substring(OPENAI_PREFIX.length);

  if (openaiModelId.includes('-codex')) {
    return modelId;
  }

  const codexModelId = CODEX_OPENAI_MODEL_REMAPS[openaiModelId];
  if (!codexModelId) {
    return modelId;
  }

  return `${OPENAI_PREFIX}${codexModelId}`;
}

/**
 * Resolve the Anthropic API key from stored credentials.
 * Returns the key if available, undefined otherwise.
 */
export function getAnthropicApiKey(): string | undefined {
  // Check stored API key credential (set via /apikey or UI prompt)
  const storedCred = authStorage.get('anthropic');
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  return undefined;
}

/**
 * Resolve the OpenAI API key from stored credentials.
 * Returns the key if available, undefined otherwise.
 */
export function getOpenAIApiKey(): string | undefined {
  const storedCred = authStorage.get('openai-codex');
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  return undefined;
}

/**
 * Create an Anthropic model using a direct API key (no OAuth).
 * Applies prompt caching but NOT the Claude Code identity middleware
 * (which is only required for Claude Max OAuth).
 */
function anthropicApiKeyProvider(
  modelId: string,
  apiKey: string,
  headers?: ModelRequestHeaders,
  baseURL?: string,
): MastraModelConfig {
  const anthropic = createAnthropic({ apiKey, headers, ...(baseURL ? { baseURL } : {}) });
  return wrapLanguageModel({
    model: anthropic(modelId),
    middleware: [promptCacheMiddleware],
  });
}

/**
 * Create an OpenAI model using a direct API key from AuthStorage.
 */
function openaiApiKeyProvider(
  modelId: string,
  apiKey: string,
  headers?: ModelRequestHeaders,
  baseURL?: string,
): MastraModelConfig {
  const openai = createOpenAI({ apiKey, headers, ...(baseURL ? { baseURL } : {}) });
  return wrapLanguageModel({
    model: openai.responses(modelId),
    middleware: [],
  });
}

/**
 * Resolve a model ID to the correct provider instance.
 * Shared by the main agent, observer, and reflector.
 *
 * - For anthropic/* models: Uses stored OAuth credentials when present, otherwise direct API key
 * - For openai/* models: Uses OAuth when configured, otherwise direct API key from AuthStorage
 * - For moonshotai/* models: Uses Moonshot AI Anthropic-compatible endpoint
 * - For all other providers: Uses Mastra's model router (models.dev)
 */
export function resolveModel(
  modelId: string,
  options?: { thinkingLevel?: ThinkingLevel; remapForCodexOAuth?: boolean; requestContext?: RequestContext },
): ResolvedModel {
  authStorage.reload();
  const harnessHeaders = getHarnessHeaders(options?.requestContext);
  const [providerId, modelName] = modelId.split('/', 2);
  const settings = loadSettings();

  // Memory gateway supersedes llm-proxy when enabled
  const mg: MemoryGatewaySettings = settings.memoryGateway ?? MEMORY_GATEWAY_DEFAULTS;
  const mgApiKey = authStorage.getStoredApiKey(MEMORY_GATEWAY_PROVIDER);
  const mgEnabled = !!mgApiKey;

  let effectiveBaseUrl: string | undefined;
  let effectiveProxyHeaders: ModelRequestHeaders | undefined;

  if (mgEnabled) {
    effectiveBaseUrl = mg.baseUrl ?? MEMORY_GATEWAY_DEFAULT_URL;
    effectiveProxyHeaders = { 'X-Mastra-Authorization': `Bearer ${mgApiKey}` };
  } else {
    const proxy: LlmProxySettings = settings.llmProxy ?? LLM_PROXY_DEFAULTS;
    effectiveBaseUrl = proxy.baseUrl ?? undefined;
    // Only forward proxy headers when a proxy base URL is configured
    effectiveProxyHeaders = effectiveBaseUrl && Object.keys(proxy.headers).length > 0 ? proxy.headers : undefined;
  }

  // Merge effective proxy headers → harness headers (harness wins on conflict)
  const headers: ModelRequestHeaders | undefined =
    effectiveProxyHeaders || harnessHeaders ? { ...effectiveProxyHeaders, ...harnessHeaders } : undefined;

  const customProvider =
    providerId && modelName
      ? settings.customProviders.find(provider => {
          return providerId === getCustomProviderId(provider.name);
        })
      : undefined;

  if (customProvider) {
    // Custom providers use their own URL — don't leak proxy/gateway headers
    const customHeaders: ModelRequestHeaders | undefined =
      customProvider.headers || harnessHeaders ? { ...customProvider.headers, ...harnessHeaders } : undefined;
    return new ModelRouterLanguageModel({
      id: modelId as `${string}/${string}`,
      url: customProvider.url,
      apiKey: customProvider.apiKey,
      headers: customHeaders,
    });
  }

  const isAnthropicModel = modelId.startsWith('anthropic/');
  const isOpenAIModel = modelId.startsWith(OPENAI_PREFIX);
  const isMoonshotModel = modelId.startsWith('moonshotai/');

  if (isMoonshotModel) {
    if (!process.env.MOONSHOT_AI_API_KEY) {
      throw new Error(`Need MOONSHOT_AI_API_KEY`);
    }
    return createAnthropic({
      apiKey: process.env.MOONSHOT_AI_API_KEY!,
      baseURL: effectiveBaseUrl ?? 'https://api.moonshot.ai/anthropic/v1',
      name: 'moonshotai.anthropicv1',
      headers,
    })(modelId.substring('moonshotai/'.length));
  } else if (isAnthropicModel) {
    const bareModelId = modelId.substring('anthropic/'.length);
    const storedCred = authStorage.get('anthropic');

    // Primary path: explicit OAuth credential
    if (storedCred?.type === 'oauth') {
      return opencodeClaudeMaxProvider(bareModelId, { baseURL: effectiveBaseUrl, headers });
    }

    // Secondary path: explicit stored API key credential
    if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
      return anthropicApiKeyProvider(bareModelId, storedCred.key.trim(), headers, effectiveBaseUrl);
    }

    // Fallback: direct API key from AuthStorage
    const apiKey = getAnthropicApiKey();
    if (apiKey) {
      return anthropicApiKeyProvider(bareModelId, apiKey, headers, effectiveBaseUrl);
    }
    // No auth configured — attempt OAuth provider which will prompt login
    return opencodeClaudeMaxProvider(bareModelId, { baseURL: effectiveBaseUrl, headers });
  } else if (isOpenAIModel) {
    const bareModelId = modelId.substring(OPENAI_PREFIX.length);
    const storedCred = authStorage.get('openai-codex');

    if (storedCred?.type === 'oauth') {
      const resolvedModelId = options?.remapForCodexOAuth ? remapOpenAIModelForCodexOAuth(modelId) : modelId;
      return openaiCodexProvider(resolvedModelId.substring(OPENAI_PREFIX.length), {
        thinkingLevel: options?.thinkingLevel,
        baseURL: effectiveBaseUrl,
        headers,
      });
    }

    const apiKey = getOpenAIApiKey();
    if (apiKey) {
      return openaiApiKeyProvider(bareModelId, apiKey, headers, effectiveBaseUrl);
    }

    return new ModelRouterLanguageModel({
      id: modelId as `${string}/${string}`,
      ...(effectiveBaseUrl ? { url: effectiveBaseUrl } : {}),
      headers,
    });
  } else {
    return new ModelRouterLanguageModel({
      id: modelId as `${string}/${string}`,
      ...(effectiveBaseUrl ? { url: effectiveBaseUrl } : {}),
      headers,
    });
  }
}

/**
 * Dynamic model function that reads the current model from harness state.
 * This allows runtime model switching via the /models picker.
 */
export function getDynamicModel({ requestContext }: { requestContext: RequestContext }): ResolvedModel {
  const harnessContext = requestContext.get('harness') as HarnessRequestContext<any> | undefined;

  const modelId = harnessContext?.state?.currentModelId;
  if (!modelId) {
    throw new Error('No model selected. Use /models to select a model first.');
  }

  const thinkingLevel = harnessContext?.state?.thinkingLevel as ThinkingLevel | undefined;

  return resolveModel(modelId, { thinkingLevel, requestContext });
}
