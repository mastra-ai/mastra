/**
 * LSP Manager
 *
 * Per-workspace manager that owns LSP server clients.
 * NOT a singleton — each Workspace instance creates its own LSPManager.
 */

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
  private config: LSPConfig;

  constructor(config: LSPConfig = {}) {
    this.config = config;
  }

  /**
   * Get or create an LSP client for a file path.
   * Returns null if no server is available.
   */
  async getClient(filePath: string, workspaceRoot: string): Promise<LSPClient | null> {
    const servers = getServersForFile(filePath, workspaceRoot, this.config.disableServers);
    if (servers.length === 0) return null;

    // Prefer well-known language servers
    const serverDef =
      servers.find(
        s =>
          s.languageIds.includes('typescript') ||
          s.languageIds.includes('javascript') ||
          s.languageIds.includes('python') ||
          s.languageIds.includes('go'),
      ) ?? servers[0]!;

    const key = `${serverDef.name}:${workspaceRoot}`;

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
    const initPromise = (async () => {
      const client = new LSPClient(serverDef, workspaceRoot);
      await client.initialize(initTimeout);
      this.clients.set(key, client);
    })();

    this.initPromises.set(key, initPromise);

    try {
      await Promise.race([
        initPromise,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('LSP client initialization timed out')), initTimeout + 1000),
        ),
      ]);
      return this.clients.get(key) || null;
    } catch {
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
  async getDiagnostics(filePath: string, content: string, workspaceRoot: string): Promise<LSPDiagnostic[]> {
    try {
      const client = await this.getClient(filePath, workspaceRoot);
      if (!client) return [];

      const languageId = getLanguageId(filePath);
      if (!languageId) return [];

      // Open + change → triggers diagnostics
      client.notifyOpen(filePath, content, languageId);
      client.notifyChange(filePath, content, 1);

      const diagnosticTimeout = this.config.diagnosticTimeout ?? 5000;
      const rawDiagnostics = await client.waitForDiagnostics(filePath, diagnosticTimeout);

      // Close the document after collecting diagnostics
      client.notifyClose(filePath);

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
    const shutdowns = Array.from(this.clients.values()).map(client => client.shutdown());
    await Promise.all(shutdowns);
    this.clients.clear();
    this.initPromises.clear();
  }
}
