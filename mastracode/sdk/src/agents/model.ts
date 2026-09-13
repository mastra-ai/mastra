import type { ModelWithRetries } from '@mastra/core/agent';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { GatewayLanguageModel, MastraModelGatewayInterface } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import { listBuiltinModePacks, resolveModePackFallbackChain } from '../onboarding/packs.js';
import {
  findModePackForModel,
  loadSettings,
  resolveDefaultThinkingLevel,
  resolveModePackModels,
  stripMastraCodeCustomProviderPrefix,
} from '../onboarding/settings.js';
import { AMAZON_BEDROCK_GATEWAY_ID, createAmazonBedrockGateway } from '../providers/amazon-bedrock-gateway.js';
import { isThinkingLevelSetting } from '../thinking.js';
import type { ThinkingLevelSetting } from '../thinking.js';
import { resolveCredentialStore } from './credential-resolver.js';
import { resolveCustomProviders } from './custom-provider-source.js';
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
export {
  setCustomProvidersSource,
  hasCustomProvidersSource,
  resolveCustomProviders,
} from './custom-provider-source.js';
export type { CustomProvidersSource } from './custom-provider-source.js';

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
  options?: { thinkingLevel?: ThinkingLevelSetting; remapForCodexOAuth?: boolean; requestContext?: RequestContext },
): GatewayLanguageModel {
  reloadAuthStorage();
  const headers = getAgentControllerHeaders(options?.requestContext);
  const settings = loadSettings();
  // Bedrock was previously cataloged under the MastraCode gateway namespace
  // (`mastracode/amazon-bedrock/<model>`). Normalize any legacy saved ids to the
  // standalone `amazon-bedrock/<model>` form so they resolve through the
  // dedicated Bedrock gateway.
  const bedrockLegacyPrefix = `${MASTRACODE_GATEWAY_ID}/amazon-bedrock/`;
  const bedrockNormalizedInput = modelId.startsWith(bedrockLegacyPrefix)
    ? modelId.slice(MASTRACODE_GATEWAY_ID.length + 1)
    : modelId;
  // Deployed web registers a custom providers source (DB-backed, tenant
  // scoped); when registered it is authoritative and settings.json custom
  // providers are ignored. Undefined = local settings-based behavior.
  const customProviders = resolveCustomProviders(options?.requestContext) ?? settings.customProviders;
  // Ids selected from the shared /models catalog were previously persisted in
  // the gateway-qualified `mastracode/<customProviderId>/<model>` form, which
  // parses the provider as `mastracode` and breaks provider config lookup.
  // Normalize at resolution time (in addition to stripping at selection time)
  // so already-saved ids and any surface that persists the raw catalog id
  // still resolve to the custom provider.
  const normalizedInput = stripMastraCodeCustomProviderPrefix(bedrockNormalizedInput, customProviders);
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
    customProviders,
    credentialStore,
  });

  const auth = gateway.resolveAuth({
    gatewayId: MASTRACODE_GATEWAY_ID,
    providerId,
    modelId: bareModelId,
    routerId,
  });

  if (!auth && credentialStore?.allowEnvironmentFallback === false) {
    throw new Error(
      `No usable ${providerId} credential is configured for this signed-in Factory account. Connect the provider or add an organization credential, then try again.`,
    );
  }

  return gateway.resolveLanguageModel({
    providerId,
    modelId: bareModelId,
    apiKey: auth?.apiKey ?? '',
    headers,
  });
}

export interface ThinkingRequestContext {
  state?: { thinkingLevel?: unknown };
  session?: { modeId?: string };
}
/**
 * Resolve the effective thinking level for the current request.
 *
 * Precedence:
 *   1. Session override (`state.thinkingLevel`, set via /think or the session
 *      settings panel).
 *   2. Per-mode default from settings (`models.modeThinkingDefaults[mode]`).
 *   3. Global default (`preferences.thinkingLevel`).
 *
 * Resolved per-request (not seeded at session start) so configuration changes
 * apply to the next request of every session — including automated
 * (rule-driven) Factory runs that nobody ever opens interactively.
 */

