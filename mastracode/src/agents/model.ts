import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { GATEWAY_AUTH_HEADER, MastraGateway, ModelRouterLanguageModel } from '@mastra/core/llm';
import type {
  GatewayAuthRequest,
  GatewayAuthResult,
  GatewayLanguageModel,
  MastraModelGatewayInterface,
} from '@mastra/core/llm';
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
import { githubCopilotProvider } from '../providers/github-copilot.js';
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
const MASTRACODE_GATEWAY_ID = 'mastracode';

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
  | ReturnType<typeof githubCopilotProvider>
  | ModelRouterLanguageModel
  | ReturnType<ReturnType<typeof createAnthropic>>
  | ReturnType<ReturnType<typeof createOpenAI>>;

type ModelRequestHeaders = Record<string, string>;
type GatewayResolveLanguageModelArgs = {
  modelId: string;
  providerId: string;
  apiKey: string;
  headers?: Record<string, string>;
  transport?: any;
  responsesWebSocket?: any;
};

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
 * Resolve the Anthropic API key.
 * Main slot → dedicated apikey: slot → env var.
 */
export function getAnthropicApiKey(): string | undefined {
  const storedCred = authStorage.get('anthropic');
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  const dedicatedKey = authStorage.getStoredApiKey('anthropic')?.trim();
  if (dedicatedKey) return dedicatedKey;
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

/**
 * Resolve the OpenAI API key.
 * Main slot → dedicated apikey: slot → env var.
 */
export function getOpenAIApiKey(): string | undefined {
  const storedCred = authStorage.get('openai-codex');
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  const dedicatedKey = authStorage.getStoredApiKey('openai-codex')?.trim();
  if (dedicatedKey) return dedicatedKey;
  return process.env.OPENAI_API_KEY?.trim() || undefined;
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
  const openai = createOpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL, headers });
  return wrapLanguageModel({
    model: openai.responses(modelId),
    middleware: [],
  });
}

function getProviderAuthKey(providerId: string): string | undefined {
  const authProviderId = providerId === 'openai' ? 'openai-codex' : providerId;
  const storedCred = authStorage.get(authProviderId);
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  return authStorage.getStoredApiKey(authProviderId)?.trim() || undefined;
}

export function resolveAuth(request: GatewayAuthRequest, memoryGatewayApiKey?: string): GatewayAuthResult | undefined {
  if (request.gatewayId === 'mastra' && memoryGatewayApiKey) {
    return { apiKey: memoryGatewayApiKey, source: 'gateway' };
  }

  const apiKey = getProviderAuthKey(request.providerId);
  return apiKey ? { apiKey, source: 'gateway' } : undefined;
}

