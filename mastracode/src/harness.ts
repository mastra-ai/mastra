import { z } from "zod"

import type { Agent } from "@mastra/core/agent"
import { Harness } from "@mastra/core/harness"
import type {
    HarnessMode,
} from "@mastra/core/harness"
import type { MastraCompositeStore } from "@mastra/core/storage"

export const mastraCodeStateSchema = z.object({
    currentModelId: z.string().default("anthropic/claude-sonnet-4-20250514"),
    cwd: z.string().optional(),
})

export type MastraCodeState = z.infer<typeof mastraCodeStateSchema>

export interface CreateMastraCodeHarnessOptions {
    id?: string
    resourceId: string
    storage: MastraCompositeStore
    stateSchema?: z.ZodObject<z.ZodRawShape>
    modes?: HarnessMode[]
    defaultAgent?: Agent
    initialState?: Record<string, unknown>
    userId?: string
    isRemoteStorage?: boolean
    configOverrides?: Record<string, unknown>
}

/**
 * First application-layer consumer of the core Harness primitive.
 * This keeps core generic while giving MastraCode a concrete entrypoint.
 */
export function createMastraCodeHarness(
    options: CreateMastraCodeHarnessOptions,
): Harness {
    const {
        id = "mastracode",
        resourceId,
        storage,
        stateSchema,
        modes,
        defaultAgent,
        initialState,
        userId,
        isRemoteStorage,
        configOverrides,
    } = options

    const resolvedModes: HarnessMode[] =
        modes ??
        (defaultAgent
            ? [
                {
                    id: "code",
                    name: "Code",
                    default: true,
                    agent: defaultAgent,
                },
            ]
            : [])

    if (resolvedModes.length === 0) {
        throw new Error(
            "createMastraCodeHarness requires either `modes` or `defaultAgent`.",
        )
    }

    return new Harness({
        id,
        resourceId,
        storage,
        stateSchema: (stateSchema ?? mastraCodeStateSchema) as any,
        initialState,
        modes: resolvedModes,
        userId,
        isRemoteStorage,
        ...(configOverrides as any),
    })
}

