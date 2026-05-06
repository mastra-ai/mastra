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
 * User-provided definition for a custom language server.
 *
 * Unlike `LSPServerDef`, `command` is a plain string. Mastra wraps it internally.
 */
export interface CustomLSPServer {
  /** Unique identifier for this server (e.g. 'phpactor', 'intelephense'). */
  id: string;

  /** Human-readable name shown in logs and error messages. */
  name: string;

  /** LSP language identifiers this server handles (e.g. ['php']). */
  languageIds: string[];

  /**
   * File extensions (including the dot) that map to this server's language IDs.
   * Registered into the extension → language ID map so `getLanguageId()` recognizes them.
   * The first `languageIds` entry is used for each extension.
   */
  extensions: string[];

  /** File/directory markers that identify the project root for this server (e.g. ['composer.json']). */
  markers: string[];

  /** Full command string to start the server (e.g. 'phpactor language-server'). */
  command: string;

  /** Optional initialization options sent to the server during the LSP handshake. */
  initializationOptions?: Record<string, unknown>;
}

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

  /**
   * Custom language server definitions for languages not built in.
   *
   * Values define the server, its supported extensions, and its command.
   * The record key is for readability only — the server's `id` field is used internally.
   * Custom servers are merged with built-in servers — custom definitions take precedence
   * when IDs collide, allowing you to replace a built-in server entirely.
   *
   * @example
   * ```typescript
   * const workspace = new Workspace({
   *   lsp: {
   *     servers: {
   *       phpactor: {
   *         id: 'phpactor',
   *         name: 'Phpactor Language Server',
   *         languageIds: ['php'],
   *         extensions: ['.php'],
   *         markers: ['composer.json'],
   *         command: 'phpactor language-server',
   *       },
   *     },
   *   },
   * });
   * ```
   */
  servers?: Record<string, CustomLSPServer>;
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