function createMastraCodeGateway({
  mastraGatewayBaseUrl,
  mastraGatewayApiKey,
  routeThroughMastraGateway,
  thinkingLevel,
  customProviders,
}: {
  mastraGatewayBaseUrl: string;
  mastraGatewayApiKey?: string;
  routeThroughMastraGateway: boolean;
  thinkingLevel?: ThinkingLevel;
  customProviders: Array<{ name: string; url: string; apiKey?: string }>;
}): MastraModelGatewayInterface {
  const mastraGateway = new MastraGateway({ baseUrl: mastraGatewayBaseUrl });

  return {
    id: MASTRACODE_GATEWAY_ID,
    name: 'MastraCode Gateway',
    async fetchProviders() {
      return {};
    },
    buildUrl(modelId: string) {
      return routeThroughMastraGateway ? mastraGateway.buildUrl(modelId) : modelId;
    },
    async getApiKey(modelId: string) {
      const providerId = stripMastraGatewayPrefix(modelId).split('/', 1)[0];
      if (routeThroughMastraGateway) return mastraGatewayApiKey ?? '';
      return providerId ? (getProviderAuthKey(providerId) ?? '') : '';
    },
    resolveAuth(request: GatewayAuthRequest) {
      if (routeThroughMastraGateway && mastraGatewayApiKey) {
        return { apiKey: mastraGatewayApiKey, source: 'gateway' };
      }

      const customProvider = customProviders.find(
        provider => request.providerId === getCustomProviderId(provider.name),
      );
      if (customProvider?.apiKey) {
        return { apiKey: customProvider.apiKey, source: 'gateway' };
      }

      return resolveAuth(request);
    },
    resolveLanguageModel(args: GatewayResolveLanguageModelArgs) {
      const customProvider = customProviders.find(provider => args.providerId === getCustomProviderId(provider.name));
      if (customProvider) {
        const provider = createOpenAICompatible({
          name: args.providerId,
          baseURL: customProvider.url,
          apiKey: args.apiKey,
          headers: args.headers,
        });
        return provider.chatModel(args.modelId) as unknown as GatewayLanguageModel;
      }

      if (args.providerId === 'github-copilot') {
        return githubCopilotProvider(args.modelId, { headers: args.headers }) as unknown as GatewayLanguageModel;
      }

      if (args.providerId === 'moonshotai') {
        if (!process.env.MOONSHOT_AI_API_KEY) {
          throw new Error(`Need MOONSHOT_AI_API_KEY`);
        }
        return createAnthropic({
          apiKey: process.env.MOONSHOT_AI_API_KEY,
          baseURL: 'https://api.moonshot.ai/anthropic/v1',
          name: 'moonshotai.anthropicv1',
          headers: args.headers,
        })(args.modelId) as unknown as GatewayLanguageModel;
      }

      if (args.providerId === 'anthropic') {
        const bareModelId = normalizeAnthropicModelId(args.modelId);
        const storedCred = authStorage.get('anthropic');

        if (routeThroughMastraGateway) {
          if (storedCred?.type === 'oauth') {
            const anthropic = createAnthropic({
              apiKey: 'oauth-gateway-placeholder',
              baseURL: `${mastraGatewayBaseUrl}/v1`,
              headers: {
                [GATEWAY_AUTH_HEADER]: `Bearer ${args.apiKey}`,
                ...args.headers,
              },
              fetch: buildAnthropicOAuthFetch({ authStorage }) as any,
            });

            return wrapLanguageModel({
              model: anthropic(bareModelId),
              middleware: [claudeCodeMiddleware, promptCacheMiddleware],
            }) as unknown as GatewayLanguageModel;
          }

          return mastraGateway.resolveLanguageModel({ ...args, modelId: bareModelId });
        }

        if (storedCred?.type === 'oauth') {
          return opencodeClaudeMaxProvider(bareModelId, { headers: args.headers }) as unknown as GatewayLanguageModel;
        }

        if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
          return anthropicApiKeyProvider(
            bareModelId,
            storedCred.key.trim(),
            args.headers,
          ) as unknown as GatewayLanguageModel;
        }

        const apiKey = getAnthropicApiKey();
        if (apiKey) {
          return anthropicApiKeyProvider(bareModelId, apiKey, args.headers) as unknown as GatewayLanguageModel;
        }

        return opencodeClaudeMaxProvider(bareModelId, { headers: args.headers }) as unknown as GatewayLanguageModel;
      }

      if (args.providerId === 'openai') {
        const storedCred = authStorage.get('openai-codex');

        if (routeThroughMastraGateway) {
          if (storedCred?.type === 'oauth') {
            const resolvedModelId = remapOpenAIModelForCodexOAuth(`openai/${args.modelId}`);
            const resolvedBareModelId = resolvedModelId.substring(OPENAI_PREFIX.length);
            const requestedLevel: ThinkingLevel = thinkingLevel ?? 'medium';
            const effectiveLevel = getEffectiveThinkingLevel(resolvedBareModelId, requestedLevel);
            const reasoningEffort = THINKING_LEVEL_TO_REASONING_EFFORT[effectiveLevel];
            const middleware = createCodexMiddleware(reasoningEffort);
            const openai = createOpenAI({
              apiKey: 'oauth-gateway-placeholder',
              baseURL: `${mastraGatewayBaseUrl}/v1`,
              headers: {
                [GATEWAY_AUTH_HEADER]: `Bearer ${args.apiKey}`,
                ...args.headers,
              },
              fetch: buildOpenAICodexOAuthFetch({ authStorage, rewriteUrl: false }) as any,
            });

            return wrapLanguageModel({
              model: openai.responses(resolvedBareModelId),
              middleware: [middleware],
            }) as unknown as GatewayLanguageModel;
          }

          return mastraGateway.resolveLanguageModel(args);
        }

        if (storedCred?.type === 'oauth') {
          const resolvedModelId = remapOpenAIModelForCodexOAuth(`openai/${args.modelId}`);
          return openaiCodexProvider(resolvedModelId.substring(OPENAI_PREFIX.length), {
            thinkingLevel,
            headers: args.headers,
          }) as unknown as GatewayLanguageModel;
        }

        const apiKey = getOpenAIApiKey();
        if (apiKey) {
          return openaiApiKeyProvider(args.modelId, apiKey, args.headers) as unknown as GatewayLanguageModel;
        }
      }

      if (routeThroughMastraGateway) {
        return mastraGateway.resolveLanguageModel(args);
      }

      return new ModelRouterLanguageModel({
        id: `${args.providerId}/${args.modelId}` as `${string}/${string}`,
        headers: args.headers,
      }) as unknown as GatewayLanguageModel;
    },
    serializeForSpan() {
      return { id: MASTRACODE_GATEWAY_ID, name: 'MastraCode Gateway' };
    },
  };
}

