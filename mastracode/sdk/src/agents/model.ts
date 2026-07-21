import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { GatewayLanguageModel, MastraModelGatewayInterface } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import { loadSettings } from '../onboarding/settings.js';
import { AMAZON_BEDROCK_GATEWAY_ID, createAmazonBedrockGateway } from '../providers/amazon-bedrock-gateway.js';
import type { ThinkingLevel } from '../providers/openai-codex.js';
import { resolveCredentialStore } from './credential-resolver.js';
import {
  MASTRA_GATEWAY_PREFIX,
  MASTRACODE_GATEWAY_ID,
  MastraCodeGateway,
  reloadAuthStorage,
  stripMastraGatewayPrefix,
} from './mastracode-gateway.js';
import type { MastraCodeGatewayOptions } from './mastracode-gateway.js';

export {
  getAnthropicApiKey,
  getOpenAIApiKey,
  MASTRACODE_GATEWAY_ID,
  MastraCodeGateway,
  remapOpenAIModelForCodexOAuth,
  resolveAuth,
} from './mastracode-gateway.js';
export type { MastraCodeCustomProvider, MastraCodeGatewayOptions } from './mastracode-gateway.js';
export {
  setCredentialStoreProvider,
  hasCredentialStoreProvider,
  resolveTenantFromRequestContext,
} from './credential-resolver.js';
export type { CredentialTenant, CredentialStoreProvider } from './credential-resolver.js';

type ResolvedModel = GatewayLanguageModel;
type ModelRequestHeaders = Record<string, string>;

function getAgentControllerHeaders(requestContext?: RequestContext): ModelRequestHeaders | undefined {
  const agentControllerContext = requestContext?.get('controller') as AgentControllerRequestContext<any> | undefined;
  const headers = {
    ...(agentControllerContext?.threadId ? { 'x-thread-id': agentControllerContext.threadId } : {}),
    ...(agentControllerContext?.resourceId ? { 'x-resource-id': agentControllerContext.resourceId } : {}),
  };

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function createMastraCodeGateway(options: MastraCodeGatewayOptions): MastraCodeGateway {
  return new MastraCodeGateway(options);
}

export function createMastraCodeModelCatalogProvider(gateway: MastraModelGatewayInterface) {
  return gateway instanceof MastraCodeGateway
    ? gateway.createModelCatalogProvider()
    : MastraCodeGateway.createModelCatalogProvider(gateway);
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
): GatewayLanguageModel {
  reloadAuthStorage();
  const headers = getAgentControllerHeaders(options?.requestContext);
  const settings = loadSettings();
  // Bedrock was previously cataloged under the MastraCode gateway namespace
  // (`mastracode/amazon-bedrock/<model>`). Normalize any legacy saved ids to the
  // standalone `amazon-bedrock/<model>` form so they resolve through the
  // dedicated Bedrock gateway.
  const bedrockLegacyPrefix = `${MASTRACODE_GATEWAY_ID}/amazon-bedrock/`;
  const normalizedInput = modelId.startsWith(bedrockLegacyPrefix)
    ? modelId.slice(MASTRACODE_GATEWAY_ID.length + 1)
    : modelId;
  const isMastraGatewayModel = normalizedInput.startsWith(MASTRA_GATEWAY_PREFIX);
  const normalizedModelId = stripMastraGatewayPrefix(normalizedInput);
  const [providerId, ...modelParts] = normalizedModelId.split('/');
  const bareModelId = modelParts.join('/');
  if (!providerId || !bareModelId) {
    throw new Error(`Invalid model id: ${modelId}`);
  }

  if (providerId === AMAZON_BEDROCK_GATEWAY_ID) {
    const bedrockGateway = createAmazonBedrockGateway();
    const routerId = `${AMAZON_BEDROCK_GATEWAY_ID}/${bareModelId}`;
    const auth = bedrockGateway.resolveAuth({
      gatewayId: AMAZON_BEDROCK_GATEWAY_ID,
      providerId: AMAZON_BEDROCK_GATEWAY_ID,
      modelId: bareModelId,
      routerId,
    });
    return bedrockGateway.resolveLanguageModel({
      providerId: AMAZON_BEDROCK_GATEWAY_ID,
      modelId: bareModelId,
      apiKey: auth?.apiKey ?? '',
      headers,
    });
  }

  const routerId = `${MASTRACODE_GATEWAY_ID}/${normalizedModelId}`;

  const mgApiKey = MastraCodeGateway.getMastraGatewayApiKey();
  const rawGatewayBase =
    settings.memoryGateway?.baseUrl ?? process.env['MASTRA_GATEWAY_URL'] ?? 'https://gateway-api.mastra.ai';
  // Deployed web registers a per-tenant credential store provider; when the
  // request carries an authenticated tenant, resolve credentials through the
  // caller's own store (user > org > env). Undefined = global AuthStorage.
  const credentialStore = resolveCredentialStore(options?.requestContext);
  const gateway = createMastraCodeGateway({
    mastraGatewayBaseUrl: rawGatewayBase.replace(/\/+$/, '').replace(/\/v1$/, ''),
    mastraGatewayApiKey: mgApiKey,
    routeThroughMastraGateway: Boolean(mgApiKey && isMastraGatewayModel),
    thinkingLevel: options?.thinkingLevel,
    customProviders: settings.customProviders,
    credentialStore,
  });

  const auth = gateway.resolveAuth({
    gatewayId: MASTRACODE_GATEWAY_ID,
    providerId,
    modelId: bareModelId,
    routerId,
  });

  return gateway.resolveLanguageModel({
    providerId,
    modelId: bareModelId,
    apiKey: auth?.apiKey ?? mgApiKey ?? '',
    headers,
  });
}

/**
 * Dynamic model function that reads the current model from controller state.
 * This allows runtime model switching via the /models picker.
 */
export function getDynamicModel({ requestContext }: { requestContext: RequestContext }): ResolvedModel {
  const agentControllerContext = requestContext.get('controller') as AgentControllerRequestContext<any> | undefined;

  const modelId = agentControllerContext?.session?.modelId;
  if (!modelId) {
    throw new Error('No model selected. Use /models to select a model first.');
  }

  const thinkingLevel = agentControllerContext?.state?.thinkingLevel as ThinkingLevel | undefined;

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
