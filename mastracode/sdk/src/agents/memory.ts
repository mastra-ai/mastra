import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { fastembed } from '@mastra/fastembed';
import { Memory, Subconscious } from '@mastra/memory';
import { DEFAULT_OM_MODEL_ID, DEFAULT_OBS_THRESHOLD, DEFAULT_REF_THRESHOLD } from '../constants.js';
import type { MastraCodeState } from '../schema.js';
import { getOmScope } from '../utils/project.js';
import { resolveModel } from './model.js';

/**
 * Read controller state from requestContext.
 * Used by both the memory factory and the OM model functions.
 */
function getAgentControllerState(requestContext: RequestContext): MastraCodeState | undefined {
  const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
  return ctx?.getState() as MastraCodeState | undefined;
}

/**
 * Observer model function — reads the current observer model ID from
 * controller state via requestContext (now propagated by OM's agent.generate).
 */
function getObserverModel({ requestContext }: { requestContext: RequestContext }) {
  const state = getAgentControllerState(requestContext);
  return resolveModel(state?.observerModelId ?? DEFAULT_OM_MODEL_ID, {
    remapForCodexOAuth: true,
    requestContext,
  });
}

/**
 * Reflector model function — reads the current reflector model ID from
 * controller state via requestContext (now propagated by OM's agent.generate).
 */
function getReflectorModel({ requestContext }: { requestContext: RequestContext }) {
  const state = getAgentControllerState(requestContext);
  return resolveModel(state?.reflectorModelId ?? DEFAULT_OM_MODEL_ID, {
    remapForCodexOAuth: true,
    requestContext,
  });
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

/**
 * The organization rung local (TUI/studio) knowledge is curated under. A fixed
 * literal on purpose: deriving it from a hostname or path would fragment local
 * knowledge per checkout into scopes nothing ever reads.
 */
export const LOCAL_KNOWLEDGE_ORG_ID = 'local';

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
    `[Subconscious] Knowledge curation disabled: no organization resolved for session ${session?.id ?? 'unknown'} (project ${factoryProjectId ?? 'none'}). Knowledge is not written rather than written where it cannot be read.`,
  );
}

/**
 * Dynamic memory factory function.
 * Reads OM thresholds from controller state via requestContext.
 * Model functions also read from requestContext (no mutable bridge needed).
 */
export function getDynamicMemory(storage: MastraCompositeStore, vector?: MastraVector) {
  // Cache is scoped per storage instance (per getDynamicMemory call) so a
  // Memory bound to one storage is never reused after storage changes.
  let cachedMemory: Memory | null = null;
  let cachedMemoryKey: string | null = null;

  return ({ requestContext }: { requestContext: RequestContext }) => {
    const controller = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
    const state = controller?.getState() as MastraCodeState | undefined;
    const subconsciousEnabled = Boolean(vector) && process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS === '1';
    const factoryProjectId = state?.factoryProjectId;
    const isFactory = typeof factoryProjectId === 'string' && factoryProjectId.trim().length > 0;

    // A Factory-owned session that could not resolve its org refuses to curate:
    // writing under a substituted identity produces knowledge the fail-closed
    // read path can never see.
    let orgUnresolvedRefusal = false;

    if (subconsciousEnabled) {
      // Factory seeds the authoritative org id into session state. There is no
      // fallback: a session owner is a USER id, never an organization.
      const factoryOrgId = state?.factoryOrgId;
      const factoryOwned = isFactory || state?.factoryOrgUnresolved === true;
      if (typeof factoryOrgId === 'string' && factoryOrgId.trim()) {
        requestContext.set('organizationId', factoryOrgId);
      } else if (factoryOwned) {
        orgUnresolvedRefusal = true;
        reportOrgUnresolved(controller, factoryProjectId);
      } else {
        // TUI/studio: an explicit, named scope rather than a cascaded identity.
        requestContext.set('organizationId', LOCAL_KNOWLEDGE_ORG_ID);
      }
      // Factory runs share one knowledge graph per project: anchor the
      // subconscious knowledge scope's resource rung on the project id.
      if (isFactory) {
        requestContext.set('knowledgeResourceId', factoryProjectId);
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
        // the same title in its thread list and active-session chrome.
        generateTitle: { model: getObserverModel },
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
