/**
 * Workspace Tools — Factory
 *
 * Creates the built-in workspace tools for agents. Individual tools are
 * defined in their own files; this module applies WorkspaceToolsConfig
 * (enabled, requireApproval, requireReadBeforeWrite) and injects workspace
 * into the tool execution context.
 */

import { RequestContext } from '../../request-context';
import type { WorkspaceToolName } from '../constants';
import { WORKSPACE_TOOLS } from '../constants';
import { FileNotFoundError, FileReadRequiredError } from '../errors';
import { InMemoryFileReadTracker, InMemoryFileWriteLock } from '../filesystem';
import type { FileReadTracker, FileWriteLock, WorkspaceFilesystem } from '../filesystem';
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
import { lspInspectTool } from './lsp-inspect';
import { mkdirTool } from './mkdir';
import { readFileTool } from './read-file';
import { searchTool } from './search';
import type {
  WorkspaceToolsConfig,
  DynamicToolConfigValue,
  ToolConfigContext,
  ToolConfigWithArgsContext,
} from './types';
export type {
  WorkspaceToolConfig,
  WorkspaceToolsConfig,
  ExecuteCommandToolConfig,
  BackgroundProcessConfig,
  BackgroundProcessMeta,
  BackgroundProcessExitMeta,
  ToolConfigContext,
  ToolConfigWithArgsContext,
  DynamicToolConfigValue,
} from './types';
import { writeFileTool } from './write-file';

/**
 * Resolve a DynamicToolConfigValue to a boolean.
 * If it's a function, calls it with the provided context.
 * On error, returns the safeDefault.
 */
async function resolveDynamicValue<TContext>(
  value: DynamicToolConfigValue<TContext> | undefined,
  context: TContext | undefined,
  safeDefault: boolean,
): Promise<boolean> {
  if (value === undefined) return safeDefault;
  if (typeof value === 'boolean') return value;
  if (!context) return safeDefault;
  try {
    return await value(context);
  } catch (error) {
    console.warn('[Workspace Tools] Dynamic config function threw, using safe default:', error);
    return safeDefault;
  }
}

function hasFilesystemConfig(workspace: Workspace): boolean {
  if (typeof (workspace as any)?.hasFilesystemConfig === 'function') {
    return (workspace as any).hasFilesystemConfig();
  }
  return !!workspace.filesystem;
}

/**
 * Normalize a requestContext value to a plain Record.
 * Callers may pass a Map-like RequestContext (with `.entries()`) or a plain
 * object.  Dynamic config functions always receive a plain object so that
 * bracket-notation access (`requestContext['key']`) works consistently.
 */
function toPlainRequestContext(requestContext: unknown): Record<string, unknown> {
  if (!requestContext) return {};
  if (typeof (requestContext as any).entries === 'function') {
    return Object.fromEntries((requestContext as any).entries());
  }
  return requestContext as Record<string, unknown>;
}

/** Resolved tool config with `enabled` as a boolean and execution-time values as raw config. */
export interface ResolvedToolConfig {
  enabled: boolean;
  requireApproval: DynamicToolConfigValue<ToolConfigWithArgsContext>;
  requireReadBeforeWrite?: DynamicToolConfigValue<ToolConfigWithArgsContext>;
  maxOutputTokens?: number;
  name?: string;
}

/**
 * Resolves the effective configuration for a specific tool.
 *
 * Resolution order (later overrides earlier):
 * 1. Built-in defaults (enabled: true, requireApproval: false)
 * 2. Top-level config (tools.enabled, tools.requireApproval)
 * 3. Per-tool config (tools[toolName].enabled, tools[toolName].requireApproval)
 *
 * `enabled` is resolved to a boolean immediately (requires context if dynamic).
 * `requireApproval` and `requireReadBeforeWrite` are passed through as-is
 * for execution-time evaluation (they may need args).
 */
export async function resolveToolConfig(
  toolsConfig: WorkspaceToolsConfig | undefined,
  toolName: WorkspaceToolName,
  context?: ToolConfigContext,
): Promise<ResolvedToolConfig> {
  let enabled: DynamicToolConfigValue = true;
  let requireApproval: DynamicToolConfigValue<ToolConfigWithArgsContext> = false;
  let requireReadBeforeWrite: DynamicToolConfigValue<ToolConfigWithArgsContext> | undefined;
  let maxOutputTokens: number | undefined;
  let name: string | undefined;

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
      if (perToolConfig.maxOutputTokens !== undefined) {
        maxOutputTokens = perToolConfig.maxOutputTokens;
      }
      if (perToolConfig.name !== undefined) {
        name = perToolConfig.name;
      }
    }
  }

  // Resolve `enabled` now (tool-listing time) — safe default: false (fail-closed)
  const resolvedEnabled = await resolveDynamicValue(enabled, context, false);

  return { enabled: resolvedEnabled, requireApproval, requireReadBeforeWrite, maxOutputTokens, name };
}

