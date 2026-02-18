/**
 * LSP Types
 *
 * Browser-safe type definitions for the LSP integration.
 * These types have no Node.js or runtime dependencies.
 */

import type { ChildProcess } from 'node:child_process';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for LSP diagnostics in a workspace.
 */
export interface LSPConfig {
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
  root: (cwd: string) => string | null;
  spawn: (root: string) => ChildProcess | Promise<{ process: ChildProcess; initialization?: any } | undefined>;
}
