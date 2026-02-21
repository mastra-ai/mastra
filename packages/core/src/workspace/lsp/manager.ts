/**
 * LSP Manager
 *
 * Per-workspace manager that owns LSP server clients.
 * NOT a singleton — each Workspace instance creates its own LSPManager.
 */

import type { SandboxProcessManager } from '../sandbox/process-manager';
import { LSPClient } from './client';
import { getLanguageId } from './language';
import { getServersForFile } from './servers';
import type { DiagnosticSeverity, LSPConfig, LSPDiagnostic } from './types';

/** Map LSP DiagnosticSeverity (numeric) to our string severity */
function mapSeverity(severity: number | undefined): DiagnosticSeverity {
  switch (severity) {
    case 1:
      return 'error';
    case 2:
      return 'warning';
    case 3:
      return 'info';
    case 4:
      return 'hint';
    default:
      return 'warning';
  }
}

export class LSPManager {
  private clients: Map<string, LSPClient> = new Map();
  private initPromises: Map<string, Promise<void>> = new Map();
  private processManager: SandboxProcessManager;
  private _root: string;
  private config: LSPConfig;

  constructor(processManager: SandboxProcessManager, root: string, config: LSPConfig = {}) {
    this.processManager = processManager;
    this._root = root;
    this.config = config;
  }

  /** Project root directory used as rootUri for LSP servers. */
  get root(): string {
    return this._root;
  }

  /**
   * Get or create an LSP client for a file path.
   * Returns null if no server is available.
   */
  async getClient(filePath: string): Promise<LSPClient | null> {
    const servers = getServersForFile(filePath, this.config.disableServers);
    const available = servers.filter(s => s.command(this._root) !== undefined);
    if (available.length === 0) return null;

    // Prefer well-known language servers
    const serverDef =
      available.find(
        s =>
          s.languageIds.includes('typescript') ||
          s.languageIds.includes('javascript') ||
          s.languageIds.includes('python') ||
          s.languageIds.includes('go'),
      ) ?? available[0]!;

    const key = `${serverDef.name}:${this._root}`;

    // Existing client
    if (this.clients.has(key)) {
      return this.clients.get(key)!;
    }

    // In-progress initialization — wait for it
    if (this.initPromises.has(key)) {
      await this.initPromises.get(key);
      return this.clients.get(key) || null;
    }

    // Create and initialize
    const initTimeout = this.config.initTimeout ?? 15000;
    let timedOut = false;
    const initPromise = (async () => {
      const client = new LSPClient(serverDef, this._root, this.processManager);
      await client.initialize(initTimeout);
      if (timedOut) {
        // Timeout already fired — don't leak the client
        await client.shutdown().catch(() => {});
        return;
      }
      this.clients.set(key, client);
    })();

    this.initPromises.set(key, initPromise);
    initPromise.catch(() => {}); // prevent unhandled rejection if timeout wins

    try {
      await Promise.race([
        initPromise,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('LSP client initialization timed out')), initTimeout + 1000),
        ),
      ]);
      return this.clients.get(key) || null;
    } catch {
      timedOut = true;
      this.clients.delete(key);
      return null;
    } finally {
      this.initPromises.delete(key);
    }
  }

  /**
   * Convenience method: open file, send content, wait for diagnostics, return normalized results.
   * Returns an empty array on any failure (non-blocking).
   */
  async getDiagnostics(filePath: string, content: string): Promise<LSPDiagnostic[]> {
    try {
      const client = await this.getClient(filePath);
      if (!client) return [];

      const languageId = getLanguageId(filePath);
      if (!languageId) return [];

      // Open + change → triggers diagnostics
      client.notifyOpen(filePath, content, languageId);
      client.notifyChange(filePath, content, 1);

      const diagnosticTimeout = this.config.diagnosticTimeout ?? 5000;
      let rawDiagnostics: any[];
      try {
        rawDiagnostics = await client.waitForDiagnostics(filePath, diagnosticTimeout);
      } finally {
        client.notifyClose(filePath);
      }

      return rawDiagnostics.map((d: any) => ({
        severity: mapSeverity(d.severity),
        message: d.message,
        line: (d.range?.start?.line ?? 0) + 1, // LSP is 0-indexed, we report 1-indexed
        character: (d.range?.start?.character ?? 0) + 1,
        source: d.source,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Shutdown all managed LSP clients.
   */
  async shutdownAll(): Promise<void> {
    await Promise.allSettled(Array.from(this.clients.values()).map(client => client.shutdown()));
    this.clients.clear();
    this.initPromises.clear();
  }
}
