/**
 * Workspace Tools — Factory
 *
 * Creates the built-in workspace tools for agents. Individual tools are
 * defined in their own files; this module applies WorkspaceToolsConfig
 * (enabled, requireApproval, requireReadBeforeWrite) and injects workspace
 * into the tool execution context.
 */

import type { WorkspaceToolName } from '../constants';
import { WORKSPACE_TOOLS } from '../constants';
import { FileNotFoundError, FileReadRequiredError } from '../errors';
import { InMemoryFileReadTracker } from '../filesystem';
import type { FileReadTracker } from '../filesystem';
import type { Workspace } from '../workspace';
import { isAstGrepAvailable, astEditTool } from './ast-edit';
import { deleteFileTool } from './delete-file';
import { editFileTool } from './edit-file';
import { executeCommandTool, executeCommandWithBackgroundTool } from './execute-command';
import { fileStatTool } from './file-stat';
import { getProcessOutputTool } from './get-process-output';
import { grepTool } from './grep';
import { indexContentTool } from './index-content';
import { killProcessTool } from './kill-process';
import { listFilesTool } from './list-files';
import { mkdirTool } from './mkdir';
import { readFileTool } from './read-file';
import { searchTool } from './search';
import type { WorkspaceToolsConfig } from './types';
import { writeFileTool } from './write-file';

/**
 * Resolves the effective configuration for a specific tool.
 *
 * Resolution order (later overrides earlier):
 * 1. Built-in defaults (enabled: true, requireApproval: false)
 * 2. Top-level config (tools.enabled, tools.requireApproval)
 * 3. Per-tool config (tools[toolName].enabled, tools[toolName].requireApproval)
 */
export function resolveToolConfig(
  toolsConfig: WorkspaceToolsConfig | undefined,
  toolName: WorkspaceToolName,
): { enabled: boolean; requireApproval: boolean; requireReadBeforeWrite?: boolean } {
  let enabled = true;
  let requireApproval = false;
  let requireReadBeforeWrite: boolean | undefined;

  if (toolsConfig) {
    if (toolsConfig.enabled !== undefined) {
      enabled = toolsConfig.enabled;
    }
    if (toolsConfig.requireApproval !== undefined) {
      requireApproval = toolsConfig.requireApproval;
    }

    const perToolConfig = toolsConfig[toolName];
    if (perToolConfig) {
      if (perToolConfig.enabled !== undefined) {
        enabled = perToolConfig.enabled;
      }
      if (perToolConfig.requireApproval !== undefined) {
        requireApproval = perToolConfig.requireApproval;
      }
      if (perToolConfig.requireReadBeforeWrite !== undefined) {
        requireReadBeforeWrite = perToolConfig.requireReadBeforeWrite;
      }
    }
  }

  return { enabled, requireApproval, requireReadBeforeWrite };
}

// ---------------------------------------------------------------------------
// Wrapper helpers
// ---------------------------------------------------------------------------

/**
 * Clone a standalone tool with config overrides and inject workspace into context.
 */
function wrapTool(tool: any, workspace: Workspace, config: { requireApproval: boolean }): any {
  return {
    ...tool,
    requireApproval: config.requireApproval,
    execute: async (input: any, context: any = {}) => {
      const enrichedContext = { ...context, workspace: context?.workspace ?? workspace };
      return tool.execute(input, enrichedContext);
    },
  };
}

/**
 * Wrap a tool with read-before-write tracking (readTracker).
 *
 * - mode 'read': records the read after execution
 * - mode 'write': checks before execution, clears after
 */
