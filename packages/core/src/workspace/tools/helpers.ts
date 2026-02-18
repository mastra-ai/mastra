/**
 * Workspace Tool Helpers
 *
 * Runtime assertions for extracting workspace resources from tool execution context.
 */

import type { ToolExecutionContext } from '../../tools/types';
import { WorkspaceNotAvailableError, FilesystemNotAvailableError, SandboxNotAvailableError } from '../errors';
import type { WorkspaceFilesystem } from '../filesystem';
import { resolveWorkspacePath } from '../filesystem/fs-utils';
import { LocalFilesystem } from '../filesystem/local-filesystem';
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
  const toolCallId = context?.agent?.toolCallId;
  await context?.writer?.custom({
    type: 'data-workspace-metadata',
    data: { toolName, toolCallId, ...info },
  });
}

/**
 * Get LSP diagnostics text to append to edit tool results.
 * Non-blocking — returns empty string on any failure.
 *
 * LSP is a LocalFilesystem feature. This helper checks if the filesystem
 * has an LSP manager and uses it to get diagnostics for the edited file.
 *
 * @param filesystem - The workspace filesystem (must be LocalFilesystem with lsp for diagnostics)
 * @param filePath - Relative path within the filesystem (as used by the tool)
 * @param content - The file content after the edit
 * @returns Formatted diagnostics text, or empty string if unavailable
 */
export async function getEditDiagnosticsText(
  filesystem: WorkspaceFilesystem,
  filePath: string,
  content: string,
): Promise<string> {
  try {
    if (!(filesystem instanceof LocalFilesystem)) return '';

    const lspManager = filesystem.lsp;
    if (!lspManager) return '';

    const { basePath } = filesystem;

    const absolutePath = resolveWorkspacePath(basePath, filePath);

    const DIAG_TIMEOUT_MS = 10_000;
    const diagnostics: LSPDiagnostic[] = await Promise.race([
      lspManager.getDiagnostics(absolutePath, content, basePath),
      new Promise<LSPDiagnostic[]>((_, reject) =>
        setTimeout(() => reject(new Error('LSP diagnostics timeout')), DIAG_TIMEOUT_MS),
      ),
    ]);
    if (diagnostics.length === 0) return '';

    // Deduplicate by severity + location + message
    const seen = new Set<string>();
    const deduped = diagnostics.filter(d => {
      const key = `${d.severity}:${d.line}:${d.character}:${d.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Group diagnostics by severity
    const groups: Record<DiagnosticSeverity, LSPDiagnostic[]> = {
      error: [],
      warning: [],
      info: [],
      hint: [],
    };

    for (const d of deduped) {
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

    let result = lines.join('\n');

    // Truncate to ~500 tokens (~2000 chars) to avoid bloating tool output
    const maxChars = 2000;
    if (result.length > maxChars) {
      const cutoff = result.lastIndexOf('\n', maxChars);
      result = result.slice(0, cutoff > 0 ? cutoff : maxChars) + '\n  ... (truncated)';
    }

    return result;
  } catch {
    return '';
  }
}
