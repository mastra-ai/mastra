/**
 * Subagent tool — spawns a subagent to perform a focused task.
 *
 * The parent agent calls this tool with a task description and agent type.
 * A fresh Agent instance is created with the subagent's constrained tool set,
 * runs via agent.stream(), and returns the text result.
 *
 * Stream events are forwarded to the parent harness so the TUI can show
 * real-time subagent activity (tool calls, text deltas, etc.).
 *
 * Note: emitEvent and abortSignal are passed through deps (closed over the
 * harness at construction time) rather than through HarnessRequestContext,
 * which is serializable-only.
 */
import { createTool } from "@mastra/core/tools"
import { Agent } from "@mastra/core/agent"
import { z } from "zod"
import { getSubagentDefinition, getSubagentIds } from "../agents"
import type { HarnessEvent } from "@mastra/core/harness"

export interface SubagentToolDeps {
    /**
     * The full tool registry from the parent agent.
     * The subagent will receive a subset based on its allowedTools.
     */
    tools: Record<string, any>

    /**
     * Function to resolve a model ID to a language model instance.
     * Shared with the parent agent so subagents use the same providers.
     */
    resolveModel: (modelId: string) => any

    /**
     * Emit a HarnessEvent to the TUI for live updates.
     * Closed over the harness instance at tool-construction time.
     */
    emitEvent: (event: HarnessEvent) => void

    /**
     * Get the current abort signal (changes per-stream invocation).
     * Returns undefined if no stream is active.
     */
    getAbortSignal?: () => AbortSignal | undefined

    /**
     * Resolve a configured model ID for a specific subagent type.
     * Used for per-type model overrides (e.g., "use fast model for explore").
     */
    getSubagentModelId?: (agentType: string) => Promise<string | undefined>

    /**
     * Model ID to use for subagent tasks.
     * Defaults to a fast model to keep costs down.
     */
    defaultModelId?: string

    /**
     * Restrict which agent types can be spawned.
     * If not provided, all registered agent types are available.
     */
    allowedAgentTypes?: string[]
}

const DEFAULT_SUBAGENT_MODEL = "anthropic/claude-sonnet-4-20250514"

