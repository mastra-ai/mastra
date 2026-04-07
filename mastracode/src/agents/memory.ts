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

    const observerPreviousObservationTokens = 1000;
    const cacheKey = `${obsThreshold}:${refThreshold}:${omScope}:${observerPreviousObservationTokens}`;
    if (cachedMemory && cachedMemoryKey === cacheKey) {
      return cachedMemory;
    }

    // Async buffering is not supported with resource scope — disable it
    const isResourceScope = omScope === 'resource';

    cachedMemory = new Memory({
      storage,
      vector: vector || false,
      embedder: vector ? fastembed.small : undefined,
      options: {
        observationalMemory: {
          enabled: true,
          retrieval: vector ? { vector: true } : true,
          scope: omScope,
          observation: {
            bufferTokens: isResourceScope ? false : 1 / 5,
            bufferActivation: isResourceScope ? undefined : 2000,
            model: getObserverModel,
            messageTokens: obsThreshold,
            blockAfter: 2,
            previousObserverTokens: observerPreviousObservationTokens,
            threadTitle: true,
            instruction:
              'Messages wrapped in <system-reminder type="dynamic-agents-md" ...>...</system-reminder> are ephemeral project-context instructions injected from files on disk. Do NOT observe or extract information from these messages — they are reloaded automatically when needed and should not be stored in memory.',
          },
          reflection: {
            bufferActivation: isResourceScope ? undefined : 1 / 2,
            blockAfter: 1.1,
            model: getReflectorModel,
            observationTokens: refThreshold,
          },
        },
      },
    });
    cachedMemoryKey = cacheKey;

    return cachedMemory;
  };
}
