/**
 * LSP Manager
 *
 * Per-workspace manager that owns LSP server clients.
 * NOT a singleton — each Workspace instance creates its own LSPManager.
 *
 * Resolves the project root per-file by walking up from the file's directory
 * using language-specific markers defined on each server (e.g. tsconfig.json
 * for TypeScript, go.mod for Go). Falls back to the default root when
 * walkup finds nothing.
 */

import path from 'node:path';

import type { SandboxProcessManager } from '../sandbox/process-manager';
import { LSPClient } from './client';
import { getLanguageId } from './language';
import { getServersForFile, walkUp, walkUpAsync } from './servers';
import type { DiagnosticSeverity, LSPConfig, LSPDiagnostic, LSPServerDef } from './types';

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
  private fileLocks: Map<string, Promise<void>> = new Map();
  private processManager: SandboxProcessManager;
  private _root: string;
  private config: LSPConfig;
  private filesystem?: {
    exists(path: string): Promise<boolean>;
  };

  constructor(
    processManager: SandboxProcessManager,
    root: string,
    config: LSPConfig = {},
    filesystem?: {
      exists(path: string): Promise<boolean>;
    },
  ) {
    this.processManager = processManager;
    this._root = root;
    this.config = config;
    this.filesystem = filesystem;
  }

  /** Default project root (fallback when per-file walkup finds nothing). */
  get root(): string {
    return this._root;
  }

  /**
   * Resolve the project root for a given file path using the server's markers.
   * Uses the workspace filesystem when available (supports remote filesystems),
   * falls back to sync walkUp (local disk) otherwise.
   */
  private async resolveRoot(filePath: string, markers: string[]): Promise<string> {
    const fileDir = path.dirname(filePath);
    if (this.filesystem) {
      return (await walkUpAsync(fileDir, markers, this.filesystem)) ?? this._root;
    }
    return walkUp(fileDir, markers) ?? this._root;
  }

  /**
   * Acquire a per-file lock so that concurrent getDiagnostics calls for the
   * same file are serialized (preventing interleaved open/change/close).
   * Different files can run in parallel.
   */
  private async acquireFileLock(filePath: string): Promise<() => void> {
    // Wait for any existing lock on this file
    while (this.fileLocks.has(filePath)) {
      await this.fileLocks.get(filePath);
    }

    let release!: () => void;
    const lockPromise = new Promise<void>(resolve => {
      release = resolve;
    });
    this.fileLocks.set(filePath, lockPromise);

    return () => {
      this.fileLocks.delete(filePath);
      release();
    };
  }

  /**
   * Initialize an LSP client for the given server definition and project root.
   * Handles timeout, deduplication of concurrent init calls, and caching.
   */
  private async initClient(serverDef: LSPServerDef, projectRoot: string, key: string): Promise<LSPClient | null> {
    // In-progress initialization — wait for it
    if (this.initPromises.has(key)) {
      await this.initPromises.get(key);
      return this.clients.get(key) || null;
    }

    // Create and initialize
    const initTimeout = this.config.initTimeout ?? 15000;
    let timedOut = false;
    const initPromise = (async () => {
      const client = new LSPClient(serverDef, projectRoot, this.processManager);
      await client.initialize(initTimeout);
      if (timedOut) {
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
   * Get or create an LSP client for a file path.
   * Resolves the project root per-file using the server's markers.
   * Returns null if no server is available.
   */
  async getClient(filePath: string): Promise<LSPClient | null> {
    const servers = getServersForFile(filePath, this.config.disableServers);
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

    const projectRoot = await this.resolveRoot(filePath, serverDef.markers);

    // Check if the server's command is available at this root
    if (serverDef.command(projectRoot) === undefined) return null;

    const key = `${serverDef.name}:${projectRoot}`;

    // Existing client — check liveness before returning
    if (this.clients.has(key)) {
      const existing = this.clients.get(key)!;
      if (!existing.isAlive) {
        this.clients.delete(key);
        existing.shutdown().catch(() => {});
      } else {
        return existing;
      }
    }

    return this.initClient(serverDef, projectRoot, key);
  }

  /**
   * Convenience method: open file, send content, wait for diagnostics, return normalized results.
   * Returns an empty array on any failure (non-blocking).
   * Uses a per-file lock to serialize concurrent calls for the same file.
   */
  async getDiagnostics(filePath: string, content: string): Promise<LSPDiagnostic[]> {
    const release = await this.acquireFileLock(filePath);
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
    } finally {
      release();
    }
  }

  /**
   * Get diagnostics from ALL matching language servers for a file.
   * Deduplicates results by (line, character, message).
   * Individual server failures don't block other servers.
   */
  async getDiagnosticsMulti(filePath: string, content: string): Promise<LSPDiagnostic[]> {
    const servers = getServersForFile(filePath, this.config.disableServers);
    if (servers.length === 0) return [];

    const release = await this.acquireFileLock(filePath);
    try {
      const languageId = getLanguageId(filePath);
      if (!languageId) return [];

      const allDiagnostics: LSPDiagnostic[] = [];

      const results = await Promise.allSettled(
        servers.map(async serverDef => {
          const projectRoot = await this.resolveRoot(filePath, serverDef.markers);
          if (serverDef.command(projectRoot) === undefined) return [];

          const key = `${serverDef.name}:${projectRoot}`;

          // Existing client — check liveness
          if (this.clients.has(key)) {
            const existing = this.clients.get(key)!;
            if (!existing.isAlive) {
              this.clients.delete(key);
              existing.shutdown().catch(() => {});
            } else {
              return this.collectDiagnostics(existing, filePath, content, languageId);
            }
          }

          const client = await this.initClient(serverDef, projectRoot, key);
          if (!client) return [];

          return this.collectDiagnostics(client, filePath, content, languageId);
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allDiagnostics.push(...result.value);
        }
      }

      // Deduplicate by (line, character, message)
      const seen = new Set<string>();
      return allDiagnostics.filter(d => {
        const key = `${d.line}:${d.character}:${d.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } finally {
      release();
    }
  }

  /**
   * Collect diagnostics from a single client for a file.
   */
  private async collectDiagnostics(
    client: LSPClient,
    filePath: string,
    content: string,
    languageId: string,
  ): Promise<LSPDiagnostic[]> {
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
      line: (d.range?.start?.line ?? 0) + 1,
      character: (d.range?.start?.character ?? 0) + 1,
      source: d.source,
    }));
  }

  /**
   * Shutdown all managed LSP clients.
   */
  async shutdownAll(): Promise<void> {
    await Promise.allSettled(Array.from(this.clients.values()).map(client => client.shutdown()));
    this.clients.clear();
    this.initPromises.clear();
    this.fileLocks.clear();
  }
}
