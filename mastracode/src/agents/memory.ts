import type { HarnessRequestContext } from '@mastra/core/harness';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
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
function getHarnessState(requestContext: RequestContext) {
  return (requestContext.get('harness') as HarnessRequestContext<typeof stateSchema> | undefined)?.getState?.();
}

/**
 * Observer model function — reads the current observer model ID from
 * harness state via requestContext (now propagated by OM's agent.generate).
 */
function getObserverModel({ requestContext }: { requestContext: RequestContext }) {
  const state = getHarnessState(requestContext);
  return resolveModel(state?.observerModelId ?? DEFAULT_OM_MODEL_ID, { remapForCodexOAuth: true });
}

/**
 * Reflector model function — reads the current reflector model ID from
 * harness state via requestContext (now propagated by OM's agent.generate).
 */
function getReflectorModel({ requestContext }: { requestContext: RequestContext }) {
  const state = getHarnessState(requestContext);
  return resolveModel(state?.reflectorModelId ?? DEFAULT_OM_MODEL_ID, { remapForCodexOAuth: true });
}

/**
 * Dynamic memory factory function.
 * Reads OM thresholds from harness state via requestContext.
 * Model functions also read from requestContext (no mutable bridge needed).
 */
export function getDynamicMemory(storage: MastraCompositeStore) {
  return ({ requestContext }: { requestContext: RequestContext }) => {
    const state = getHarnessState(requestContext);
    const omScope = getOmScope(state?.projectPath);

    const obsThreshold = state?.observationThreshold ?? DEFAULT_OBS_THRESHOLD;
    const refThreshold = state?.reflectionThreshold ?? DEFAULT_REF_THRESHOLD;

    const cacheKey = `${obsThreshold}:${refThreshold}:${omScope}`;
    if (cachedMemory && cachedMemoryKey === cacheKey) {
      return cachedMemory;
    }

    cachedMemory = new Memory({
      storage,
      options: {
        observationalMemory: {
          enabled: true,
          scope: omScope,
          observation: {
            bufferTokens: 1 / 5,
            bufferActivation: 2000,
            model: getObserverModel,
            messageTokens: obsThreshold,
            blockAfter: 2,
          },
          reflection: {
            bufferActivation: 1 / 2,
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
