import type { RequestContext } from "@mastra/core/request-context"
import type { MastraCompositeStore } from "@mastra/core/storage"
import { Memory } from "@mastra/memory"
import { DEFAULT_OM_MODEL_ID, DEFAULT_OBS_THRESHOLD, DEFAULT_REF_THRESHOLD } from "../constants"
import type { HarnessRuntimeContext } from "../harness/types"
import type { stateSchema } from "../schema"
import { getOmScope } from "../utils/project"


// Cache for Memory instances by threshold config
let cachedMemory: Memory | null = null
let cachedMemoryKey: string | null = null

// =============================================================================
// Create Memory with Observational Memory support
// =============================================================================


// Mutable OM state — updated by harness event listeners, read by OM config
// functions. We use this instead of requestContext because Mastra's OM system
// does NOT propagate requestContext to observer/reflector agent.generate() calls.
export const omState = {
    observerModelId: DEFAULT_OM_MODEL_ID,
    reflectorModelId: DEFAULT_OM_MODEL_ID,
    obsThreshold: DEFAULT_OBS_THRESHOLD,
    refThreshold: DEFAULT_REF_THRESHOLD,
}

/**
 * Dynamic model function for Observer agent.
 * Reads from module-level omState (kept in sync by harness events).
 */
function getObserverModel() {
    return resolveModel(omState.observerModelId)
}

/**
 * Dynamic model function for Reflector agent.
 * Reads from module-level omState (kept in sync by harness events).
 */
function getReflectorModel() {
    return resolveModel(omState.reflectorModelId)
}


/**
 * Dynamic memory factory function.
 * Creates Memory with current threshold values from harness state.
 * Caches instance and reuses if config unchanged.
 */
export function getDynamicMemory(storage: MastraCompositeStore) {
    return ({
        requestContext,
    }: {
        requestContext: RequestContext
    }) => {
        const ctx = requestContext.get("harness") as
            | HarnessRuntimeContext<typeof stateSchema>
            | undefined
        const state = ctx?.getState?.()

        // Resolved OM scope (read once at startup, can be changed via config)
        const omScope = getOmScope(state?.projectPath)

        const obsThreshold = state?.observationThreshold ?? omState.obsThreshold
        const refThreshold = state?.reflectionThreshold ?? omState.refThreshold

        const cacheKey = `${obsThreshold}:${refThreshold}:${omScope}`
        if (cachedMemory && cachedMemoryKey === cacheKey) {
            return cachedMemory
        }

        cachedMemory = new Memory({
            storage,
            options: {
                observationalMemory: {
                    enabled: true,
                    scope: omScope,
                    observation: {
                        bufferTokens: 1 / 10,
                        bufferActivation: 4 / 5,
                        model: getObserverModel,
                        messageTokens: obsThreshold,
                        blockAfter: 1,
                        modelSettings: {
                            maxOutputTokens: 60000,
                        },
                    },
                    reflection: {
                        bufferActivation: 1 / 2,
                        blockAfter: 1.1,
                        model: getReflectorModel,
                        observationTokens: refThreshold,
                        modelSettings: {
                            maxOutputTokens: 60000,
                        },
                    },
                },
            },
        })
        cachedMemoryKey = cacheKey

        return cachedMemory
    }
}