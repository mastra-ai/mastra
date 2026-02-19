/**
 * TodoWrite tool — manages a structured task list for the coding session.
 * Full-replacement semantics: each call replaces the entire todo list.
 */
import { createTool } from "@mastra/core/tools"
import { z } from "zod/v3"
import type { HarnessRuntimeContext } from "../harness/types.js"

const todoItemSchema = z.object({
	content: z
		.string()
		.min(1)
		.describe(
			"Task description in imperative form (e.g., 'Fix authentication bug')",
		),
	status: z
		.enum(["pending", "in_progress", "completed"])
		.describe("Current task status"),
	activeForm: z
		.string()
		.min(1)
		.describe(
			"Present continuous form shown during execution (e.g., 'Fixing authentication bug')",
		),
})

export type TodoItem = z.infer<typeof todoItemSchema>

export const todoWriteTool = createTool({
	id: "todo_write",
	description: `Create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

Usage:
- Pass the FULL todo list each time (replaces previous list)
- Each todo has: content (imperative), status (pending|in_progress|completed), activeForm (present continuous)
- Mark tasks in_progress BEFORE starting work (only ONE at a time)
- Mark tasks completed IMMEDIATELY after finishing
- Use this for multi-step tasks requiring 3+ distinct actions

States:
- pending: Not yet started
- in_progress: Currently working on (limit to ONE)
- completed: Finished successfully`,
	inputSchema: z.object({
		todos: z.array(todoItemSchema).describe("The complete updated todo list"),
	}),
	execute: async ({ todos }, context) => {
		try {
			const harnessCtx = context?.requestContext?.get("harness") as
				| HarnessRuntimeContext
				| undefined

            if (harnessCtx) {
                // Always update state
                await harnessCtx.setState({ todos })
                
                // Always emit event immediately for real-time updates
                // The TUI will handle deduplication if needed
                harnessCtx.emitEvent?.({
                    type: "todo_updated",
                    todos,
                } as any)
            }

			// Build summary for the model's context
			const completed = todos.filter((t) => t.status === "completed").length
			const inProgress = todos.find((t) => t.status === "in_progress")
			const total = todos.length

			let summary = `Todos updated: [${completed}/${total} completed]`
			if (inProgress) {
				summary += `\nCurrently: ${inProgress.activeForm}`
			}

			return {
				content: summary,
				isError: false,
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error"
			return {
				content: `Failed to update todos: ${msg}`,
				isError: true,
			}
		}
	},
})