export function createSubagentTool(deps: SubagentToolDeps) {
    const allAgentTypes = getSubagentIds()
    const validAgentTypes = deps.allowedAgentTypes
        ? allAgentTypes.filter((t) => deps.allowedAgentTypes!.includes(t))
        : allAgentTypes

    const typeDescriptions: Record<string, string> = {
        explore: `- **explore**: Read-only codebase exploration. Has access to read_file, list_files, and grep. Use for questions like "find all usages of X", "how does module Y work", "what files are related to Z".`,
        plan: `- **plan**: Read-only analysis and planning. Same tools as explore. Use for "create an implementation plan for X", "analyze the architecture of Y".`,
        execute: `- **execute**: Task execution with write capabilities. Has access to all tools including edit_file, write_file, and execute_command. Use for "implement feature X", "fix bug Y", "refactor module Z".`,
    }

    const availableTypesDocs = validAgentTypes
        .map((t) => typeDescriptions[t] ?? `- **${t}**`)
        .join("\n")

    const hasExecute = validAgentTypes.includes("execute")

    return createTool({
        id: "subagent",
        description: `Delegate a focused task to a specialized subagent. The subagent runs independently with a constrained toolset, then returns its findings as text.

Available agent types:
${availableTypesDocs}

The subagent runs in its own context — it does NOT see the parent conversation history. Write a clear, self-contained task description.

Use this tool when:
- You want to run multiple investigations in parallel
- The task is self-contained and can be delegated${hasExecute ? "\n- You want to perform a focused implementation task (execute type)" : ""}`,
        inputSchema: z.object({
            agentType: z
                .enum(validAgentTypes as [string, ...string[]])
                .describe("Type of subagent to spawn"),
            task: z
                .string()
                .describe(
                    "Clear, self-contained description of what the subagent should do. Include all relevant context — the subagent cannot see the parent conversation.",
                ),
            modelId: z
                .string()
                .optional()
                .describe(
                    `Model ID to use for this task. Defaults to ${DEFAULT_SUBAGENT_MODEL}.`,
                ),
        }),
        execute: async ({ agentType, task, modelId }) => {
            const definition = getSubagentDefinition(agentType)
            if (!definition) {
                return {
                    content: `Unknown agent type: ${agentType}. Valid types: ${validAgentTypes.join(", ")}`,
                    isError: true,
                }
            }

            const emitEvent = deps.emitEvent
            const abortSignal = deps.getAbortSignal?.()
            const toolCallId = "subagent-" + Date.now()

            // Build the constrained tool set
            const subagentTools: Record<string, any> = {}
            for (const toolId of definition.allowedTools) {
                if (deps.tools[toolId]) {
                    subagentTools[toolId] = deps.tools[toolId]
                }
            }

            // Resolve model with precedence:
            // 1. Explicit modelId from tool call
            // 2. Configured per-type model from harness
            // 3. Deps default model
            // 4. Hardcoded default
            const configuredSubagentModel =
                await deps.getSubagentModelId?.(agentType)

            const resolvedModelId =
                modelId ??
                configuredSubagentModel ??
                deps.defaultModelId ??
                DEFAULT_SUBAGENT_MODEL

            let model: any
            try {
                model = deps.resolveModel(resolvedModelId)
            } catch (err) {
                return {
                    content: `Failed to resolve model "${resolvedModelId}": ${err instanceof Error ? err.message : String(err)}`,
                    isError: true,
                }
            }

            // Create a fresh agent with constrained tools
            const subagent = new Agent({
                id: `subagent-${definition.id}`,
                name: `${definition.name} Subagent`,
                instructions: definition.instructions,
                model,
                tools: subagentTools,
            })

            const startTime = Date.now()

            emitEvent({
                type: "subagent_start",
                toolCallId,
                agentType,
                task,
                modelId: resolvedModelId,
            })

            let partialText = ""
            const toolCallLog: Array<{ name: string; isError?: boolean }> = []

            try {
                const response = await subagent.stream(task, {
                    maxSteps: 50,
                    abortSignal,
                })

                const reader = response.fullStream.getReader()

                while (true) {
                    const { done, value: chunk } = await reader.read()
                    if (done) break

                    switch (chunk.type) {
                        case "text-delta":
                            partialText += chunk.payload.text
                            emitEvent({
                                type: "subagent_text_delta",
                                toolCallId,
                                agentType,
                                textDelta: chunk.payload.text,
                            })
                            break

                        case "tool-call":
                            toolCallLog.push({
                                name: chunk.payload.toolName,
                            })
                            emitEvent({
                                type: "subagent_tool_start",
                                toolCallId,
                                agentType,
                                subToolName: chunk.payload.toolName,
                                subToolArgs: chunk.payload.args,
                            })
                            break

                        case "tool-result": {
                            const isErr = chunk.payload.isError ?? false
                            for (
                                let i = toolCallLog.length - 1;
                                i >= 0;
                                i--
                            ) {
                                if (
                                    toolCallLog[i]!.name ===
                                    chunk.payload.toolName &&
                                    toolCallLog[i]!.isError === undefined
                                ) {
                                    toolCallLog[i]!.isError = isErr
                                    break
                                }
                            }
                            emitEvent({
                                type: "subagent_tool_end",
                                toolCallId,
                                agentType,
                                subToolName: chunk.payload.toolName,
                                subToolResult: chunk.payload.result,
                                isError: isErr,
                            })
                            break
                        }
                    }
                }

                if (abortSignal?.aborted) {
                    const durationMs = Date.now() - startTime
                    const abortResult = partialText
                        ? `[Aborted by user]\n\nPartial output:\n${partialText}`
                        : "[Aborted by user]"

                    emitEvent({
                        type: "subagent_end",
                        toolCallId,
                        agentType,
                        result: abortResult,
                        isError: false,
                        durationMs,
                    })

                    return { content: abortResult, isError: false }
                }

                const fullOutput = await response.getFullOutput()
                const resultText = fullOutput.text || partialText

                const durationMs = Date.now() - startTime
                emitEvent({
                    type: "subagent_end",
                    toolCallId,
                    agentType,
                    result: resultText,
                    isError: false,
                    durationMs,
                })

                const meta = buildSubagentMeta(
                    resolvedModelId,
                    durationMs,
                    toolCallLog,
                )
                return { content: resultText + meta, isError: false }
            } catch (err) {
                const isAbort =
                    err instanceof Error &&
                    (err.name === "AbortError" ||
                        err.message?.includes("abort") ||
                        err.message?.includes("cancel"))
                const durationMs = Date.now() - startTime

                if (isAbort) {
                    const abortResult = partialText
                        ? `[Aborted by user]\n\nPartial output:\n${partialText}`
                        : "[Aborted by user]"

                    emitEvent({
                        type: "subagent_end",
                        toolCallId,
                        agentType,
                        result: abortResult,
                        isError: false,
                        durationMs,
                    })

                    const meta = buildSubagentMeta(
                        resolvedModelId,
                        durationMs,
                        toolCallLog,
                    )
                    return { content: abortResult + meta, isError: false }
                }

                const message =
                    err instanceof Error ? err.message : String(err)

                emitEvent({
                    type: "subagent_end",
                    toolCallId,
                    agentType,
                    result: message,
                    isError: true,
                    durationMs,
                })

                const meta = buildSubagentMeta(
                    resolvedModelId,
                    durationMs,
                    toolCallLog,
                )
                return {
                    content:
                        `Subagent "${definition.name}" failed: ${message}` +
                        meta,
                    isError: true,
                }
            }
        },
    })
}

/**
 * Build a metadata tag appended to subagent results.
 * The TUI parses this to display model ID, duration, and tool calls
 * when loading from history (where live events aren't available).
 */
function buildSubagentMeta(
    modelId: string,
    durationMs: number,
    toolCalls: Array<{ name: string; isError?: boolean }>,
): string {
    const tools = toolCalls
        .map((tc) => `${tc.name}:${tc.isError ? "err" : "ok"}`)
        .join(",")
    return `\n<subagent-meta modelId="${modelId}" durationMs="${durationMs}" tools="${tools}" />`
}

/**
 * Parse subagent metadata from a tool result string.
 * Returns the metadata and the cleaned result text (without the tag).
 */
export function parseSubagentMeta(content: string): {
    text: string
    modelId?: string
    durationMs?: number
    toolCalls?: Array<{ name: string; isError: boolean }>
} {
    const match = content.match(
        /\n<subagent-meta modelId="([^"]*)" durationMs="(\d+)" tools="([^"]*)" \/>$/,
    )
    if (!match) return { text: content }

    const text = content.slice(0, match.index!)
    const modelId = match[1]
    const durationMs = parseInt(match[2]!, 10)
    const toolCalls = match[3]
        ? match[3]
            .split(",")
            .filter(Boolean)
            .map((entry) => {
                const [name, status] = entry.split(":")
                return { name: name!, isError: status === "err" }
            })
        : []

    return { text, modelId, durationMs, toolCalls }
}