export function resolveRequestThinkingLevel(
  agentControllerContext: ThinkingRequestContext | undefined,
  settingsPath?: string,
): ThinkingLevelSetting {
  const override = agentControllerContext?.state?.thinkingLevel;
  if (isThinkingLevelSetting(override)) return override;
  const modeId = agentControllerContext?.session?.modeId;
  return resolveDefaultThinkingLevel(loadSettings(settingsPath), modeId).level;
}

/** Structural pack shape for fallback resolution (custom pack models are partial by nature). */
export interface ResolvableModePack {
  id: string;
  name: string;
  models: Record<string, string>;
}

/** All packs a fallback chain may reference: every builtin plus saved customs. */
export function listResolvableModePacks(settings: ReturnType<typeof loadSettings>): ResolvableModePack[] {
  return [
    ...listBuiltinModePacks(),
    ...settings.customModelPacks.map(pack => ({
      id: `custom:${pack.name}`,
      name: pack.name,
      models: { ...pack.models },
    })),
  ];
}

/**
 * Dynamic model function that reads the current model from controller state.
 * This allows runtime model switching via the /models picker.
 *
 * When the session's model came from a pack with a fallback chain configured
 * (`settings.models.packFallbacks`), returns core's `ModelWithRetries[]`
 * fallback array instead of a bare model: the active pack's model first, then
 * each fallback pack's model for the same mode. Core advances the array when
 * the error processors decline to retry (pool exhausted / persistent outage —
 * see AccountRotationProcessor). Entry ids are unique per occurrence — the
 * one allowed revisit of a pack gets `<packId>#2` — because core re-resolves
 * the active fallback index by id across agentic steps.
 */
export function getDynamicModel(
  { requestContext }: { requestContext: RequestContext },
  settingsPath?: string,
): ResolvedModel | ModelWithRetries[] {
  const agentControllerContext = requestContext.get('controller') as AgentControllerRequestContext<any> | undefined;

  const modelId = agentControllerContext?.session?.modelId;
  if (!modelId) {
    // A missing controller context means the run was started without session
    // request context at all (e.g. a signal delivered to an idle thread) —
    // "use /models" would mislead there, the user's selection was never the
    // problem.
    if (!agentControllerContext) {
      throw new Error(
        'No model available: this run started without a controller session context, so no model selection could be resolved.',
      );
    }
    throw new Error('No model selected. Use /models to select a model first.');
  }

  const thinkingLevel = resolveRequestThinkingLevel(agentControllerContext, settingsPath);
  const resolveOptions = { thinkingLevel, remapForCodexOAuth: true, requestContext } as const;
  const primary = resolveModel(modelId, resolveOptions);

  const settings = loadSettings(settingsPath);
  // `models?` tolerates partial settings mocks; loaded settings always carry it.
  const fallbacks = settings.models?.packFallbacks ?? {};
  if (Object.keys(fallbacks).length === 0) return primary;

  const modeId = agentControllerContext?.session?.modeId ?? 'build';
  const packs = listResolvableModePacks(settings);
  const activePack = findModePackForModel(settings, packs, modelId, modeId);
  if (!activePack) return primary;

  const chain = resolveModePackFallbackChain(fallbacks, activePack.id, settings.customModelPacks);
  if (chain.length < 2) return primary;

  const entries: ModelWithRetries[] = [{ id: activePack.id, model: primary }];
  const appearances = new Map<string, number>([[activePack.id, 1]]);
  for (const packId of chain.slice(1)) {
    const pack = packs.find(candidate => candidate.id === packId);
    if (!pack) break;
    const entryModelId = resolveModePackModels(settings, pack)[modeId];
    if (!entryModelId) break;
    // Best-effort resolution: an unresolvable fallback (e.g. unconnected
    // provider in deployed fail-closed mode) truncates the chain here rather
    // than failing the request before the primary is ever tried.
    let entryModel: ResolvedModel;
    try {
      entryModel = resolveModel(entryModelId, resolveOptions);
    } catch {
      break;
    }
    const occurrence = (appearances.get(packId) ?? 0) + 1;
    appearances.set(packId, occurrence);
    entries.push({
      id: occurrence === 1 ? packId : `${packId}#${occurrence}`,
      model: entryModel,
    });
  }
  // A chain that truncated to the primary alone is indistinguishable from no
  // chain — return the bare model so core never sees a one-entry array.
  if (entries.length < 2) return primary;
  return entries;
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
