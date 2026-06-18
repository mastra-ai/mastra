import { existsSync } from 'node:fs';
import path from 'node:path';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { CustomAvailableModel, CustomModelCatalogProvider } from '@mastra/core/harness';
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
import { getCustomProviderId, loadSettings, MEMORY_GATEWAY_PROVIDER } from '../onboarding/settings.js';
import { getBedrockModelCatalog } from '../providers/amazon-bedrock.js';
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

/**
 * Best-effort, synchronous check for whether AWS credentials are available for
 * Amazon Bedrock. The actual resolution happens through the AWS provider chain
 * at request time; this only governs whether Bedrock models are offered as
 * "authenticated" in the picker. We look for the common signals (env vars,
 * bearer token, a configured profile, or a shared credentials/config file)
 * rather than resolving credentials here, since the auth checker must stay sync.
 */
export function hasAwsCredentials(): boolean {
  if (
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    process.env.AWS_SHARED_CREDENTIALS_FILE ||
    process.env.AWS_CONFIG_FILE ||
    process.env.AWS_PROFILE ||
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE
  ) {
    return true;
  }
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    const awsDir = path.join(home, '.aws');
    const credentialsPath = process.env.AWS_SHARED_CREDENTIALS_FILE ?? path.join(awsDir, 'credentials');
    const configPath = process.env.AWS_CONFIG_FILE ?? path.join(awsDir, 'config');
    if (existsSync(credentialsPath) || existsSync(configPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Create an Amazon Bedrock model.
 *
 * Bedrock authenticates with AWS SigV4 rather than a bearer API key, so this
 * resolves credentials through the standard AWS provider chain
 * (`fromNodeProviderChain`): environment variables, shared `~/.aws` config and
 * SSO profiles, and container/instance roles — the same resolution order the AWS
 * CLI uses. The region falls back to `us-east-1` to match the AWS SDK default.
 *
 * When `AWS_BEARER_TOKEN_BEDROCK` is set, `@ai-sdk/amazon-bedrock` uses bearer
 * auth instead and ignores the credential provider, so we leave that path to the
 * SDK and only wire up SigV4 here.
 */
function bedrockProvider(modelId: string, headers?: ModelRequestHeaders) {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const bedrock = createAmazonBedrock({
    region,
    credentialProvider: fromNodeProviderChain(),
    headers,
  });
  return bedrock(modelId);
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
  return MastraCodeGateway.resolveProviderAuth(request, memoryGatewayApiKey);
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

  constructor({
    mastraGatewayBaseUrl,
    mastraGatewayApiKey,
    routeThroughMastraGateway,
    thinkingLevel,
    customProviders,
    settingsPath,
  }: MastraCodeGatewayOptions) {
    super();
    this.#mastraGateway = new MastraGateway({ baseUrl: mastraGatewayBaseUrl });
    this.#mastraGatewayBaseUrl = mastraGatewayBaseUrl;
    this.#mastraGatewayApiKey = mastraGatewayApiKey;
    this.#routeThroughMastraGateway = routeThroughMastraGateway;
    this.#thinkingLevel = thinkingLevel;
    this.#customProviders = customProviders;
    this.#settingsPath = settingsPath;
  }

  static getMemoryGatewayApiKey(): string | undefined {
    return authStorage.getStoredApiKey(MEMORY_GATEWAY_PROVIDER) ?? process.env['MASTRA_GATEWAY_API_KEY'];
  }

  static resolveProviderAuth(request: GatewayAuthRequest, memoryGatewayApiKey?: string): GatewayAuthResult | undefined {
    if (request.gatewayId === 'mastra' && memoryGatewayApiKey) {
      return { apiKey: memoryGatewayApiKey, source: 'gateway' };
    }

    // Amazon Bedrock authenticates via the AWS credential chain rather than a
    // stored API key, so report it as authenticated whenever AWS credentials look
    // available. The actual SigV4 signing happens inside `bedrockProvider()`.
    if (request.providerId === 'amazon-bedrock' && hasAwsCredentials()) {
      return { apiKey: 'aws-credential-chain', source: 'gateway' };
    }

    const storedCred = authStorage.get(getAuthProviderId(request.providerId));
    if (storedCred?.type === 'oauth') {
      return { bearerToken: 'oauth', source: 'gateway' };
    }

    const apiKey = getProviderAuthKey(request.providerId);
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
    return this.#customProviders ?? loadSettings(this.#settingsPath).customProviders;
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

    // Amazon Bedrock is resolved directly (AWS SigV4) rather than through the
    // gateway-synced model router, so its models are surfaced from the public
    // models.dev catalog. Only offer them when AWS credentials look available,
    // to avoid cluttering the picker with unusable models.
    if (hasAwsCredentials()) {
      try {
        const bedrockModels = await getBedrockModelCatalog();
        providers['amazon-bedrock'] = {
          name: 'Amazon Bedrock',
          apiKeyEnvVar: '',
          apiKeyHeader: 'Authorization',
          gateway: this.id,
          models: bedrockModels.map(model => model.id),
        };
      } catch (error) {
        console.warn('Failed to load Amazon Bedrock model catalog:', error);
      }
    }

    return providers;
  }

  buildUrl(modelId: string): string | undefined | Promise<string | undefined> {
    return this.#routeThroughMastraGateway ? this.#mastraGateway.buildUrl(modelId) : modelId;
  }

  async getApiKey(modelId: string): Promise<string> {
    const providerId = stripMastraGatewayPrefix(modelId).split('/', 1)[0];
    if (this.#routeThroughMastraGateway) return this.#mastraGatewayApiKey ?? '';
    return providerId ? (getProviderAuthKey(providerId) ?? '') : '';
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

    return MastraCodeGateway.resolveProviderAuth(request);
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
      return githubCopilotProvider(args.modelId, { headers: args.headers }) as unknown as GatewayLanguageModel;
    }

    if (args.providerId === 'amazon-bedrock') {
      return bedrockProvider(args.modelId, args.headers) as unknown as GatewayLanguageModel;
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
      return this.#resolveAnthropicModel(args);
    }

    if (args.providerId === 'openai') {
      const openaiModel = this.#resolveOpenAIModel(args);
      if (openaiModel) return openaiModel;
    }

    if (this.#routeThroughMastraGateway) {
      return this.#mastraGateway.resolveLanguageModel(args) as GatewayLanguageModel;
    }

    return new ModelRouterLanguageModel({
      id: `${args.providerId}/${args.modelId}` as `${string}/${string}`,
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
    const storedCred = authStorage.get('anthropic');

    if (this.#routeThroughMastraGateway) {
      if (storedCred?.type === 'oauth') {
        const anthropic = createAnthropic({
          apiKey: 'oauth-gateway-placeholder',
          baseURL: `${this.#mastraGatewayBaseUrl}/v1`,
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

      return this.#mastraGateway.resolveLanguageModel({ ...args, modelId: bareModelId }) as GatewayLanguageModel;
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

    // No stored credentials: use the OAuth-backed provider so the first request can trigger login.
    return opencodeClaudeMaxProvider(bareModelId, { headers: args.headers }) as unknown as GatewayLanguageModel;
  }

  #resolveOpenAIModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    transport?: any;
    responsesWebSocket?: any;
  }): GatewayLanguageModel | undefined {
    const storedCred = authStorage.get('openai-codex');

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
          fetch: buildOpenAICodexOAuthFetch({ authStorage, rewriteUrl: false }) as any,
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
      }) as unknown as GatewayLanguageModel;
    }

    const apiKey = getOpenAIApiKey();
    if (apiKey) {
      return openaiApiKeyProvider(args.modelId, apiKey, args.headers) as unknown as GatewayLanguageModel;
    }

    return undefined;
  }
}
