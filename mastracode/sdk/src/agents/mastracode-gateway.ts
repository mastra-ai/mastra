import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { CustomAvailableModel, CustomModelCatalogProvider } from '@mastra/core/agent-controller';
import {
  GATEWAY_AUTH_HEADER,
  MastraGateway,
  MastraModelGateway,
  ModelRouterLanguageModel,
  PROVIDER_REGISTRY,
} from '@mastra/core/llm';
import type {
  GatewayAuthRequest,
  GatewayAuthResult,
  GatewayLanguageModel,
  MastraModelGatewayInterface,
  ProviderConfig,
} from '@mastra/core/llm';
import { wrapLanguageModel } from 'ai';
import { AuthStorage } from '../auth/storage.js';
import type { CredentialStore } from '../auth/types.js';
import { getCustomProviderId, loadSettings, MASTRA_GATEWAY_PROVIDER } from '../onboarding/settings.js';
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
import { xaiProvider } from '../providers/xai.js';
import { resolveCustomProviders } from './custom-provider-source.js';

export const OPENAI_PREFIX = 'openai/';
export const MASTRA_GATEWAY_PREFIX = 'mastra/';
export const MASTRACODE_GATEWAY_ID = 'mastracode';

const CODEX_OPENAI_MODEL_REMAPS: Record<string, string> = {
  'gpt-5.3': 'gpt-5.3-codex',
  'gpt-5.2': 'gpt-5.2-codex',
  'gpt-5.1': 'gpt-5.1-codex',
  'gpt-5.1-mini': 'gpt-5.1-codex-mini',
  'gpt-5': 'gpt-5-codex',
};

type ModelRequestHeaders = Record<string, string>;

export type MastraCodeCustomProvider = { name: string; url: string; apiKey?: string; models?: string[] };

export type MastraCodeGatewayOptions = {
  mastraGatewayBaseUrl: string;
  mastraGatewayApiKey?: string;
  routeThroughMastraGateway: boolean;
  thinkingLevel?: ThinkingLevel;
  customProviders?: MastraCodeCustomProvider[];
  settingsPath?: string;
  /**
   * Per-tenant credential source for this gateway instance. Defaults to the
   * server-global file-backed `AuthStorage`; deployed web passes the calling
   * tenant's store so model calls use the caller's own credentials.
   */
  credentialStore?: CredentialStore;
};

const authStorage = new AuthStorage();

export function reloadAuthStorage() {
  authStorage.reload();
}

