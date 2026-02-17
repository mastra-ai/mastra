/**
 * Prompt system — exports the prompt builder and mode-specific prompts.
 */

export { buildBasePrompt } from "./base"
export { buildModePrompt, buildModePromptFn } from "./build"
export { planModePrompt } from "./plan"
export { fastModePrompt } from "./fast"

import {
    buildBasePrompt,
    type PromptContext as BasePromptContext,
} from "./base"
import { buildModePromptFn } from "./build"
import { planModePrompt } from "./plan"
import { fastModePrompt } from "./fast"
import {
    loadAgentInstructions,
    formatAgentInstructions,
} from "../utils/instructions"

/**
 * Extended prompt context that includes runtime information.
 */
export interface PromptContext extends BasePromptContext {
    modeId: string
    state?: any
    currentDate: string
    workingDir: string
    /** Mode-specific available tools description */
    availableTools?: string
}

const modePrompts: Record<string, string | ((ctx: PromptContext) => string)> = {
    build: buildModePromptFn,
    plan: planModePrompt,
    fast: fastModePrompt,
}

/**
 * Build the full system prompt for a given mode and context.
 * Combines the base prompt with mode-specific instructions,
 * available tools, current todo state, and agent instructions.
 */
export function buildFullPrompt(ctx: PromptContext): string {
    const baseCtx: BasePromptContext = {
        projectPath: ctx.workingDir,
        projectName: ctx.projectName || "unknown",
        gitBranch: ctx.gitBranch,
        platform: process.platform,
        date: ctx.currentDate,
        mode: ctx.modeId,
        activePlan: ctx.state?.activePlan,
    }

    const base = buildBasePrompt(baseCtx)
    const entry = modePrompts[ctx.modeId] || modePrompts.build
    const modeSpecific = typeof entry === "function" ? entry(ctx) : entry

    let toolsSection = ""
    if (ctx.availableTools) {
        toolsSection = `\n# Available Tools for ${ctx.modeId} mode:\n${ctx.availableTools}\n`
    }

    let todoSection = ""
    const todos = ctx.state?.todos as
        | { content: string; status: string; activeForm: string }[]
        | undefined
    if (todos && todos.length > 0) {
        const lines = todos.map((t) => {
            const icon =
                t.status === "completed" ? "✓" : t.status === "in_progress" ? "▸" : "○"
            return `  ${icon} [${t.status}] ${t.content}`
        })
        todoSection = `\n<current-task-list>\n${lines.join("\n")}\n</current-task-list>\n`
    }

    const instructionSources = loadAgentInstructions(ctx.workingDir)
    const instructionsSection = formatAgentInstructions(instructionSources)

    return (
        base +
        toolsSection +
        todoSection +
        instructionsSection +
        "\n" +
        modeSpecific
    )
}
