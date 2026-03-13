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
   * Explicit command override for a specific server, bypassing all automatic lookup.
   * Keys are server IDs (e.g. 'typescript', 'eslint', 'python').
   * Values are the full command string including any flags (e.g. '/usr/local/bin/typescript-language-server --stdio').
   * Use this when you know exactly where a binary is. For flexible search, use searchPaths instead.
   */
  binaryOverrides?: Record<string, string>;

  /**
   * Extra directories to search for both language server binaries and Node.js modules.
   * Each entry should be a directory whose node_modules contains the required packages.
   * Searched after project root and process.cwd() — for binaries in node_modules/.bin/,
   * and for modules like typescript/lib/tsserver.js.
   * Useful when binaries and modules are installed in a tool's own package rather than the user's project.
   */
  searchPaths?: string[];

  /**
   * Package runner to use as a last-resort fallback when no binary is found via node_modules or PATH.
   * Off by default — package runners can hang in monorepos with workspace links.
   *
   * Pass the runner command including any flags needed for non-interactive use:
   * - `'npx --yes'` — `--yes` is required to skip the install confirmation prompt; `'npx'` alone will hang
   * - `'pnpm dlx'` — no extra flags needed, pnpm auto-installs without prompting
   * - `'bunx'` — no extra flags needed
   */
  packageRunner?: string;
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
