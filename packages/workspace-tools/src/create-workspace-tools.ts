import type { Tool } from '@mastra/core/tools';
import { WORKSPACE_TOOLS } from '@mastra/core/workspace';
import type { Workspace } from '@mastra/core/workspace';
import type { RequestContext } from '@mastra/core/di';

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

const FILESYSTEM_TOOLS: Record<string, Tool<any, any, any>> = {
  [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: readFileTool,
  [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: writeFileTool,
  [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: editFileTool,
  [WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]: listFilesTool,
  [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: deleteFileTool,
  [WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT]: fileStatTool,
  [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: mkdirTool,
};

const SEARCH_TOOLS: Record<string, Tool<any, any, any>> = {
  [WORKSPACE_TOOLS.SEARCH.SEARCH]: searchTool,
  [WORKSPACE_TOOLS.SEARCH.INDEX]: indexContentTool,
};

const SANDBOX_TOOLS: Record<string, Tool<any, any, any>> = {
  [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: executeCommandTool,
};

const ALL_TOOLS: Record<string, Tool<any, any, any>> = {
  ...FILESYSTEM_TOOLS,
  ...SEARCH_TOOLS,
  ...SANDBOX_TOOLS,
};

export interface CreateWorkspaceToolsOptions {
  /**
   * Workspace instance. When provided, tools are filtered based on
   * workspace capabilities (e.g., no sandbox = no execute_command tool).
   *
   * Passed automatically when used as the function form of `WorkspaceConfig.tools`.
   */
  workspace?: Workspace;

  /**
   * Request context. Passed automatically when used as the function form
   * of `WorkspaceConfig.tools`.
   */
  requestContext?: RequestContext;

  /**
   * Which tools to include. If omitted, all applicable tools are included.
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
 * When a `workspace` is provided (or when used as the function form of
 * `WorkspaceConfig.tools`), tools are automatically filtered based on
 * workspace capabilities — filesystem tools require a filesystem, sandbox
 * tools require a sandbox, etc.
 *
 * @example
 * ```typescript
 * import { createWorkspaceTools } from '@mastra/workspace-tools';
 *
 * // As function form — auto-filters based on workspace capabilities
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './workspace' }),
 *   tools: createWorkspaceTools,
 * });
 *
 * // Static — all tools (filtering happens at execution time via context)
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './workspace' }),
 *   tools: createWorkspaceTools(),
 * });
 *
 * // With include/exclude
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './workspace' }),
 *   tools: createWorkspaceTools({
 *     exclude: ['mastra_workspace_execute_command'],
 *   }),
 * });
 * ```
 */
export function createWorkspaceTools(
  options?: CreateWorkspaceToolsOptions,
): Record<string, Tool<any, any, any>> {
  let tools: Record<string, Tool<any, any, any>>;

  const workspace = options?.workspace;

  if (workspace) {
    // Auto-filter based on workspace capabilities
    tools = {};
    if (workspace.filesystem) {
      Object.assign(tools, FILESYSTEM_TOOLS);
    }
    if (workspace.canBM25 || workspace.canVector) {
      Object.assign(tools, SEARCH_TOOLS);
    }
    if (workspace.sandbox) {
      Object.assign(tools, SANDBOX_TOOLS);
    }
  } else {
    // No workspace context — include all tools
    tools = { ...ALL_TOOLS };
  }

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
