import type { ToolCategory } from './types';

/**
 * A Harness session owns the per-conversation runtime state that today lives
 * flattened on the {@link Harness} instance. This class is the seam we extract
 * that state into, one concern at a time, so the Harness can eventually own a
 * `Session` rather than the state itself.
 *
 * Currently owns: session-scoped permission grants — the "allow for this
 * session" approvals a user makes when a tool or tool category is gated behind
 * the permission check.
 */
export class Session {
  /** Tool categories the user has granted "allow" for the lifetime of this session. */
  readonly #grantedCategories = new Set<string>();
  /** Individual tool names the user has granted "allow" for the lifetime of this session. */
  readonly #grantedTools = new Set<string>();

  /** Grant a tool category "allow" for the remainder of the session. */
  grantCategory(category: ToolCategory): void {
    this.#grantedCategories.add(category);
  }

  /** Grant an individual tool "allow" for the remainder of the session. */
  grantTool(toolName: string): void {
    this.#grantedTools.add(toolName);
  }

  /** Whether the given tool category has been granted for the session. */
  hasCategoryGrant(category: ToolCategory): boolean {
    return this.#grantedCategories.has(category);
  }

  /** Whether the given tool has been granted for the session. */
  hasToolGrant(toolName: string): boolean {
    return this.#grantedTools.has(toolName);
  }

  /** Snapshot of all session-scoped grants. */
  getGrants(): { categories: ToolCategory[]; tools: string[] } {
    return {
      categories: [...this.#grantedCategories] as ToolCategory[],
      tools: [...this.#grantedTools],
    };
  }
}
