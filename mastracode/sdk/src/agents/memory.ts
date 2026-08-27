import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { GatewayLanguageModel } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { fastembed } from '@mastra/fastembed';
import { Memory, Subconscious } from '@mastra/memory';
import { DEFAULT_OBS_THRESHOLD, DEFAULT_REF_THRESHOLD } from '../constants.js';
import { LOCAL_KNOWLEDGE_ORG_ID, resolveKnowledgeScopeIdentity } from '../knowledge-scope.js';
import { resolveAutoOMModelId } from '../onboarding/packs.js';
import { loadSettings } from '../onboarding/settings.js';
import type { MastraCodeState } from '../schema.js';
import { getOmScope } from '../utils/project.js';
import { resolveModel, resolvePackMemoryModelChain } from './model.js';
import type { PackMemoryModelChainEntry } from './model.js';

/**
 * Resolve one OM role's model for this invocation. Explicit per-role choices
 * win. Automatic roles follow the active mode pack's memory fallback chain
 * when present, then the low-cost model for the active main-model provider.
 */
function resolveOmRoleModelForRequest(
  role: 'observer' | 'reflector',
  requestContext: RequestContext,
  settingsPath?: string,
): GatewayLanguageModel | PackMemoryModelChainEntry[] {
  const controller = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
  const state = controller?.getState() as MastraCodeState | undefined;
  const resolveOptions = { remapForCodexOAuth: true, requestContext } as const;
  const factorySettings = requestContext.get('factoryMemorySettings') as
    | { observerModelId?: string | null; reflectorModelId?: string | null }
    | null
    | undefined;

  // The configured settings file, not the default one: a caller that points the
  // agent at another settings path must get the same pack/override resolution
  // for observational memory as it does for the main model. Factory settings
  // remain DB-authoritative and intentionally bypass host settings overrides.
  const settings = loadSettings(settingsPath);
  const roleOverride =
    factorySettings === undefined
      ? role === 'observer'
        ? settings.models?.observerModelOverride
        : settings.models?.reflectorModelOverride
      : undefined;
  const factoryModelId = factorySettings?.[`${role}ModelId`];
  const selection: unknown =
    factorySettings !== undefined ? (factoryModelId ?? 'auto') : state?.[`${role}ModelSelection`];
  const legacyModelId = factorySettings === undefined ? state?.[`${role}ModelId`] : undefined;
  const selectedModelId =
    roleOverride ??
    (typeof selection === 'string' && selection !== 'auto'
      ? selection
      : selection && typeof selection === 'object' && 'mode' in selection && selection.mode === 'model'
        ? 'modelId' in selection && typeof selection.modelId === 'string'
          ? selection.modelId
          : undefined
        : !selection
          ? legacyModelId
          : undefined);

  if (selectedModelId) {
    requestContext.set(`om.${role}.selectionMode`, 'model');
    requestContext.set(`om.${role}.effectiveModelId`, selectedModelId);
    return resolveModel(selectedModelId, resolveOptions);
  }

  if (factorySettings === undefined) {
    const pendingState = state?.mastracodePendingPackFallback as
      | { toPackId?: unknown; threadId?: unknown }
      | null
      | undefined;
    const pendingPackId =
      pendingState &&
      (pendingState.threadId === undefined || pendingState.threadId === controller?.threadId) &&
      typeof pendingState.toPackId === 'string' &&
      pendingState.toPackId.length > 0
        ? pendingState.toPackId
        : undefined;
    const packId = pendingPackId ?? state?.activeModelPackId ?? settings.models?.activeModelPackId;
    if (typeof packId === 'string' && packId.length > 0) {
      const chained = resolvePackMemoryModelChain(settings, packId, resolveOptions);
      if (chained) {
        requestContext.set(`om.${role}.selectionMode`, 'auto');
        requestContext.set(`om.${role}.effectiveModelId`, chained[0]?.model.modelId);
        return chained;
      }
    }
  }

  const currentModelId = controller?.session.modelId || (state?.currentModelId as string | undefined);
  const effectiveModelId = resolveAutoOMModelId(currentModelId);
  requestContext.set(`om.${role}.selectionMode`, 'auto');
  requestContext.set(`om.${role}.effectiveModelId`, effectiveModelId);
  return resolveModel(effectiveModelId, resolveOptions);
}

const DYNAMIC_AGENTS_MD_INSTRUCTION =
  'Messages wrapped in <system-reminder type="dynamic-agents-md" ...>...</system-reminder> are ephemeral project-context instructions injected from files on disk. Do NOT observe or extract information from these messages — they are reloaded automatically when needed and should not be stored in memory.';

