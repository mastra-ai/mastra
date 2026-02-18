/**
 * Subagent type definitions.
 *
 * A subagent is a lightweight Agent instance with a constrained tool set,
 * spawned by the parent agent via the `task` meta-tool. Each subagent runs
 * in its own conversation thread and returns a single text result.
 */

export interface SubagentDefinition {
	/** Unique identifier for this subagent type (e.g., "explore", "plan") */
	id: string

	/** Human-readable name shown in tool output */
	name: string

	/** System prompt for this subagent */
	instructions: string

	/**
	 * Which tool IDs this subagent may use.
	 * These are keys from the parent agent's tool registry
	 * (e.g., "view", "search_content", "find_files").
	 */
	allowedTools: string[]
}
