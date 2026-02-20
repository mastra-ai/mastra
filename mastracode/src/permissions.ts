/**
 * Granular tool permission system.
 *
 * Tools are classified into categories by risk level.
 * Each category has a configurable policy: "allow", "ask", or "deny".
 * Session-scoped grants let the user approve a category once per session.
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type ToolCategory = 'read' | 'edit' | 'execute' | 'mcp';

export const TOOL_CATEGORIES: Record<ToolCategory, { label: string; description: string }> = {
  read: {
    label: 'Read',
    description: 'Read files, search, list directories',
  },
  edit: {
    label: 'Edit',
    description: 'Create, modify, or delete files',
  },
  execute: {
    label: 'Execute',
    description: 'Run shell commands',
  },
  mcp: {
    label: 'MCP',
    description: 'External MCP server tools',
  },
};

// ---------------------------------------------------------------------------
// Tool → Category mapping
// ---------------------------------------------------------------------------

const TOOL_CATEGORY_MAP: Record<string, ToolCategory> = {
  // Read-only tools — always safe
  view: 'read',
  search_content: 'read',
  find_files: 'read',
  web_search: 'read',
  'web-search': 'read',
  web_extract: 'read',
  'web-extract': 'read',
  // Edit tools — modify files
  string_replace_lsp: 'edit',
  ast_smart_edit: 'edit',
  write_file: 'edit',
  subagent: 'edit',

  // Execute tools — run arbitrary commands
  execute_command: 'execute',

  // Interactive / planning tools — always allowed (no category needed)
  // ask_user, task_write, task_check, submit_plan, request_sandbox_access
};

// Tools that never need approval regardless of policy
const ALWAYS_ALLOW_TOOLS = new Set(['ask_user', 'task_write', 'task_check', 'submit_plan', 'request_sandbox_access']);

/**
 * Get the category for a tool, or null if the tool is always-allowed.
 */
export function getToolCategory(toolName: string): ToolCategory | null {
  if (ALWAYS_ALLOW_TOOLS.has(toolName)) return null;
  return TOOL_CATEGORY_MAP[toolName] ?? 'mcp';
}

/**
 * Get the list of known tools for a given category.
 */
export function getToolsForCategory(category: ToolCategory): string[] {
  return Object.entries(TOOL_CATEGORY_MAP)
    .filter(([, cat]) => cat === category)
    .map(([tool]) => tool);
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export type PermissionPolicy = 'allow' | 'ask' | 'deny';

export interface PermissionRules {
  /** Policy per category. Missing categories default to their DEFAULT_POLICIES value. */
  categories: Partial<Record<ToolCategory, PermissionPolicy>>;
  /** Per-tool overrides. Tool name → policy. Takes precedence over category. */
  tools: Record<string, PermissionPolicy>;
}

/** Default policies when no rules are configured (YOLO=false equivalent). */
export const DEFAULT_POLICIES: Record<ToolCategory, PermissionPolicy> = {
  read: 'allow',
  edit: 'ask',
  execute: 'ask',
  mcp: 'ask',
};

/** YOLO-mode policies — everything auto-allowed. */
export const YOLO_POLICIES: Record<ToolCategory, PermissionPolicy> = {
  read: 'allow',
  edit: 'allow',
  execute: 'allow',
  mcp: 'allow',
};

export function createDefaultRules(): PermissionRules {
  return {
    categories: { ...DEFAULT_POLICIES },
    tools: {},
  };
}

// ---------------------------------------------------------------------------
// Session grants — temporary "always allow" for this session
// ---------------------------------------------------------------------------

export class SessionGrants {
  private grantedCategories = new Set<ToolCategory>();
  private grantedTools = new Set<string>();

  allowCategory(category: ToolCategory): void {
    this.grantedCategories.add(category);
  }

  allowTool(toolName: string): void {
    this.grantedTools.add(toolName);
  }

  isGranted(toolName: string, category: ToolCategory): boolean {
    return this.grantedTools.has(toolName) || this.grantedCategories.has(category);
  }

  reset(): void {
    this.grantedCategories.clear();
    this.grantedTools.clear();
  }

  getGrantedCategories(): ToolCategory[] {
    return [...this.grantedCategories];
  }

  getGrantedTools(): string[] {
    return [...this.grantedTools];
  }
}

// ---------------------------------------------------------------------------
// Decision engine
// ---------------------------------------------------------------------------

export type ApprovalDecision = 'allow' | 'ask' | 'deny';

/**
 * Determine whether a tool call should be allowed, prompted, or denied.
 *
 * Priority order:
 *  1. Always-allowed tools (ask_user, task_write, etc.) → allow
 *  2. Per-tool policy override → use that policy
 *  3. Session grants (user said "always allow" during this session) → allow
 *  4. Category policy → use that policy
 *  5. Fallback → "ask"
 */
export function resolveApproval(
  toolName: string,
  rules: PermissionRules,
  sessionGrants: SessionGrants,
): ApprovalDecision {
  // 1. Always-allowed tools
  const category = getToolCategory(toolName);
  if (category === null) return 'allow';

  // 2. Per-tool override
  const toolPolicy = rules.tools[toolName];
  if (toolPolicy) return toolPolicy;

  // 3. Session grants
  if (sessionGrants.isGranted(toolName, category)) return 'allow';

  // 4. Category policy
  const categoryPolicy = rules.categories[category];
  if (categoryPolicy) return categoryPolicy;

  // 5. Default policy for category
  return DEFAULT_POLICIES[category] ?? 'ask';
}