function wrapWithReadTracker(
  tool: any,
  workspace: Workspace,
  readTracker: FileReadTracker,
  config: { requireApproval: boolean; requireReadBeforeWrite?: boolean },
  mode: 'read' | 'write',
): any {
  return {
    ...tool,
    requireApproval: config.requireApproval,
    execute: async (input: any, context: any = {}) => {
      const enrichedContext = { ...context, workspace: context?.workspace ?? workspace };

      // Pre-execution: check read-before-write for write tools
      if (mode === 'write' && config.requireReadBeforeWrite) {
        try {
          const stat = await workspace.filesystem!.stat(input.path);
          const check = readTracker.needsReRead(input.path, stat.modifiedAt);
          if (check.needsReRead) {
            throw new FileReadRequiredError(input.path, check.reason!);
          }
        } catch (error) {
          if (!(error instanceof FileNotFoundError)) {
            throw error;
          }
          // New file — no read required
        }
      }

      const result = await tool.execute(input, enrichedContext);

      // Post-execution: track reads / clear write records
      if (mode === 'read') {
        try {
          const stat = await workspace.filesystem!.stat(input.path);
          readTracker.recordRead(input.path, stat.modifiedAt);
        } catch {
          // Ignore stat errors for tracking
        }
      } else if (mode === 'write') {
        readTracker.clearReadRecord(input.path);
      }

      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates workspace tools that will be auto-injected into agents.
 *
 * @param workspace - The workspace instance to bind tools to
 * @returns Record of workspace tools
 */
export function createWorkspaceTools(workspace: Workspace) {
  const tools: Record<string, any> = {};
  const toolsConfig = workspace.getToolsConfig();
  const isReadOnly = workspace.filesystem?.readOnly ?? false;

  // Shared read tracker for requireReadBeforeWrite
  let readTracker: FileReadTracker | undefined;
  const writeFileConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
  const editFileConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
  const astEditConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);
  if (
    writeFileConfig.requireReadBeforeWrite ||
    editFileConfig.requireReadBeforeWrite ||
    astEditConfig.requireReadBeforeWrite
  ) {
    readTracker = new InMemoryFileReadTracker();
  }

  // Helper: add a tool with config-driven filtering
  const addTool = (
    name: WorkspaceToolName,
    tool: any,
    opts?: { requireWrite?: boolean; readTrackerMode?: 'read' | 'write' },
  ) => {
    const config = resolveToolConfig(toolsConfig, name);
    if (!config.enabled) return;
    if (opts?.requireWrite && isReadOnly) return;

    if (readTracker && opts?.readTrackerMode) {
      tools[name] = wrapWithReadTracker(tool, workspace, readTracker, config, opts.readTrackerMode);
    } else {
      tools[name] = wrapTool(tool, workspace, config);
    }
  };

  // Filesystem tools
  if (workspace.filesystem) {
    addTool(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE, readFileTool, { readTrackerMode: 'read' });
    addTool(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE, writeFileTool, {
      requireWrite: true,
      readTrackerMode: 'write',
    });
    addTool(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE, editFileTool, {
      requireWrite: true,
      readTrackerMode: 'write',
    });
    addTool(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES, listFilesTool);
    addTool(WORKSPACE_TOOLS.FILESYSTEM.DELETE, deleteFileTool, { requireWrite: true });
    addTool(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT, fileStatTool);
    addTool(WORKSPACE_TOOLS.FILESYSTEM.MKDIR, mkdirTool, { requireWrite: true });
    addTool(WORKSPACE_TOOLS.FILESYSTEM.GREP, grepTool);

    // AST edit tool (only if @ast-grep/napi is available at runtime)
    if (isAstGrepAvailable()) {
      addTool(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT, astEditTool, {
        requireWrite: true,
        readTrackerMode: 'write',
      });
    }
  }

  // Search tools
  if (workspace.canBM25 || workspace.canVector) {
    addTool(WORKSPACE_TOOLS.SEARCH.SEARCH, searchTool);
    addTool(WORKSPACE_TOOLS.SEARCH.INDEX, indexContentTool, { requireWrite: true });
  }

  // Sandbox tools
  if (workspace.sandbox) {
    const executeCommandConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
    if (workspace.sandbox.executeCommand && executeCommandConfig.enabled) {
      // Pick the right tool variant based on whether processes are available
      const baseTool = workspace.sandbox.processes ? executeCommandWithBackgroundTool : executeCommandTool;

      // Inject dynamic path context into description
      const pathContext = workspace.getPathContext();
      const pathInfo = pathContext.instructions ? `\n\n${pathContext.instructions}` : '';
      const description = pathInfo ? `${baseTool.description}${pathInfo}` : baseTool.description;

      tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND] = {
        ...wrapTool(baseTool, workspace, executeCommandConfig),
        description,
      };
    }

    // Background process tools (only when process manager is available)
    if (workspace.sandbox.processes) {
      addTool(WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT, getProcessOutputTool);
      addTool(WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS, killProcessTool);
    }
  }

  return tools;
}
