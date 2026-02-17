// =============================================================================
// Create Memory with Observational Memory support
// =============================================================================

import type { RequestContext } from "@mastra/core/request-context"
import { getOmScope } from "../utils"
import { DEFAULT_OM_MODEL_ID } from "./constants"
import { Memory } from "@mastra/memory"
import type { MastraCodeState } from "../state/schema"
import type { MastraCompositeStore } from "@mastra/core/storage"
import { resolveModel } from "../model"

// Default OM thresholds — per-thread overrides are loaded from thread metadata
const DEFAULT_OBS_THRESHOLD = 40_000
const DEFAULT_REF_THRESHOLD = 50_000

// Mutable OM state — updated by harness event listeners, read by OM config
// functions. We use this instead of requestContext because Mastra's OM system
// does NOT propagate requestContext to observer/reflector agent.generate() calls.
export const omState = {
    observerModelId: DEFAULT_OM_MODEL_ID,
    reflectorModelId: DEFAULT_OM_MODEL_ID,
    obsThreshold: DEFAULT_OBS_THRESHOLD,
    refThreshold: DEFAULT_REF_THRESHOLD,
}

// OM model resolvers — called by Memory's OM system which does NOT
// propagate requestContext. Read from mutable omState instead.
// Cast needed: resolveModel returns a union including ai SDK LanguageModel
// which is structurally compatible but not assignable to MastraModelConfig.
function getObserverModel() {
    return resolveModel(omState.observerModelId) as any
}

function getReflectorModel() {
    return resolveModel(omState.reflectorModelId) as any
}

// Cache for Memory instances by threshold config
let cachedMemory: Memory | null = null
let cachedMemoryKey: string | null = null

/**
 * Dynamic memory factory function.
 * Creates Memory with current threshold values from harness state.
 * Caches instance and reuses if config unchanged.
 */
export function getDynamicMemory({
    requestContext,
    storage,
}: {
    requestContext: RequestContext
    storage: MastraCompositeStore
}) {
    const state = requestContext.get("state") as MastraCodeState | undefined

    // Resolved OM scope (read once at startup, can be changed via config)
    const omScope = getOmScope(state?.projectPath ?? "")

    const obsThreshold = state?.observationThreshold ?? omState.obsThreshold
    const refThreshold = state?.reflectionThreshold ?? omState.refThreshold

    const cacheKey = `${obsThreshold}:${refThreshold}:${omScope}`;

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