export function stripMastraGatewayPrefix(modelId: string): string {
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
export function getAnthropicApiKey(credentials: CredentialStore = authStorage): string | undefined {
  const storedCred = credentials.get('anthropic');
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  const dedicatedKey = credentials.getStoredApiKey('anthropic')?.trim();
  if (dedicatedKey) return dedicatedKey;
  return credentials.allowEnvironmentFallback === false
    ? undefined
    : process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

/**
 * Resolve the OpenAI API key.
 * Main slot → dedicated apikey: slot → env var.
 */
export function getOpenAIApiKey(credentials: CredentialStore = authStorage): string | undefined {
  const storedCred = credentials.get('openai-codex');
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  const dedicatedKey = credentials.getStoredApiKey('openai-codex')?.trim();
  if (dedicatedKey) return dedicatedKey;
  return credentials.allowEnvironmentFallback === false ? undefined : process.env.OPENAI_API_KEY?.trim() || undefined;
}

function anthropicApiKeyProvider(modelId: string, apiKey: string, headers?: ModelRequestHeaders) {
  const anthropic = createAnthropic({ apiKey, headers });
  return wrapLanguageModel({
    model: anthropic(modelId),
    middleware: [promptCacheMiddleware],
  });
}

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

function getProviderAuthKey(providerId: string, credentials: CredentialStore = authStorage): string | undefined {
  const authProviderId = getAuthProviderId(providerId);
  const storedCred = credentials.get(authProviderId);
  if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
    return storedCred.key.trim();
  }
  return credentials.getStoredApiKey(authProviderId)?.trim() || undefined;
}

export function resolveAuth(request: GatewayAuthRequest, mastraGatewayApiKey?: string): GatewayAuthResult | undefined {
  return MastraCodeGateway.resolveProviderAuth(request, mastraGatewayApiKey);
}

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

export class MastraCodeGateway extends MastraModelGateway {
  readonly id = MASTRACODE_GATEWAY_ID;
  readonly name = 'MastraCode Gateway';

  readonly #mastraGateway: MastraGateway;
  readonly #mastraGatewayBaseUrl: string;
  readonly #mastraGatewayApiKey?: string;
  readonly #routeThroughMastraGateway: boolean;
  readonly #thinkingLevel?: ThinkingLevel;
  readonly #customProviders?: MastraCodeCustomProvider[];
  readonly #settingsPath?: string;
  readonly #credentials: CredentialStore;

  constructor({
    mastraGatewayBaseUrl,
    mastraGatewayApiKey,
    routeThroughMastraGateway,
    thinkingLevel,
    customProviders,
    settingsPath,
    credentialStore,
  }: MastraCodeGatewayOptions) {
    super();
    this.#mastraGateway = new MastraGateway({ baseUrl: mastraGatewayBaseUrl });
    this.#mastraGatewayBaseUrl = mastraGatewayBaseUrl;
    this.#mastraGatewayApiKey = mastraGatewayApiKey;
    this.#routeThroughMastraGateway = routeThroughMastraGateway;
    this.#thinkingLevel = thinkingLevel;
    this.#customProviders = customProviders;
    this.#settingsPath = settingsPath;
    this.#credentials = credentialStore ?? authStorage;
  }

  static getMastraGatewayApiKey(): string | undefined {
    return authStorage.getStoredApiKey(MASTRA_GATEWAY_PROVIDER) ?? process.env['MASTRA_GATEWAY_API_KEY'];
  }

  /** @deprecated Renamed to {@link MastraCodeGateway.getMastraGatewayApiKey}. */
  static getMemoryGatewayApiKey(): string | undefined {
    return MastraCodeGateway.getMastraGatewayApiKey();
  }

  /**
   * Claim an unprefixed model id (e.g. a bare `anthropic/...`) when this gateway
   * can authenticate it via OAuth or a stored/env credential. This lets the
   * shared gateway router select MastraCode for auth resolution, so the status
   * bar and `/api-keys` reflect OAuth logins instead of only checking env vars.
   */
  handlesModel(modelId: string): boolean {
    const parsed = parseGatewayRouterId(modelId, this);
    if (!parsed.providerId || !parsed.modelId) return false;
    if (this.#routeThroughMastraGateway && this.#mastraGatewayApiKey) return true;
    const customProvider = this.#getCustomProviders().find(
      provider => parsed.providerId === getCustomProviderId(provider.name),
    );
    if (customProvider?.apiKey) return true;
    return hasResolvedAuth(
      MastraCodeGateway.resolveProviderAuth(
        {
          gatewayId: this.id,
          providerId: parsed.providerId,
          modelId: parsed.modelId,
          routerId: modelId,
        },
        undefined,
        this.#credentials,
      ),
    );
  }

  static resolveProviderAuth(
    request: GatewayAuthRequest,
    mastraGatewayApiKey?: string,
    credentials: CredentialStore = authStorage,
  ): GatewayAuthResult | undefined {
    if (request.gatewayId === 'mastra' && mastraGatewayApiKey) {
      return { apiKey: mastraGatewayApiKey, source: 'gateway' };
    }

    const storedCred = credentials.get(getAuthProviderId(request.providerId));
    if (storedCred?.type === 'oauth') {
      return { bearerToken: 'oauth', source: 'gateway' };
    }

    const apiKey = getProviderAuthKey(request.providerId, credentials);
    return apiKey ? { apiKey, source: 'gateway' } : undefined;
  }

  static createModelCatalogProvider(gateway: MastraModelGatewayInterface): CustomModelCatalogProvider {
    return async () => {
      const registry = await getMastraCodeProviderConfigs(gateway);
      const models: CustomAvailableModel[] = [];

      for (const [provider, providerConfig] of Object.entries(registry)) {
        const apiKeyEnvVar = getApiKeyEnvVar(providerConfig);
        const hasEnvKey = apiKeyEnvVar ? Boolean(process.env[apiKeyEnvVar]) : false;
        const modelNames = providerConfig.models;
        if (!Array.isArray(modelNames)) continue;

        const gatewayAuth = modelNames[0]
          ? await resolveGatewayProviderAuth(gateway, `${provider}/${modelNames[0]}`)
          : undefined;

        for (const modelName of modelNames) {
          const id = `${provider}/${modelName}`;
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

  createModelCatalogProvider(): CustomModelCatalogProvider {
    return MastraCodeGateway.createModelCatalogProvider(this);
  }

  #getCustomProviders(): MastraCodeCustomProvider[] {
    // Explicit constructor list wins; then a registered source (deployed web,
    // DB-backed — authoritative, so settings.json is never consulted); then
    // the local file-backed settings.
    return this.#customProviders ?? resolveCustomProviders() ?? loadSettings(this.#settingsPath).customProviders;
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const providers: Record<string, ProviderConfig> = {};
    for (const provider of this.#getCustomProviders()) {
      const models = provider.models ?? [];
      if (!models.length) continue;
      providers[getCustomProviderId(provider.name)] = {
        name: provider.name,
        url: provider.url,
        apiKeyEnvVar: '',
        apiKeyHeader: 'Authorization',
        gateway: this.id,
        models,
      };
    }

    try {
      const copilotModels = await getCopilotModelCatalog({ authStorage });
      providers['github-copilot'] = {
        name: 'GitHub Copilot',
        apiKeyEnvVar: '',
        apiKeyHeader: 'Authorization',
        gateway: this.id,
        models: copilotModels.map(model => model.id),
      };
    } catch (error) {
      console.warn('Failed to load GitHub Copilot model catalog:', error);
    }

    return providers;
  }

  buildUrl(modelId: string): string | undefined | Promise<string | undefined> {
    return this.#routeThroughMastraGateway ? this.#mastraGateway.buildUrl(modelId) : modelId;
  }

  async getApiKey(modelId: string): Promise<string> {
    const providerId = stripMastraGatewayPrefix(modelId).split('/', 1)[0];
    if (this.#routeThroughMastraGateway) return this.#mastraGatewayApiKey ?? '';
    return providerId ? (getProviderAuthKey(providerId, this.#credentials) ?? '') : '';
  }

  resolveAuth(request: GatewayAuthRequest): GatewayAuthResult | undefined {
    if (this.#routeThroughMastraGateway && this.#mastraGatewayApiKey) {
      return { apiKey: this.#mastraGatewayApiKey, source: 'gateway' };
    }

    const customProvider = this.#getCustomProviders().find(
      provider => request.providerId === getCustomProviderId(provider.name),
    );
    if (customProvider?.apiKey) {
      return { apiKey: customProvider.apiKey, source: 'gateway' };
    }

    return MastraCodeGateway.resolveProviderAuth(request, undefined, this.#credentials);
  }

  resolveLanguageModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: any;
    responsesWebSocket?: any;
  }): GatewayLanguageModel {
    const customProvider = this.#getCustomProviders().find(
      provider => args.providerId === getCustomProviderId(provider.name),
    );
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
      return githubCopilotProvider(args.modelId, {
        headers: args.headers,
        authStorage: this.#credentials,
      }) as unknown as GatewayLanguageModel;
    }

    if (args.providerId === 'moonshotai') {
      // Prefer the gateway-resolved key (stored credentials), then the canonical
      // registry env var. Keep the legacy typo name as a fallback for anyone who
      // set it because of the previous error message.
      const apiKey =
        args.apiKey?.trim() || process.env.MOONSHOT_API_KEY?.trim() || process.env.MOONSHOT_AI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('Need MOONSHOT_API_KEY');
      }
      return createAnthropic({
        apiKey,
        baseURL: 'https://api.moonshot.ai/anthropic/v1',
        name: 'moonshotai.anthropicv1',
        headers: args.headers,
      })(args.modelId) as unknown as GatewayLanguageModel;
    }

    if (args.providerId === 'anthropic') {
      return this.#resolveAnthropicModel(args);
    }

    if (args.providerId === 'openai') {
      const openaiModel = this.#resolveOpenAIModel(args);
      if (openaiModel) return openaiModel;
    }

    if (args.providerId === 'xai' && this.#credentials.get('xai')?.type === 'oauth') {
      return xaiProvider(args.modelId, {
        headers: args.headers,
        authStorage: this.#credentials,
      }) as unknown as GatewayLanguageModel;
    }

    if (this.#routeThroughMastraGateway) {
      return this.#mastraGateway.resolveLanguageModel(args) as GatewayLanguageModel;
    }

    return new ModelRouterLanguageModel({
      id: `${args.providerId}/${args.modelId}` as `${string}/${string}`,
      apiKey: args.apiKey,
      headers: args.headers,
    }) as unknown as GatewayLanguageModel;
  }

  #resolveAnthropicModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: any;
    responsesWebSocket?: any;
  }): GatewayLanguageModel {
    const bareModelId = normalizeAnthropicModelId(args.modelId);
    const storedCred = this.#credentials.get('anthropic');

    if (this.#routeThroughMastraGateway) {
      if (storedCred?.type === 'oauth') {
        const anthropic = createAnthropic({
          apiKey: 'oauth-gateway-placeholder',
          baseURL: `${this.#mastraGatewayBaseUrl}/v1`,
          headers: {
            [GATEWAY_AUTH_HEADER]: `Bearer ${args.apiKey}`,
            ...args.headers,
          },
          fetch: buildAnthropicOAuthFetch({ authStorage: this.#credentials }) as any,
        });

        return wrapLanguageModel({
          model: anthropic(bareModelId),
          middleware: [claudeCodeMiddleware, promptCacheMiddleware],
        }) as unknown as GatewayLanguageModel;
      }

      return this.#mastraGateway.resolveLanguageModel({ ...args, modelId: bareModelId }) as GatewayLanguageModel;
    }

    if (storedCred?.type === 'oauth') {
      return opencodeClaudeMaxProvider(bareModelId, {
        headers: args.headers,
        authStorage: this.#credentials,
      }) as unknown as GatewayLanguageModel;
    }

    if (storedCred?.type === 'api_key' && storedCred.key.trim().length > 0) {
      return anthropicApiKeyProvider(
        bareModelId,
        storedCred.key.trim(),
        args.headers,
      ) as unknown as GatewayLanguageModel;
    }

    const apiKey = getAnthropicApiKey(this.#credentials);
    if (apiKey) {
      return anthropicApiKeyProvider(bareModelId, apiKey, args.headers) as unknown as GatewayLanguageModel;
    }

    // No stored credentials: use the OAuth-backed provider so the first request can trigger login.
    return opencodeClaudeMaxProvider(bareModelId, {
      headers: args.headers,
      authStorage: this.#credentials,
    }) as unknown as GatewayLanguageModel;
  }

  #resolveOpenAIModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: any;
    responsesWebSocket?: any;
  }): GatewayLanguageModel | undefined {
    const storedCred = this.#credentials.get('openai-codex');

    if (this.#routeThroughMastraGateway) {
      if (storedCred?.type === 'oauth') {
        const resolvedModelId = remapOpenAIModelForCodexOAuth(`openai/${args.modelId}`);
        const resolvedBareModelId = resolvedModelId.substring(OPENAI_PREFIX.length);
        const requestedLevel: ThinkingLevel = this.#thinkingLevel ?? 'medium';
        const effectiveLevel = getEffectiveThinkingLevel(resolvedBareModelId, requestedLevel);
        const reasoningEffort = THINKING_LEVEL_TO_REASONING_EFFORT[effectiveLevel];
        const middleware = createCodexMiddleware(reasoningEffort);
        const openai = createOpenAI({
          apiKey: 'oauth-gateway-placeholder',
          baseURL: `${this.#mastraGatewayBaseUrl}/v1`,
          headers: {
            [GATEWAY_AUTH_HEADER]: `Bearer ${args.apiKey}`,
            ...args.headers,
          },
          fetch: buildOpenAICodexOAuthFetch({ authStorage: this.#credentials, rewriteUrl: false }) as any,
        });

        return wrapLanguageModel({
          model: openai.responses(resolvedBareModelId),
          middleware: [middleware],
        }) as unknown as GatewayLanguageModel;
      }

      return this.#mastraGateway.resolveLanguageModel(args) as GatewayLanguageModel;
    }

    if (storedCred?.type === 'oauth') {
      const resolvedModelId = remapOpenAIModelForCodexOAuth(`openai/${args.modelId}`);
      return openaiCodexProvider(resolvedModelId.substring(OPENAI_PREFIX.length), {
        thinkingLevel: this.#thinkingLevel,
        headers: args.headers,
        authStorage: this.#credentials,
      }) as unknown as GatewayLanguageModel;
    }

    const apiKey = getOpenAIApiKey(this.#credentials);
    if (apiKey) {
      return openaiApiKeyProvider(args.modelId, apiKey, args.headers) as unknown as GatewayLanguageModel;
    }

    return undefined;
  }
}
