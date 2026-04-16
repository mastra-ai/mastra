import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { GATEWAY_AUTH_HEADER, MastraGateway, ModelRouterLanguageModel } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import { wrapLanguageModel } from 'ai';
import { AuthStorage } from '../auth/storage.js';
import { getCustomProviderId, loadSettings, MEMORY_GATEWAY_PROVIDER } from '../onboarding/settings.js';
import {
  buildAnthropicOAuthFetch,
  claudeCodeMiddleware,
  opencodeClaudeMaxProvider,
  promptCacheMiddleware,
} from '../providers/claude-max.js';
import {
  buildOpenAICodexOAuthFetch,
  createCodexMiddleware,
  getEffectiveThinkingLevel,
  openaiCodexProvider,
  THINKING_LEVEL_TO_REASONING_EFFORT,
} from '../providers/openai-codex.js';
import type { ThinkingLevel } from '../providers/openai-codex.js';

const authStorage = new AuthStorage();

const OPENAI_PREFIX = 'openai/';
const MASTRA_GATEWAY_PREFIX = 'mastra/';

const CODEX_OPENAI_MODEL_REMAPS: Record<string, string> = {
  'gpt-5.3': 'gpt-5.3-codex',
  'gpt-5.2': 'gpt-5.2-codex',
  'gpt-5.1': 'gpt-5.1-codex',
  'gpt-5.1-mini': 'gpt-5.1-codex-mini',
  'gpt-5': 'gpt-5-codex',
};

type ResolvedModel =
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

function stripMastraGatewayPrefix(modelId: string): string {
  return modelId.startsWith(MASTRA_GATEWAY_PREFIX) ? modelId.substring(MASTRA_GATEWAY_PREFIX.length) : modelId;
}

