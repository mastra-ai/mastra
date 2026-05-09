import type { HarnessRequestContext } from '@mastra/core/harness';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { fastembed } from '@mastra/fastembed';
import { Memory } from '@mastra/memory';
import type { z } from 'zod';
import { DEFAULT_OM_MODEL_ID, DEFAULT_OBS_THRESHOLD, DEFAULT_REF_THRESHOLD } from '../constants';
import type { stateSchema } from '../schema';
import { getOmScope } from '../utils/project';
import { resolveModel } from './model';

let cachedMemory: Memory | null = null;
let cachedMemoryKey: string | null = null;

/**
 * Read harness state from requestContext.
 * Used by both the memory factory and the OM model functions.
 */
type MastraCodeState = z.infer<typeof stateSchema>;

function getHarnessState(requestContext: RequestContext): MastraCodeState | undefined {
  return (requestContext.get('harness') as HarnessRequestContext<MastraCodeState> | undefined)?.getState?.();
}

/**
 * Observer model function — reads the current observer model ID from
 * harness state via requestContext (now propagated by OM's agent.generate).
 */
function getObserverModel({ requestContext }: { requestContext: RequestContext }) {
  const state = getHarnessState(requestContext);
  return resolveModel(state?.observerModelId ?? DEFAULT_OM_MODEL_ID, {
    remapForCodexOAuth: true,
    requestContext,
  });
}

/**
 * Reflector model function — reads the current reflector model ID from
 * harness state via requestContext (now propagated by OM's agent.generate).
 */
function getReflectorModel({ requestContext }: { requestContext: RequestContext }) {
  const state = getHarnessState(requestContext);
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
 * Dynamic memory factory function.
 * Reads OM thresholds from harness state via requestContext.
 * Model functions also read from requestContext (no mutable bridge needed).
 */
export function getDynamicMemory(storage: MastraCompositeStore, vector?: MastraVector) {
  return ({ requestContext }: { requestContext: RequestContext }) => {
    const state = getHarnessState(requestContext);
    const omScope = state?.omScope ?? getOmScope(state?.projectPath);

    const obsThreshold = state?.observationThreshold ?? DEFAULT_OBS_THRESHOLD;
    const refThreshold = state?.reflectionThreshold ?? DEFAULT_REF_THRESHOLD;
    const caveman = state?.cavemanObservations ?? false;

    const observerPreviousObservationTokens = 1000;
    const cacheKey = `${obsThreshold}:${refThreshold}:${omScope}:${observerPreviousObservationTokens}:${caveman ? 1 : 0}`;
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
        observationalMemory: {
          enabled: true,
          temporalMarkers: true,
          retrieval: vector ? { vector: true } : true,
          scope: omScope,
          activateAfterIdle: '5m',
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
