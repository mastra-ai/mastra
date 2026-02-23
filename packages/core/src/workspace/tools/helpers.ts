/**
 * Workspace Tool Helpers
 *
 * Runtime assertions for extracting workspace resources from tool execution context.
 */

import type { ToolExecutionContext } from '../../tools/types';
import { WorkspaceNotAvailableError, FilesystemNotAvailableError, SandboxNotAvailableError } from '../errors';
import type { WorkspaceFilesystem } from '../filesystem';
import type { WorkspaceSandbox } from '../sandbox';
import type { Workspace } from '../workspace';

/**
 * Extract workspace from tool execution context.
 * Throws if workspace is not available.
 */
export function requireWorkspace(context: ToolExecutionContext): Workspace {
  if (!context?.workspace) {
    throw new WorkspaceNotAvailableError();
  }
  return context.workspace;
}

/**
 * Extract filesystem from workspace in tool execution context.
 * Throws if workspace or filesystem is not available.
 */
export function requireFilesystem(context: ToolExecutionContext): {
  workspace: Workspace;
  filesystem: WorkspaceFilesystem;
} {
  const workspace = requireWorkspace(context);
  if (!workspace.filesystem) {
    throw new FilesystemNotAvailableError();
  }
  return { workspace, filesystem: workspace.filesystem };
}

/**
 * Extract sandbox from workspace in tool execution context.
 * Throws if workspace or sandbox is not available.
 */
export function requireSandbox(context: ToolExecutionContext): {
  workspace: Workspace;
  sandbox: WorkspaceSandbox;
} {
  const workspace = requireWorkspace(context);
  if (!workspace.sandbox) {
    throw new SandboxNotAvailableError();
  }
  return { workspace, sandbox: workspace.sandbox };
}

/**
 * Emit workspace metadata as a data chunk so the UI can render workspace info immediately.
 * Should be called at the start of every workspace tool's execute function.
 */
export async function emitWorkspaceMetadata(context: ToolExecutionContext, toolName: string) {
  const workspace = requireWorkspace(context);
  const info = await workspace.getInfo();
  const toolCallId = context?.agent?.toolCallId;
  await context?.writer?.custom({
    type: 'data-workspace-metadata',
    data: { toolName, toolCallId, ...info },
  });
}
