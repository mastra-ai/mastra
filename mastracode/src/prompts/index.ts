/**
 * Prompt system — exports the prompt builder and mode-specific prompts.
 */

export { buildBasePrompt } from "./base.js"
export { buildModePrompt, buildModePromptFn } from "./build.js"
export { planModePrompt } from "./plan.js"
export { fastModePrompt } from "./fast.js"

import {
	buildBasePrompt,
	type PromptContext as BasePromptContext,
} from "./base.js"
import { buildModePromptFn } from "./build.js"
import { planModePrompt } from "./plan.js"
import { fastModePrompt } from "./fast.js"
import {
	loadAgentInstructions,
	formatAgentInstructions,
} from "../utils/agent-instructions.js"

// Extended prompt context that includes runtime information
export interface PromptContext extends BasePromptContext {
	modeId: string
	state?: any
	currentDate: string
	workingDir: string
	availableTools?: string // Mode-specific available tools
}

const modePrompts: Record<string, string | ((ctx: PromptContext) => string)> = {
	build: buildModePromptFn,
	plan: planModePrompt,
	fast: fastModePrompt,
}

/**
 * Build the full system prompt for a given mode and context.
 * Combines the base prompt with mode-specific instructions.
 */
export function buildFullPrompt(ctx: PromptContext): string {
	// Map new context to base context
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

	// Add available tools section if provided
	let toolsSection = ""
	if (ctx.availableTools) {
		toolsSection = `\n# Available Tools for ${ctx.modeId} mode:\n${ctx.availableTools}\n`
	}

	// Inject current todo state so agent doesn't lose track after OM truncation
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

	// Load and inject agent instructions from AGENT.md/CLAUDE.md files
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