// Derived from https://github.com/JuliusBrussee/caveman and adapted for OM use with fixed full-level compression.
const CAVEMAN_OM_INSTRUCTION = `Respond terse like smart caveman. All technical substance stay. Only fluff die.

Use full caveman compression style.

Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Technical terms exact. Code blocks unchanged. Errors quoted exact. Leave out the words "agent" and "assistant" at the start of each observation line, it is assumed each line is referring to the assistant unless it specifically says it was about the user. Leave out parenthesis and other text characters like * that would not contribute to understanding the observations.

Pattern: \`[thing] [action] [reason]. [next step]\`

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use < not <=. Fix:"

Example 1
🔴 14:31 user asks why React component rerenders
🟡 14:32 saw inline object prop create new ref each render, cause rerender
✅ 14:34 fixed render issue by wrap object in useMemo

Example 2
🟡 15:10 explained pool reuse DB connections, skip repeat handshake overhead

Don't say "Agent did x", say "did x". It will be assumed the agent did what was observed. The who should only be specified for the user or other third parties: "user asked x"

Drop caveman for: security warnings, irreversible action confirmations, multi-step sequences where fragment order risks misread, user asks to clarify or repeats question, and anything that requires remembering verbatim content. Resume caveman after clear part done`;

export { LOCAL_KNOWLEDGE_ORG_ID };

// One error per session, not per memory resolution. Keyed on the session id
// rather than the controller object: the controller is read off the request
// context on every resolution, so it is a fresh object per request and would
// dedupe nothing. Bounded so a long-running Factory process cannot grow this
// without limit — refusing sessions are rare, and losing the oldest ids only
// costs one extra log line.
const REPORTED_ORG_UNRESOLVED_LIMIT = 500;
const reportedOrgUnresolved = new Set<string>();

function reportOrgUnresolved(
  controller: AgentControllerRequestContext<MastraCodeState> | undefined,
  factoryProjectId: string | undefined,
  reason?: string,
) {
  const sessionId = controller?.session?.id;
  if (sessionId) {
    if (reportedOrgUnresolved.has(sessionId)) return;
    if (reportedOrgUnresolved.size >= REPORTED_ORG_UNRESOLVED_LIMIT) {
      reportedOrgUnresolved.delete(reportedOrgUnresolved.values().next().value as string);
    }
    reportedOrgUnresolved.add(sessionId);
  }
  const session = controller?.session;
  console.error(
    `[Subconscious] Knowledge curation disabled: no organization resolved for session ${session?.id ?? 'unknown'} (project ${factoryProjectId ?? 'none'})${reason ? `: ${reason}` : ''}. Knowledge is not written rather than written where it cannot be read.`,
  );
}

/**
 * Whether the experimental subconscious (knowledge graph + reminder sidekick)
 * is switched on for this process: it needs a vector store and the opt-in flag.
 */
export function isSubconsciousEnabled(vector: MastraVector | undefined): boolean {
  return Boolean(vector) && process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS === '1';
}

/**
 * Whether the subconscious tools (`knowledge_*`, `ask_memory`) are registered
 * for a given session. Beyond the process-level switch, a Factory-owned
 * session that cannot resolve its org refuses the subconscious entirely (see
 * `getDynamicMemory`, which applies the same two checks inline because it also
 * needs the resolved identity). The system prompt's tool guidance calls here so
 * it never advertises tools that `getDynamicMemory` did not register.
 */
export function hasSubconsciousTools(vector: MastraVector | undefined, state: MastraCodeState | undefined): boolean {
  return isSubconsciousEnabled(vector) && resolveKnowledgeScopeIdentity(state).resolved;
}

/**
 * Dynamic memory factory function.
 * Reads OM thresholds from controller state via requestContext.
 * Model functions also read from requestContext (no mutable bridge needed).
 */
