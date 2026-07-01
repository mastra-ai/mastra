import type { WorkspaceToolsConfig } from '@mastra/core/workspace';
import { MC_TOOLS, TOOL_NAME_OVERRIDES } from '../tool-names.js';

export const MASTRACODE_WORKSPACE_TOOLS: WorkspaceToolsConfig = {
  ...TOOL_NAME_OVERRIDES,
};

export const PLAN_MODE_AVAILABLE_TOOLS: readonly string[] = [
  // Read-only exploration tools
  MC_TOOLS.VIEW,
  MC_TOOLS.FIND_FILES,
  MC_TOOLS.SEARCH_CONTENT,
  MC_TOOLS.FILE_STAT,
  MC_TOOLS.LSP_INSPECT,
  // Plan file writing (visibility gated by availableTools; the shared workspace
  // is mode-agnostic and does not path-restrict these — plan-mode instructions
  // scope writes to .mastracode/plans/)
  MC_TOOLS.WRITE_FILE,
  MC_TOOLS.STRING_REPLACE_LSP,
  // Plan delivery tools
  'ask_user',
  'submit_plan',
  // Task tools for plan-stage tracking
  'task_write',
  'task_update',
  'task_complete',
  'task_check',
  // Notification access
  MC_TOOLS.NOTIFICATION_INBOX,
  // Read-only workflow inspection (no create/run/delete in plan mode).
  'list-workflows',
  'get-workflow',
];

export const EXPLORE_MODE_AVAILABLE_TOOLS: readonly string[] = [
  MC_TOOLS.VIEW,
  MC_TOOLS.FIND_FILES,
  MC_TOOLS.SEARCH_CONTENT,
  MC_TOOLS.FILE_STAT,
  MC_TOOLS.LSP_INSPECT,
  'ask_user',
  // Read-only workflow inspection (no create/run/delete in fast mode either).
  'list-workflows',
  'get-workflow',
];

export const GOAL_JUDGE_READONLY_TOOLS: readonly string[] = [
  MC_TOOLS.VIEW,
  MC_TOOLS.SEARCH_CONTENT,
  MC_TOOLS.FIND_FILES,
  MC_TOOLS.FILE_STAT,
  MC_TOOLS.LSP_INSPECT,
];
