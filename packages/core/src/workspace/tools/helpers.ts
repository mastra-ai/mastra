/**
 * Workspace Tool Helpers
 *
 * Runtime assertions for extracting workspace resources from tool execution context.
 */

import { join, isAbsolute } from 'node:path';

import type { ToolExecutionContext } from '../../tools/types';
import { WorkspaceNotAvailableError, FilesystemNotAvailableError, SandboxNotAvailableError } from '../errors';
import type { WorkspaceFilesystem } from '../filesystem';
import type { LSPDiagnostic, DiagnosticSeverity } from '../lsp/types';
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
  await context?.writer?.custom({
    type: 'data-workspace-metadata',
    data: { toolName, ...info },
  });
}

/**
 * Get LSP diagnostics text to append to edit tool results.
 * Non-blocking — returns empty string on any failure.
 *
 * @param workspace - The workspace instance
 * @param filePath - Relative path within the filesystem (as used by the tool)
 * @param content - The file content after the edit
 * @returns Formatted diagnostics text, or empty string if unavailable
 */
export async function getEditDiagnosticsText(workspace: Workspace, filePath: string, content: string): Promise<string> {
  try {
    const lspManager = workspace.lsp;
    if (!lspManager) return '';

    const basePath = workspace.filesystem?.basePath;
    if (!basePath) return '';

    // Resolve the file path to an absolute path
    const absolutePath = isAbsolute(filePath)
      ? filePath
      : join(basePath, filePath.startsWith('/') ? filePath.slice(1) : filePath);

    const diagnostics: LSPDiagnostic[] = await lspManager.getDiagnostics(absolutePath, content, basePath);
    if (diagnostics.length === 0) return '';

    // Group diagnostics by severity
    const groups: Record<DiagnosticSeverity, LSPDiagnostic[]> = {
      error: [],
      warning: [],
      info: [],
      hint: [],
    };

    for (const d of diagnostics) {
      groups[d.severity].push(d);
    }

    const lines: string[] = ['\n\nLSP Diagnostics:'];

    const severityLabels: [DiagnosticSeverity, string][] = [
      ['error', 'Errors'],
      ['warning', 'Warnings'],
      ['info', 'Info'],
      ['hint', 'Hints'],
    ];

    for (const [severity, label] of severityLabels) {
      const items = groups[severity];
      if (items.length === 0) continue;
      lines.push(`${label}:`);
      for (const d of items) {
        const source = d.source ? ` [${d.source}]` : '';
        lines.push(`  ${d.line}:${d.character} - ${d.message}${source}`);
      }
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}