export function getDynamicMemory(storage: MastraCompositeStore, vector?: MastraVector, settingsPath?: string) {
  // Cache is scoped per storage instance (per getDynamicMemory call) so a
  // Memory bound to one storage is never reused after storage changes.
  let cachedMemory: Memory | null = null;
  let cachedMemoryKey: string | null = null;

  // Observer/reflector model functions — read the current model ID from
  // controller state via requestContext (propagated by OM's agent.generate).
  // Bound here so the configured settings path reaches role overrides and pack
  // memory-model resolution.
  const getObserverModel = ({ requestContext }: { requestContext: RequestContext }) =>
    resolveOmRoleModelForRequest('observer', requestContext, settingsPath);
  const getReflectorModel = ({ requestContext }: { requestContext: RequestContext }) =>
    resolveOmRoleModelForRequest('reflector', requestContext, settingsPath);

  return ({ requestContext }: { requestContext: RequestContext }) => {
    const controller = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
    const state = controller?.getState() as MastraCodeState | undefined;
    const subconsciousEnabled = isSubconsciousEnabled(vector);
    const factoryProjectId = state?.factoryProjectId;
    const isFactory = typeof factoryProjectId === 'string' && factoryProjectId.trim().length > 0;

    // A Factory-owned session that could not resolve its org refuses to curate:
    // writing under a substituted identity produces knowledge the fail-closed
    // read path can never see.
    let orgUnresolvedRefusal = false;

    if (subconsciousEnabled) {
      const identity = resolveKnowledgeScopeIdentity(state);
      if (identity.resolved) {
        requestContext.set('organizationId', identity.organizationId);
      } else {
        orgUnresolvedRefusal = true;
        reportOrgUnresolved(controller, identity.knowledgeResourceId, identity.reason);
      }
      if (identity.knowledgeResourceId) {
        requestContext.set('knowledgeResourceId', identity.knowledgeResourceId);
      }
    }

    const subconsciousAvailable = subconsciousEnabled && !orgUnresolvedRefusal;

    const omScope = state?.omScope ?? getOmScope(state?.projectPath);

    const obsThreshold = state?.observationThreshold ?? DEFAULT_OBS_THRESHOLD;
    const refThreshold = state?.reflectionThreshold ?? DEFAULT_REF_THRESHOLD;
    const caveman = state?.cavemanObservations ?? false;

    const observerPreviousObservationTokens = 1000;
    const observeAttachments = state?.observeAttachments;
    // Factory sessions get a factory-only Subconscious config, so the cache key
    // carries a factory presence bit to keep the two configs from cross-serving.
    const cacheKey = `${obsThreshold}:${refThreshold}:${omScope}:${observerPreviousObservationTokens}:${caveman ? 1 : 0}:${observeAttachments}:${isFactory ? 1 : 0}:${subconsciousAvailable ? 1 : 0}`;
    if (cachedMemory && cachedMemoryKey === cacheKey) {
      return cachedMemory;
    }

    // Async buffering is not supported with resource scope — disable it
    const isResourceScope = omScope === 'resource';

    const observerInstruction = caveman
      ? `${DYNAMIC_AGENTS_MD_INSTRUCTION}\n\n${CAVEMAN_OM_INSTRUCTION}`
      : DYNAMIC_AGENTS_MD_INSTRUCTION;
    const reflectionInstruction = caveman ? CAVEMAN_OM_INSTRUCTION : undefined;

    cachedMemory = new Memory({
      storage,
      vector: vector || false,
      embedder: vector ? fastembed.small : undefined,
      options: {
        // Generate a durable title from the first user message. Every client uses
        // the same title in its thread list and active-session chrome. Title
        // generation takes the primary OM model only — its model field does not
        // accept fallback arrays.
        generateTitle: {
          model: ({ requestContext }) => {
            const resolved = getObserverModel({ requestContext });
            return Array.isArray(resolved) ? resolved[0]!.model : resolved;
          },
        },
        observationalMemory: {
          enabled: true,
          temporalMarkers: true,
          retrieval: vector ? { vector: true } : true,
          experimental_subconscious: subconsciousAvailable
            ? new Subconscious({
                defaultScope: 'resource',
                maxScope: 'resource',
                pins: true,
                ...(isFactory ? { maxSteps: 25 } : {}),
              })
            : undefined,
          scope: omScope,
          activateAfterIdle: 'auto',
          activateOnProviderChange: true,
          observation: {
            bufferTokens: isResourceScope ? false : 1 / 5,
            bufferActivation: isResourceScope ? undefined : 2000,
            model: getObserverModel,
            messageTokens: obsThreshold,
            blockAfter: 2,
            previousObserverTokens: observerPreviousObservationTokens,
            threadTitle: true,
            instruction: observerInstruction,
            observeAttachments,
          },
          reflection: {
            bufferActivation: isResourceScope ? undefined : 1 / 2,
            blockAfter: 1.1,
            model: getReflectorModel,
            observationTokens: refThreshold,
            instruction: reflectionInstruction,
          },
        },
      },
    });
    cachedMemoryKey = cacheKey;

    return cachedMemory;
  };
}
