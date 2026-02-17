/**
 * Subagent registry — maps subagent IDs to their definitions.
 */

export type { SubagentDefinition } from "./types"
export { exploreSubagent } from "./explore"
export { planSubagent } from "./plan"
export { executeSubagent } from "./execute"

import type { SubagentDefinition } from "./types"
import { exploreSubagent } from "./explore"
import { planSubagent } from "./plan"
import { executeSubagent } from "./execute"

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
