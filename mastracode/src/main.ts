/**
 * MastraCode CLI entrypoint.
 *
 * This intentionally mirrors the structure of the old `main.ts` from the
 * separate mastracode repo, but keeps missing subsystems as placeholders
 * for now (TUI/hooks/MCP/providers).
 */
import { z } from "zod"

import { createMastraCodeHarness } from "./harness"
import { MastraTUI, mastra } from "./tui"
import { detectProject } from "./utils"

type ThreadRecord = {
    id: string
    resourceId: string
    title: string
    createdAt: Date
    updatedAt: Date
    metadata?: Record<string, unknown>
}

type MessageRecord = {
    id: string
    role: "user" | "assistant" | "system"
    threadId: string
    resourceId: string
    createdAt: Date
    content: {
        format: 2
        parts: Array<Record<string, unknown>>
    }
}

/**
 * Minimal in-memory store that satisfies the harness' required memory methods.
 * TODO: Replace with LibSQLStore (or other persistent storage) wiring.
 */
function createPlaceholderStore() {
    const threads = new Map<string, ThreadRecord>()
    const messages = new Map<string, MessageRecord[]>()

    const memory = {
        async saveThread({ thread }: { thread: ThreadRecord }) {
            threads.set(thread.id, { ...thread })
            return thread
        },
        async getThreadById({ threadId }: { threadId: string }) {
            return threads.get(threadId) ?? null
        },
        async listThreads({
            filter,
            perPage,
        }: {
            filter?: { resourceId?: string }
            perPage?: number | false
        }) {
            let list = Array.from(threads.values())
            if (filter?.resourceId) {
                list = list.filter((t) => t.resourceId === filter.resourceId)
            }
            list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            return {
                threads:
                    perPage === false
                        ? list
                        : list.slice(0, typeof perPage === "number" ? perPage : 40),
                total: list.length,
                page: 0,
                perPage: perPage ?? 40,
                hasMore: false,
            }
        },
        async saveMessages({ messages: incoming }: { messages: MessageRecord[] }) {
            for (const message of incoming) {
                const threadMessages = messages.get(message.threadId) ?? []
                threadMessages.push(message)
                messages.set(message.threadId, threadMessages)
            }
        },
        async listMessages({
            threadId,
        }: {
            threadId: string | string[]
            perPage?: number | false
        }) {
            const ids = Array.isArray(threadId) ? threadId : [threadId]
            const list = ids.flatMap((id) => messages.get(id) ?? [])
            list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            return {
                messages: list,
                total: list.length,
                page: 0,
                perPage: false,
                hasMore: false,
            }
        },
    }

    return {
        async init() { },
        async getStore(name: string) {
            return name === "memory" ? memory : undefined
        },
    }
}

/**
 * Placeholder coding agent stream.
 * TODO: Replace with real Agent + providers/tools/prompts.
 */
function createPlaceholderAgent() {
    return {
        id: "mastracode-agent",
        name: "MastraCode Agent",
        async stream(prompt: string) {
            const text = `Placeholder response for: ${prompt}`
            const fullStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        type: "text-start",
                        payload: { id: "placeholder-msg" },
                    })
                    controller.enqueue({
                        type: "text-delta",
                        payload: { id: "placeholder-msg", text },
                    })
                    controller.enqueue({
                        type: "finish",
                        payload: {
                            stepResult: { reason: "stop" },
                            output: {
                                usage: {
                                    inputTokens: 5,
                                    outputTokens: 6,
                                    totalTokens: 11,
                                },
                            },
                        },
                    })
                    controller.close()
                },
            })
            return { fullStream }
        },
    } as any
}

const stateSchema = z.object({
    projectPath: z.string().optional(),
    projectName: z.string().optional(),
    gitBranch: z.string().optional(),
    currentModelId: z
        .string()
        .default("anthropic/claude-sonnet-4-20250514"),
    // Keep placeholders for parity with old main.ts shape.
    yolo: z.boolean().default(false),
    observationThreshold: z.number().default(30_000),
    reflectionThreshold: z.number().default(40_000),
})

async function main() {
    const project = detectProject(process.cwd())
    const storage = createPlaceholderStore()
    const agent = createPlaceholderAgent()

    const harness = createMastraCodeHarness({
        id: "mastra-code",
        resourceId: project.resourceId,
        storage: storage as any,
        stateSchema: stateSchema as any,
        initialState: {
            projectPath: project.rootPath,
            projectName: project.name,
            gitBranch: project.gitBranch,
        },
        modes: [
            {
                id: "build",
                name: "Build",
                default: true,
                color: mastra.purple,
                agent,
            },
            {
                id: "plan",
                name: "Plan",
                color: mastra.blue,
                agent,
            },
            {
                id: "fast",
                name: "Fast",
                color: mastra.green,
                agent,
            },
        ],
    })

    // Placeholders for parity with old main.ts architecture.
    // TODO: Replace with real modules:
    // - Hook manager lifecycle
    // - MCP manager init/disconnect
    // - Notification and rich rendering components
    // - Auth/provider wiring

    const tui = new MastraTUI({
        harness,
        appName: "Mastra Code",
        version: "0.1.0",
        inlineQuestions: true,
    })

    await tui.run()
}

void main().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
})

