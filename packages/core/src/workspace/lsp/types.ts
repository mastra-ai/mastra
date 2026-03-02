/**
 * LSP Types
 *
 * Browser-safe type definitions for the LSP integration.
 * These types have no Node.js or runtime dependencies.
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for LSP diagnostics in a workspace.
 */
export interface LSPConfig {
  /** Project root directory (absolute path). Used as rootUri for LSP servers and cwd for spawning.
   * If not provided, resolved from filesystem.basePath or sandbox.workingDirectory. */
  root?: string;

  /** Timeout in ms for waiting for diagnostics after an edit (default: 5000) */
  diagnosticTimeout?: number;

  /** Timeout in ms for LSP server initialization (default: 15000) */
  initTimeout?: number;

  /** Server IDs to disable (e.g., ['eslint'] to skip ESLint) */
  disableServers?: string[];
}

// =============================================================================
// Diagnostics
// =============================================================================

/** Severity levels matching LSP DiagnosticSeverity */
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * A diagnostic message from an LSP server.
 */
export interface LSPDiagnostic {
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  character: number;
  source?: string;
}

// =============================================================================
// Server Definitions
// =============================================================================

/**
 * Definition for a built-in LSP server.
 */
export interface LSPServerDef {
  id: string;
  name: string;
  languageIds: string[];
  /** File/directory markers that identify the project root for this server. */
  markers: string[];
  command: (root: string) => string | undefined;
  initialization?: (root: string) => Record<string, unknown> | undefined;
}