function normalizeAnthropicModelId(modelId: string): string {
  return modelId.replace(/\.(?=\d)/g, '-');
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
function anthropicApiKeyProvider(modelId: string, apiKey: string, headers?: ModelRequestHeaders) {
  const anthropic = createAnthropic({ apiKey, headers });
  return wrapLanguageModel({
    model: anthropic(modelId),
    middleware: [promptCacheMiddleware],
  });
}

/**
 * Create an OpenAI model using a direct API key from AuthStorage.
 */
function openaiApiKeyProvider(modelId: string, apiKey: string, headers?: ModelRequestHeaders) {
  const openai = createOpenAI({ apiKey, headers });
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
 * - For all other providers: Uses Mastra's model router (models.dev gateway)
 */
export function resolveModel(
  modelId: string,
  options?: { thinkingLevel?: ThinkingLevel; remapForCodexOAuth?: boolean; requestContext?: RequestContext },
): ResolvedModel {
  authStorage.reload();
  const headers = getHarnessHeaders(options?.requestContext);
  const isMastraGatewayModel = modelId.startsWith(MASTRA_GATEWAY_PREFIX);
  const normalizedModelId = stripMastraGatewayPrefix(modelId);
  const [providerId, modelName] = normalizedModelId.split('/', 2);
  const settings = loadSettings();
  const customProvider =
    !isMastraGatewayModel && providerId && modelName
      ? settings.customProviders.find(provider => {
          return providerId === getCustomProviderId(provider.name);
        })
      : undefined;

  if (customProvider) {
    return new ModelRouterLanguageModel({
      id: normalizedModelId as `${string}/${string}`,
      url: customProvider.url,
      apiKey: customProvider.apiKey,
      headers,
    });
  }

  // --- Memory Gateway path ---
  const mgApiKey = authStorage.getStoredApiKey(MEMORY_GATEWAY_PROVIDER) ?? process.env['MASTRA_GATEWAY_API_KEY'];
  if (mgApiKey && isMastraGatewayModel) {
    // Normalize gateway base URL: strip trailing slashes and "/v1", then append "/v1"
    const rawBase =
      settings.memoryGateway?.baseUrl ?? process.env['MASTRA_GATEWAY_URL'] ?? 'https://gateway-api.mastra.ai';
    const gatewayBaseURL = rawBase.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1';

    const anthropicCred = authStorage.get('anthropic');
    const openaiCred = authStorage.get('openai-codex');

    // Anthropic OAuth: build model directly with middleware (bypasses ModelRouterLanguageModel)
    // Required because claudeCodeMiddleware must inject the Claude Code identity system message
    if (normalizedModelId.startsWith('anthropic/') && anthropicCred?.type === 'oauth') {
      const bareModelId = normalizeAnthropicModelId(normalizedModelId.substring('anthropic/'.length));
      const anthropic = createAnthropic({
        apiKey: 'oauth-gateway-placeholder',
        baseURL: gatewayBaseURL,
        headers: {
          [GATEWAY_AUTH_HEADER]: `Bearer ${mgApiKey}`,
          ...headers,
        },
        fetch: buildAnthropicOAuthFetch({ authStorage }) as any,
      });
      return wrapLanguageModel({
        model: anthropic(bareModelId),
        middleware: [claudeCodeMiddleware, promptCacheMiddleware],
      });
    }

    // OpenAI Codex OAuth: build model directly with middleware (bypasses ModelRouterLanguageModel)
    // Required because createCodexMiddleware injects instructions, store:false, and reasoningEffort
    if (normalizedModelId.startsWith('openai/') && openaiCred?.type === 'oauth') {
      const resolvedModelId = options?.remapForCodexOAuth
        ? remapOpenAIModelForCodexOAuth(normalizedModelId)
        : normalizedModelId;
      const resolvedBareModelId = resolvedModelId.substring('openai/'.length);
      const requestedLevel: ThinkingLevel = options?.thinkingLevel ?? 'medium';
      const effectiveLevel = getEffectiveThinkingLevel(resolvedBareModelId, requestedLevel);
      const reasoningEffort = THINKING_LEVEL_TO_REASONING_EFFORT[effectiveLevel];
      const middleware = createCodexMiddleware(reasoningEffort);

      const openai = createOpenAI({
        apiKey: 'oauth-gateway-placeholder',
        baseURL: gatewayBaseURL,
        headers: {
          [GATEWAY_AUTH_HEADER]: `Bearer ${mgApiKey}`,
          ...headers,
        },
        fetch: buildOpenAICodexOAuthFetch({ authStorage, rewriteUrl: false }) as any,
      });
      return wrapLanguageModel({
        model: openai.responses(resolvedBareModelId),
        middleware: [middleware],
      });
    }

    // All other models: route through MastraGateway + ModelRouterLanguageModel
    const gateway = new MastraGateway({
      apiKey: mgApiKey,
      baseUrl: gatewayBaseURL.replace(/\/v1$/, ''),
    });

    return new ModelRouterLanguageModel({ id: `mastra/${normalizedModelId}` as `${string}/${string}`, headers }, [
      gateway,
    ]);
  }

  const isAnthropicModel = normalizedModelId.startsWith('anthropic/');
  const isOpenAIModel = normalizedModelId.startsWith(OPENAI_PREFIX);
  const isMoonshotModel = normalizedModelId.startsWith('moonshotai/');

  if (isMoonshotModel) {
    if (!process.env.MOONSHOT_AI_API_KEY) {
      throw new Error(`Need MOONSHOT_AI_API_KEY`);
    }
    return createAnthropic({
      apiKey: process.env.MOONSHOT_AI_API_KEY!,
      baseURL: 'https://api.moonshot.ai/anthropic/v1',
      name: 'moonshotai.anthropicv1',
      headers,
    })(normalizedModelId.substring('moonshotai/'.length));
  } else if (isAnthropicModel) {
    const bareModelId = normalizeAnthropicModelId(normalizedModelId.substring('anthropic/'.length));
    const storedCred = authStorage.get('anthropic');

    // Primary path: explicit OAuth credential
    if (storedCred?.type === 'oauth') {
      return opencodeClaudeMaxProvider(bareModelId, { headers });
    }

    // Secondary path: explicit stored API key credential
    if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
      return anthropicApiKeyProvider(bareModelId, storedCred.key.trim(), headers);
    }

    // Fallback: direct API key from AuthStorage
    const apiKey = getAnthropicApiKey();
    if (apiKey) {
      return anthropicApiKeyProvider(bareModelId, apiKey, headers);
    }
    // No auth configured — attempt OAuth provider which will prompt login
    return opencodeClaudeMaxProvider(bareModelId, { headers });
  } else if (isOpenAIModel) {
    const bareModelId = normalizedModelId.substring(OPENAI_PREFIX.length);
    const storedCred = authStorage.get('openai-codex');

    if (storedCred?.type === 'oauth') {
      const resolvedModelId = options?.remapForCodexOAuth
        ? remapOpenAIModelForCodexOAuth(normalizedModelId)
        : normalizedModelId;
      return openaiCodexProvider(resolvedModelId.substring(OPENAI_PREFIX.length), {
        thinkingLevel: options?.thinkingLevel,
        headers,
      });
    }

    const apiKey = getOpenAIApiKey();
    if (apiKey) {
      return openaiApiKeyProvider(bareModelId, apiKey, headers);
    }

    return new ModelRouterLanguageModel({ id: normalizedModelId as `${string}/${string}`, headers });
  } else {
    return new ModelRouterLanguageModel({ id: normalizedModelId as `${string}/${string}`, headers });
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