// ---------------------------------------------------------------------------
// Wrapper helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective workspace for tool execution. When a dynamic filesystem
 * resolver is configured (no static filesystem), resolves the filesystem from
 * requestContext and returns a proxy workspace that exposes it via `.filesystem`.
 * Falls back to the workspace as-is when a static filesystem is available.
 */
async function resolveEffectiveWorkspace(workspace: Workspace, context: any): Promise<Workspace> {
  if (!workspace.filesystem && hasFilesystemConfig(workspace)) {
    const requestContext = context?.requestContext ?? new RequestContext();
    const resolvedFs = await workspace.resolveFilesystem({ requestContext });
    if (resolvedFs) {
      return new Proxy(workspace, {
        get(target: any, prop: string | symbol) {
          if (prop === 'filesystem') return resolvedFs;
          return target[prop];
        },
      });
    }
  }
  return workspace;
}

/**
 * Clone a standalone tool with config overrides and inject workspace into context.
 * When the workspace uses a dynamic filesystem resolver, the filesystem is resolved
 * from requestContext and made available via the workspace proxy.
 */
function wrapTool(tool: any, workspace: Workspace): any {
  return {
    ...tool,
    execute: async (input: any, context: any = {}) => {
      const effectiveWorkspace = await resolveEffectiveWorkspace(context?.workspace ?? workspace, context);
      const enrichedContext = { ...context, workspace: effectiveWorkspace };
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
  config: { requireReadBeforeWrite?: DynamicToolConfigValue<ToolConfigWithArgsContext> },
  mode: 'read' | 'write',
): any {
  return {
    ...tool,
    execute: async (input: any, context: any = {}) => {
      const effectiveWorkspace = await resolveEffectiveWorkspace(context?.workspace ?? workspace, context);
      let enrichedContext: any = { ...context, workspace: effectiveWorkspace };
      const fs: WorkspaceFilesystem | undefined = effectiveWorkspace.filesystem;

      // Pre-execution: enforce read-before-write policy and/or attach
      // optimistic-concurrency mtime for write tools.
      if (mode === 'write' && fs) {
        // Optimistic concurrency: attach the mtime from the last read
        // *before* stat so it's preserved even when the file has been
        // deleted externally (stat throws FileNotFoundError).
        const record = readTracker.getReadRecord(input.path);
        if (record) {
          enrichedContext = { ...enrichedContext, __expectedMtime: record.modifiedAtRead };
        }

        try {
          const stat = await fs.stat(input.path);

          // Policy gate: require the agent to have read the file first.
          // Only evaluate when explicitly configured (opt-in policy).
          // Safe default true = fail-closed if a dynamic function throws.
          if (config.requireReadBeforeWrite !== undefined) {
            const shouldRequireRead = await resolveDynamicValue(
              config.requireReadBeforeWrite,
              { args: input, requestContext: enrichedContext.requestContext ?? {}, workspace: effectiveWorkspace },
              true,
            );
            if (shouldRequireRead) {
              const check = readTracker.needsReRead(input.path, stat.modifiedAt);
              if (check.needsReRead) {
                throw new FileReadRequiredError(input.path, check.reason!);
              }
            }
          }
        } catch (error) {
          if (!(error instanceof FileNotFoundError)) {
            throw error;
          }
          // Missing file: if a read record exists the expectedMtime is
          // already attached, so downstream writeFile can treat this as
          // stale. Otherwise it's a genuinely new file.
        }
      }

      const result = await tool.execute(input, enrichedContext);

      // Post-execution: track reads / clear write records
      if (mode === 'read' && fs) {
        try {
          const stat = await fs.stat(input.path);
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

/**
 * Wrap a tool with a per-file write lock.
 *
 * The lock serializes the entire execute pipeline (including any
 * read-before-write checks) so concurrent calls to the same path
 * run one at a time.
 */
function wrapWithWriteLock(tool: any, writeLock: FileWriteLock): any {
  return {
    ...tool,
    execute: async (input: any, context: any = {}) => {
      if (!input.path) {
        throw new Error('wrapWithWriteLock: input.path is required');
      }
      return writeLock.withLock(input.path, () => tool.execute(input, context));
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
export async function createWorkspaceTools(
  workspace: Workspace,
  configContext?: Omit<ToolConfigContext, 'requestContext'> & { requestContext?: unknown },
) {
  // Seed fallback context so dynamic enabled functions always get called,
  // even if the caller omits configContext.  Normalize requestContext so
  // user-provided functions always receive a plain Record, not a Map.
  const effectiveConfigContext: ToolConfigContext = configContext
    ? { ...configContext, requestContext: toPlainRequestContext(configContext.requestContext) }
    : { requestContext: {}, workspace };
  const tools: Record<string, any> = {};
  const toolsConfig = workspace.getToolsConfig();
  const isReadOnly = workspace.filesystem?.readOnly ?? false;

  // Shared write lock — serializes concurrent writes to the same file path
  const writeLock: FileWriteLock = new InMemoryFileWriteLock();

  // Shared read tracker — always active so optimistic concurrency (mtime
  // checking) works on every write, regardless of the requireReadBeforeWrite
  // policy setting.
  const readTracker: FileReadTracker = new InMemoryFileReadTracker();

  // Helper: add a tool with config-driven filtering
  const addTool = async (
    name: WorkspaceToolName,
    tool: any,
    opts?: { requireWrite?: boolean; readTrackerMode?: 'read' | 'write'; useWriteLock?: boolean },
  ) => {
    const config = await resolveToolConfig(toolsConfig, name, effectiveConfigContext);
    if (!config.enabled) return;
    if (opts?.requireWrite && isReadOnly) return;

    // Handle dynamic requireApproval: if it's a function, store as needsApprovalFn
    // and set requireApproval to true so the execution pipeline knows to check
    let wrapped: any;
    if (typeof config.requireApproval === 'function') {
      const approvalFn = config.requireApproval;
      wrapped = {
        ...tool,
        requireApproval: true,
        needsApprovalFn: async (
          args: Record<string, unknown>,
          ctx?: {
            requestContext?: Record<string, unknown> | { entries(): Iterable<[string, unknown]> };
            workspace?: object;
          },
        ) =>
          resolveDynamicValue(
            approvalFn,
            {
              args,
              requestContext: toPlainRequestContext(ctx?.requestContext),
              workspace: ctx?.workspace ?? workspace,
            },
            true,
          ),
      };
    } else {
      wrapped = { ...tool, requireApproval: config.requireApproval };
    }

    if (opts?.readTrackerMode) {
      wrapped = wrapWithReadTracker(wrapped, workspace, readTracker, config, opts.readTrackerMode);
    } else {
      wrapped = wrapTool(wrapped, workspace);
    }

    // Write lock is outermost — serializes the entire enriched execute pipeline
    if (opts?.useWriteLock) {
      wrapped = wrapWithWriteLock(wrapped, writeLock);
    }

    // Use custom name if provided, otherwise use the default constant name
    const exposedName = config.name ?? name;
    if (tools[exposedName]) {
      throw new Error(
        `Duplicate workspace tool name "${exposedName}": tool "${name}" conflicts with an already-registered tool. ` +
          `Check your tools config for duplicate "name" values.`,
      );
    }
    // When the tool is renamed, update its id to match so fallback-by-id
    // resolution (in tool-call-step, llm-execution-step, etc.) won't allow
    // the model to call the tool using the old default name.
    if (exposedName !== name && 'id' in wrapped) {
      wrapped = { ...wrapped, id: exposedName };
    }
    tools[exposedName] = wrapped;
  };

  // Filesystem tools — add when filesystem is available (static instance or resolver function)
  if (hasFilesystemConfig(workspace)) {
    await addTool(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE, readFileTool, { readTrackerMode: 'read' });
    await addTool(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE, writeFileTool, {
      requireWrite: true,
      readTrackerMode: 'write',
      useWriteLock: true,
    });
    await addTool(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE, editFileTool, {
      requireWrite: true,
      readTrackerMode: 'write',
      useWriteLock: true,
    });
    await addTool(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES, listFilesTool);
    await addTool(WORKSPACE_TOOLS.FILESYSTEM.DELETE, deleteFileTool, { requireWrite: true, useWriteLock: true });
    await addTool(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT, fileStatTool);
    await addTool(WORKSPACE_TOOLS.FILESYSTEM.MKDIR, mkdirTool, { requireWrite: true });
    await addTool(WORKSPACE_TOOLS.FILESYSTEM.GREP, grepTool);

    // AST edit tool (only if @ast-grep/napi is available at runtime)
    if (isAstGrepAvailable()) {
      await addTool(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT, astEditTool, {
        requireWrite: true,
        readTrackerMode: 'write',
        useWriteLock: true,
      });
    }
  }

  // Search tools
  if (workspace.canBM25 || workspace.canVector) {
    await addTool(WORKSPACE_TOOLS.SEARCH.SEARCH, searchTool);
    await addTool(WORKSPACE_TOOLS.SEARCH.INDEX, indexContentTool, { requireWrite: true });
  }

  // Sandbox tools
  if (workspace.sandbox) {
    if (workspace.sandbox.executeCommand) {
      // Pick the right tool variant based on whether processes are available
      const baseTool = workspace.sandbox.processes ? executeCommandWithBackgroundTool : executeCommandTool;
      await addTool(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND, baseTool);
    }

    // Background process tools (only when process manager is available)
    if (workspace.sandbox.processes) {
      await addTool(WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT, getProcessOutputTool);
      await addTool(WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS, killProcessTool);
    }
  }

  // LSP tools — always available (tool handles case when LSP not configured)
  await addTool(WORKSPACE_TOOLS.LSP.LSP_INSPECT, lspInspectTool);

  return tools;
}
