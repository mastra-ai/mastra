/**
 * ask_user tool — presents structured questions to the user via TUI dialogs.
 * Supports single-select options and free-text input.
 */
import { createTool } from "@mastra/core/tools"
import { z } from "zod"

let questionCounter = 0

export const askUserTool = createTool({
    id: "ask_user",
    description: `Ask the user a question and wait for their response. Use this when you need clarification, want to validate assumptions, or need the user to make a decision between options. Provide options for structured choices (2-4 options), or omit them for open-ended questions.`,
    inputSchema: z.object({
        question: z
            .string()
            .min(1)
            .describe("The question to ask the user. Should be clear and specific."),
        options: z
            .array(
                z.object({
                    label: z
                        .string()
                        .describe("Short display text for this option (1-5 words)"),
                    description: z
                        .string()
                        .optional()
                        .describe("Explanation of what this option means"),
                }),
            )
            .optional()
            .describe(
                "Optional choices. If provided, shows a selection list. If omitted, shows a free-text input.",
            ),
    }),
    execute: async ({ question, options }, context) => {
        try {
            const harnessCtx = (context as any)?.requestContext?.get("harness")

            if (!harnessCtx?.emitEvent || !harnessCtx?.registerQuestion) {
                return {
                    content: `[Question for user]: ${question}${options ? "\nOptions: " + options.map((o: any) => o.label).join(", ") : ""}`,
                    isError: false,
                }
            }

            const questionId = `q_${++questionCounter}_${Date.now()}`

            const answer = await new Promise<string>((resolve) => {
                harnessCtx.registerQuestion!(questionId, resolve)
                harnessCtx.emitEvent!({
                    type: "ask_question",
                    questionId,
                    question,
                    options,
                } as any)
            })

            return { content: `User answered: ${answer}`, isError: false }
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Unknown error"
            return { content: `Failed to ask user: ${msg}`, isError: true }
        }
    },
})
