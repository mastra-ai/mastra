/**
 * TodoCheck tool — checks the completion status of the current todo list.
 * Helps the agent determine if all tasks are completed before ending work.
 *
 * Adapted for the monorepo: uses deps-based pattern instead of reading
 * from HarnessRuntimeContext, since HarnessRequestContext is serializable-only.
 */
import { createTool } from "@mastra/core/tools"
import { z } from "zod"

export interface TodoCheckDeps {
    /** Get the current harness state (including todos). */
    getState: () => Record<string, unknown>
}

export function createTodoCheckTool(deps: TodoCheckDeps) {
    return createTool({
        id: "todo_check",
        description: `Check the completion status of your current todo list. Use this before deciding to end work on a task to ensure all todos are completed.

Returns:
- Total number of todos
- Number of completed, in progress, and pending tasks
- List of incomplete tasks (if any)
- Boolean indicating if all tasks are done`,
        inputSchema: z.object({}),
        execute: async () => {
            try {
                const state = deps.getState()
                const typedState = state as {
                    todos?: Array<{
                        content: string
                        status: "pending" | "in_progress" | "completed"
                        activeForm: string
                    }>
                }

                const todos = typedState.todos || []

                if (todos.length === 0) {
                    return {
                        content:
                            "No todos found. Consider using todo_write to create a task list for complex work.",
                        isError: false,
                    }
                }

                const completed = todos.filter(
                    (t) => t.status === "completed",
                )
                const inProgress = todos.filter(
                    (t) => t.status === "in_progress",
                )
                const pending = todos.filter((t) => t.status === "pending")
                const incomplete = [...inProgress, ...pending]
                const allDone = incomplete.length === 0

                let response = `Todo Status: [${completed.length}/${todos.length} completed]\n`
                response += `- Completed: ${completed.length}\n`
                response += `- In Progress: ${inProgress.length}\n`
                response += `- Pending: ${pending.length}\n`
                response += `\nAll tasks completed: ${allDone ? "✓ YES" : "✗ NO"}`

                if (!allDone) {
                    response += "\n\nIncomplete tasks:"
                    if (inProgress.length > 0) {
                        response += "\n\nIn Progress:"
                        inProgress.forEach((t) => {
                            response += `\n- ${t.content}`
                        })
                    }
                    if (pending.length > 0) {
                        response += "\n\nPending:"
                        pending.forEach((t) => {
                            response += `\n- ${t.content}`
                        })
                    }
                    response +=
                        "\n\nContinue working on these tasks before ending."
                }

                return { content: response, isError: false }
            } catch (error) {
                const msg =
                    error instanceof Error ? error.message : "Unknown error"
                return {
                    content: `Failed to check todos: ${msg}`,
                    isError: true,
                }
            }
        },
    })
}
