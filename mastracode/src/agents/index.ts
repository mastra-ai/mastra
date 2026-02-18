/**
 * Subagent registry — maps subagent IDs to their definitions.
 */

import { executeSubagent } from "./execute.js"
import { exploreSubagent } from "./explore.js"
import { planSubagent } from "./plan.js"

import type { SubagentDefinition } from "./types.js"
/** All registered subagent definitions, keyed by ID. */
const subagentRegistry: Record<string, SubagentDefinition> = {
	explore: exploreSubagent,
	plan: planSubagent,
	execute: executeSubagent,
}

/**
 * Look up a subagent definition by ID.
 * Returns undefined if not found.
 */
export function getSubagentDefinition(
	id: string,
): SubagentDefinition | undefined {
	return subagentRegistry[id]
}

/**
 * Get all registered subagent IDs (for tool description / validation).
 */
export function getSubagentIds(): string[] {
	return Object.keys(subagentRegistry)
}