/**
 * Placeholder for future model ID normalization.
 * Currently returns the input unchanged, but exists as a seam
 * for aliasing, casing fixes, or validation in the future.
 */
export function resolveModelId(modelId: string): string {
  return modelId;
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
  const settings = loadSettings();
  const resolvedRouterModelId = resolveModelId(modelId);
  const isMastraGatewayModel = resolvedRouterModelId.startsWith(MASTRA_GATEWAY_PREFIX);
  const normalizedModelId = stripMastraGatewayPrefix(resolvedRouterModelId);

  const mgApiKey = authStorage.getStoredApiKey(MEMORY_GATEWAY_PROVIDER) ?? process.env['MASTRA_GATEWAY_API_KEY'];
  const rawGatewayBase =
    settings.memoryGateway?.baseUrl ?? process.env['MASTRA_GATEWAY_URL'] ?? 'https://gateway-api.mastra.ai';
  const gateway = createMastraCodeGateway({
    mastraGatewayBaseUrl: rawGatewayBase.replace(/\/+$/, '').replace(/\/v1$/, ''),
    mastraGatewayApiKey: mgApiKey,
    routeThroughMastraGateway: Boolean(mgApiKey && isMastraGatewayModel),
    thinkingLevel: options?.thinkingLevel,
    customProviders: settings.customProviders,
  });

  return new ModelRouterLanguageModel(
    { id: `${MASTRACODE_GATEWAY_ID}/${normalizedModelId}` as `${string}/${string}`, headers },
    [gateway],
  );
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

  return resolveModel(modelId, { thinkingLevel, remapForCodexOAuth: true, requestContext });
}

/**
 * Goal judge model resolver for the agent's `goal.judge` config. Resolves the
 * configured goal judge model through mastracode's gateway so provider
 * credentials (stored in auth storage, not just env) are injected — a bare model
 * id handed to core's default model router would fail to find the API key.
 *
 * Returns `undefined` when no judge model is configured, which keeps the goal
 * step a complete no-op (the goal mechanism requires a judge to do anything).
 */
export function getGoalJudgeModel({
  requestContext,
}: {
  requestContext: RequestContext;
}): ResolvedModel | undefined {
  const judgeModelId = loadSettings().models.goalJudgeModel;
  if (!judgeModelId) return undefined;
  return resolveModel(judgeModelId, { remapForCodexOAuth: true, requestContext });
}
