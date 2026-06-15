import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { CustomAvailableModel, CustomModelCatalogProvider, HarnessRequestContext } from '@mastra/core/harness';
import { GATEWAY_AUTH_HEADER, MastraGateway, ModelRouterLanguageModel, PROVIDER_REGISTRY } from '@mastra/core/llm';
import type {
  GatewayAuthRequest,
  GatewayAuthResult,
  GatewayLanguageModel,
  MastraModelGatewayInterface,
  ProviderConfig,
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
import { getCopilotModelCatalog, githubCopilotProvider } from '../providers/github-copilot.js';
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

function getAuthProviderId(providerId: string): string {
  return providerId === 'openai' ? 'openai-codex' : providerId;
}

function getProviderAuthKey(providerId: string): string | undefined {
  const authProviderId = getAuthProviderId(providerId);
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

  const storedCred = authStorage.get(getAuthProviderId(request.providerId));
  if (storedCred?.type === 'oauth') {
    return { bearerToken: 'oauth', source: 'gateway' };
  }

  const apiKey = getProviderAuthKey(request.providerId);
  return apiKey ? { apiKey, source: 'gateway' } : undefined;
}

type MastraCodeCustomProvider = { name: string; url: string; apiKey?: string; models?: string[] };

function getGatewayProviderKey(gatewayId: string, providerId: string): string {
  if (gatewayId === 'models.dev') return providerId;
  return providerId === gatewayId ? gatewayId : `${gatewayId}/${providerId}`;
}

function parseGatewayRouterId(
  routerId: string,
  gateway: MastraModelGatewayInterface,
): { gatewayId: string; providerId: string; modelId: string } {
  const [firstPart = '', secondPart = '', ...restParts] = routerId.split('/');
  const gatewayId = gateway.id;

  if (firstPart === gatewayId && secondPart) {
    return {
      gatewayId,
      providerId: secondPart,
      modelId: restParts.join('/'),
    };
  }

  return {
    gatewayId,
    providerId: firstPart,
    modelId: [secondPart, ...restParts].filter(Boolean).join('/'),
  };
}

function hasResolvedAuth(auth: GatewayAuthResult | undefined): boolean {
  if (!auth) return false;
  if (auth.apiKey || auth.bearerToken) return true;
  return auth.headers ? Object.keys(auth.headers).length > 0 : false;
}

async function resolveGatewayProviderAuth(
  gateway: MastraModelGatewayInterface,
  routerId: string,
): Promise<GatewayAuthResult | undefined> {
  if (!gateway.resolveAuth) return undefined;

  const parsed = parseGatewayRouterId(routerId, gateway);
  try {
    const result = await gateway.resolveAuth({
      gatewayId: parsed.gatewayId,
      providerId: parsed.providerId,
      modelId: parsed.modelId,
      routerId,
    });
    return hasResolvedAuth(result) ? result : undefined;
  } catch {
    return undefined;
  }
}

async function getMastraCodeProviderConfigs(
  gateway: MastraModelGatewayInterface,
): Promise<Record<string, ProviderConfig>> {
  const providers: Record<string, ProviderConfig> = { ...(PROVIDER_REGISTRY as Record<string, ProviderConfig>) };

  try {
    const gatewayProviders = await gateway.fetchProviders();
    for (const [providerId, config] of Object.entries(gatewayProviders)) {
      providers[getGatewayProviderKey(gateway.id, providerId)] = {
        ...config,
        gateway: gateway.id,
      };
    }
  } catch (error) {
    console.warn(`Failed to load providers from gateway ${gateway.id}:`, error);
  }

  return providers;
}

function getApiKeyEnvVar(providerConfig: Pick<ProviderConfig, 'apiKeyEnvVar'> | undefined): string | undefined {
  const envVars = providerConfig?.apiKeyEnvVar;
  return Array.isArray(envVars) ? envVars[0] : envVars;
}

export function createMastraCodeModelCatalogProvider(
  gateway: MastraModelGatewayInterface,
): CustomModelCatalogProvider {
  return async () => {
    const registry = await getMastraCodeProviderConfigs(gateway);
    const models: CustomAvailableModel[] = [];

    for (const [provider, providerConfig] of Object.entries(registry)) {
      const apiKeyEnvVar = getApiKeyEnvVar(providerConfig);
      const hasEnvKey = apiKeyEnvVar ? Boolean(process.env[apiKeyEnvVar]) : false;
      const modelNames = providerConfig.models;
      if (!Array.isArray(modelNames)) continue;

      for (const modelName of modelNames) {
        const id = `${provider}/${modelName}`;
        const gatewayAuth = await resolveGatewayProviderAuth(gateway, id);
        models.push({
          id,
          provider,
          modelName,
          hasApiKey: hasEnvKey || Boolean(gatewayAuth),
          apiKeyEnvVar: apiKeyEnvVar || undefined,
        });
      }
    }

    return models;
  };
}

export function createMastraCodeGateway({
  mastraGatewayBaseUrl,
  mastraGatewayApiKey,
  routeThroughMastraGateway,
  thinkingLevel,
  customProviders,
  settingsPath,
}: {
  mastraGatewayBaseUrl: string;
  mastraGatewayApiKey?: string;
  routeThroughMastraGateway: boolean;
  thinkingLevel?: ThinkingLevel;
  customProviders?: MastraCodeCustomProvider[];
  settingsPath?: string;
}): MastraModelGatewayInterface {
  const mastraGateway = new MastraGateway({ baseUrl: mastraGatewayBaseUrl });
  const getCustomProviders = (): MastraCodeCustomProvider[] => customProviders ?? loadSettings(settingsPath).customProviders;

  return {
    id: MASTRACODE_GATEWAY_ID,
    name: 'MastraCode Gateway',
    async fetchProviders() {
      const providers: Record<string, ProviderConfig> = {};
      for (const provider of getCustomProviders()) {
        const models = provider.models ?? [];
        if (!models.length) continue;
        providers[getCustomProviderId(provider.name)] = {
          name: provider.name,
          url: provider.url,
          apiKeyEnvVar: '',
          apiKeyHeader: 'Authorization',
          gateway: MASTRACODE_GATEWAY_ID,
          models,
        };
      }

      try {
        const copilotModels = await getCopilotModelCatalog({ authStorage });
        providers['github-copilot'] = {
          name: 'GitHub Copilot',
          apiKeyEnvVar: '',
          apiKeyHeader: 'Authorization',
          gateway: MASTRACODE_GATEWAY_ID,
          models: copilotModels.map(model => model.id),
        };
      } catch (error) {
        console.warn('Failed to load GitHub Copilot model catalog:', error);
      }

      return providers;
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

      const customProvider = getCustomProviders().find(provider => request.providerId === getCustomProviderId(provider.name));
      if (customProvider?.apiKey) {
        return { apiKey: customProvider.apiKey, source: 'gateway' };
      }

      return resolveAuth(request);
    },
    resolveLanguageModel(args: GatewayResolveLanguageModelArgs) {
      const customProvider = getCustomProviders().find(provider => args.providerId === getCustomProviderId(provider.name));
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
): ModelRouterLanguageModel {
  authStorage.reload();
  const headers = getHarnessHeaders(options?.requestContext);
  const settings = loadSettings();
  const isMastraGatewayModel = modelId.startsWith(MASTRA_GATEWAY_PREFIX);
  const normalizedModelId = stripMastraGatewayPrefix(modelId);

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
 *
 * `settingsPath` must be the same source `createMastraCode()` reads from so the
 * judge model and the goal budget (`goalMaxTurns`) come from one config — with a
 * custom `settingsPath` a bare `loadSettings()` here could read a different file
 * and silently turn the goal step into a no-op.
 */
export function getGoalJudgeModel(
  { requestContext }: { requestContext: RequestContext },
  settingsPath?: string,
): ResolvedModel | undefined {
  const judgeModelId = loadSettings(settingsPath).models.goalJudgeModel;
  if (!judgeModelId) return undefined;
  return resolveModel(judgeModelId, { remapForCodexOAuth: true, requestContext });
}
