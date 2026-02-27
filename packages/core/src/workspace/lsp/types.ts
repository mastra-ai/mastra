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

  /**
   * Override the binary command for a specific server, bypassing the default node_modules lookup.
   * Keys are server IDs (e.g. 'typescript', 'eslint', 'python').
   * Values are the full command string including any flags (e.g. '/usr/local/bin/typescript-language-server --stdio').
   * Useful when the binary is installed globally or in a non-standard location.
   */
  serverPaths?: Record<string, string>;

  /**
   * Additional directories to search when resolving Node.js modules (e.g. typescript/lib/tsserver.js).
   * Searched after the project root and process.cwd(). Each entry should be a directory containing
   * a node_modules folder with the required packages.
   * Useful when the module is installed in a tool's own package directory rather than the user's project.
   */
  modulePaths?: string[];

  /**
   * Allow npx as a last-resort fallback when no binary is found via node_modules or serverPaths.
   * Off by default — npx can hang in pnpm monorepos.
   */
  allowNpxFallback?: boolean;
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
