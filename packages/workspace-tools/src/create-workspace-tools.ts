import type { Tool } from '@mastra/core/tools';
import { WORKSPACE_TOOLS } from '@mastra/core/workspace';

import { deleteFileTool } from './delete-file';
import { editFileTool } from './edit-file';
import { executeCommandTool } from './execute-command';
import { fileStatTool } from './file-stat';
import { indexContentTool } from './index-content';
import { listFilesTool } from './list-files';
import { mkdirTool } from './mkdir';
import { readFileTool } from './read-file';
import { searchTool } from './search';
import { writeFileTool } from './write-file';

const ALL_TOOLS: Record<string, Tool<any, any, any>> = {
  [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: readFileTool,
  [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: writeFileTool,
  [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: editFileTool,
  [WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]: listFilesTool,
  [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: deleteFileTool,
  [WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT]: fileStatTool,
  [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: mkdirTool,
  [WORKSPACE_TOOLS.SEARCH.SEARCH]: searchTool,
  [WORKSPACE_TOOLS.SEARCH.INDEX]: indexContentTool,
  [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: executeCommandTool,
};

export interface CreateWorkspaceToolsOptions {
  /**
   * Which tools to include. If omitted, all tools are included.
   * Use tool IDs from WORKSPACE_TOOLS constants, or pass tool names directly.
   */
  include?: string[];

  /**
   * Which tools to exclude. Applied after `include`.
   */
  exclude?: string[];
}

/**
 * Creates a record of workspace tools for use with Mastra agents.
 *
 * @example
 * ```typescript
 * import { createWorkspaceTools } from '@mastra/workspace-tools';
 *
 * // All tools
 * const agent = new Agent({
 *   tools: createWorkspaceTools(),
 *   workspace: new Workspace({ filesystem }),
 * });
 *
 * // Only specific tools
 * const agent = new Agent({
 *   tools: createWorkspaceTools({
 *     include: ['mastra_workspace_read_file', 'mastra_workspace_write_file'],
 *   }),
 *   workspace: new Workspace({ filesystem }),
 * });
 *
 * // All except some
 * const agent = new Agent({
 *   tools: createWorkspaceTools({
 *     exclude: ['mastra_workspace_execute_command'],
 *   }),
 *   workspace: new Workspace({ filesystem }),
 * });
 * ```
 */
export function createWorkspaceTools(
  options?: CreateWorkspaceToolsOptions,
): Record<string, Tool<any, any, any>> {
  let tools = { ...ALL_TOOLS };

  if (options?.include) {
    const includeSet = new Set(options.include);
    tools = Object.fromEntries(Object.entries(tools).filter(([key]) => includeSet.has(key)));
  }

  if (options?.exclude) {
    const excludeSet = new Set(options.exclude);
    tools = Object.fromEntries(Object.entries(tools).filter(([key]) => !excludeSet.has(key)));
  }

  return tools;
}
