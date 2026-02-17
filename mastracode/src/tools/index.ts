/**
 * Tool exports for mastracode.
 *
 * File operations (read, write, edit, list, delete, stat, mkdir) are provided
 * by @mastra/core workspace tools via createWorkspaceTools(). This module only
 * exports tools that go beyond what workspace provides.
 */

// Regex content search (ripgrep) — workspace has BM25/vector, not regex grep
export { createGrepTool } from "./grep"

// Enhanced command execution with tail extraction, abort, tree-kill
export { createExecuteCommandTool, executeCommandTool } from "./shell"

// Fuzzy string replacement engine (handles whitespace drift, line numbers, etc.)
export { FileEditor, sharedFileEditor } from "./file-editor"

// Web search + content extraction (Tavily-powered)
export { createWebSearchTool, createWebExtractTool, hasTavilyKey } from "./web-search"

// Agent interaction tools
export { askUserTool } from "./ask-user"
export { todoWriteTool } from "./todo"
export type { TodoItem } from "./todo"
export { submitPlanTool } from "./submit-plan"
export type { PlanApprovalResult } from "./submit-plan"

// Todo completion checker
export { createTodoCheckTool } from "./todo-check"
export type { TodoCheckDeps } from "./todo-check"

// Subagent spawning — delegates focused tasks to constrained agents
export { createSubagentTool, parseSubagentMeta } from "./subagent"
export type { SubagentToolDeps } from "./subagent"

// Sandbox access request (for paths outside project root)
export { requestSandboxAccessTool } from "./request-sandbox-access"

// Global confirmation tracking
export { setGlobalConfirmationId, getGlobalConfirmationId } from "./wrap-with-confirmation"

// Path security helpers (used by tools that touch local FS directly)
export { isPathAllowed, assertPathAllowed, getAllowedPathsFromContext } from "./security"
