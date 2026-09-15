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
import { buildCustomExtensions, buildServerDefs, getServersForFile, walkUp, walkUpAsync } from './servers';
import type { DiagnosticSeverity, LSPConfig, LSPDiagnostic, LSPServerDef } from './types';

const CLIENT_LEASE_ACQUIRE_TIMEOUT_MS = 5000;
const CLIENT_LEASE_SHUTDOWN_TIMEOUT_MS = 5000;

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
  private clientInitQueue: Promise<void> = Promise.resolve();
  private clientLeaseAcquisitionQueue: Promise<void> = Promise.resolve();
  private activeClientLeases: Map<LSPClient, number> = new Map();
  private clientLeaseWaiters: Set<() => void> = new Set();
  private shutdownPromise?: Promise<void>;
  private shuttingDown = false;
  private fileLocks: Map<string, Promise<void>> = new Map();
  private processManager: SandboxProcessManager;
  private _root: string;
  private config: LSPConfig;
  private serverDefs: Record<string, LSPServerDef>;
  private customExtensions: Record<string, string>;
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
    if (
      config.maxOpenClients !== undefined &&
      (!Number.isInteger(config.maxOpenClients) || config.maxOpenClients < 1)
    ) {
      throw new RangeError('maxOpenClients must be a positive integer');
    }

    this.processManager = processManager;
    this._root = root;
    this.config = config;
    this.serverDefs = buildServerDefs(config);
    this.customExtensions = buildCustomExtensions(config.servers);
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

  /** Mark a client as most recently used. */
  private touchClient(key: string, client: LSPClient): void {
    this.clients.delete(key);
    this.clients.set(key, client);
  }

  /** Shut down idle least recently used clients until another one can be opened. */
  private async ensureClientCapacity(): Promise<boolean> {
    const maxOpenClients = this.config.maxOpenClients;
    if (maxOpenClients === undefined) return !this.shuttingDown;

    while (this.clients.size >= maxOpenClients) {
      if (this.shuttingDown) return false;

      const oldestIdle = Array.from(this.clients.entries()).find(([, client]) => !this.activeClientLeases.has(client));
      if (!oldestIdle) {
        if (!(await this.waitForClientLeaseRelease(CLIENT_LEASE_ACQUIRE_TIMEOUT_MS))) return false;
        continue;
      }

      const [key, client] = oldestIdle;
      this.clients.delete(key);
      await client.shutdown().catch(() => {});
    }

    return !this.shuttingDown;
  }

  /** Acquire a client and lease it before another capped acquisition can evict it. */
  private async acquireClientLease(
    acquire: (onAcquired: (client: LSPClient) => void) => Promise<LSPClient | null>,
  ): Promise<{ client: LSPClient; release: () => void } | null> {
    const previous = this.clientLeaseAcquisitionQueue;
    let finishAcquisition!: () => void;
    const current = new Promise<void>(resolve => {
      finishAcquisition = resolve;
    });
    this.clientLeaseAcquisitionQueue = previous.then(() => current);

    await previous;
    try {
      if (this.shuttingDown) return null;

      const client = await acquire(acquired => {
        this.activeClientLeases.set(acquired, (this.activeClientLeases.get(acquired) ?? 0) + 1);
      });
      if (!client) return null;
      let released = false;
      return {
        client,
        release: () => {
          if (released) return;
          released = true;

          const remaining = (this.activeClientLeases.get(client) ?? 1) - 1;
          if (remaining > 0) {
            this.activeClientLeases.set(client, remaining);
            return;
          }

          this.activeClientLeases.delete(client);
          this.wakeClientLeaseWaiters();
        },
      };
    } finally {
      finishAcquisition();
    }
  }

  /** Keep an acquired client alive while an operation is using it. */
  private async withClientLease<T>(
    acquire: (onAcquired: (client: LSPClient) => void) => Promise<LSPClient | null>,
    operation: (client: LSPClient) => Promise<T>,
  ): Promise<T | null> {
    const lease = await this.acquireClientLease(acquire);
    if (!lease) return null;

    try {
      return await operation(lease.client);
    } finally {
      lease.release();
    }
  }

  private wakeClientLeaseWaiters(): void {
    const waiters = Array.from(this.clientLeaseWaiters);
    this.clientLeaseWaiters.clear();
    waiters.forEach(resolve => resolve());
  }

  /** Wait for a lease release without allowing leaked leases to block new clients indefinitely. */
  private async waitForClientLeaseRelease(timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;
      const finish = (released: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.clientLeaseWaiters.delete(onRelease);
        resolve(released);
      };
      const onRelease = (): void => finish(true);

      timeout = setTimeout(() => finish(false), timeoutMs);
      this.clientLeaseWaiters.add(onRelease);
    });
  }

  /** Wait for active operations to release their clients, then force teardown after a bounded delay. */
  private async waitForClientLeasesToDrain(): Promise<void> {
    if (this.activeClientLeases.size === 0) return;

    await new Promise<void>(resolve => {
      let timeout: ReturnType<typeof setTimeout>;
      const checkLeases = (): void => {
        if (this.activeClientLeases.size > 0) {
          this.clientLeaseWaiters.add(checkLeases);
          return;
        }

        clearTimeout(timeout);
        resolve();
      };

      timeout = setTimeout(() => {
        this.clientLeaseWaiters.delete(checkLeases);
        resolve();
      }, CLIENT_LEASE_SHUTDOWN_TIMEOUT_MS);
      this.clientLeaseWaiters.add(checkLeases);
    });
  }

  /**
   * Acquire a per-file lock so that concurrent getDiagnostics calls for the
   * same file are serialized (preventing interleaved open/change/close) and
   * are served in the order they arrived. Different files run in parallel.
   */
  private async acquireFileLock(filePath: string): Promise<() => void> {
    // Chain onto the tail of any existing lock for this file to form a FIFO
    // queue. Waiting on a single shared promise instead would still serialize
    // callers, but a caller arriving in the same turn as a release could take
    // the lock ahead of longer-waiting ones, and every release would wake all
    // waiters rather than just the next.
    const previous = this.fileLocks.get(filePath) ?? Promise.resolve();

    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });

    // The new tail resolves only after the whole chain up to and including this
    // holder has released.
    const tail = previous.then(() => current);
    this.fileLocks.set(filePath, tail);

    // Wait for all predecessors to finish before this caller holds the lock.
    await previous;

    return () => {
      release();
      // Drop the map entry only if nobody chained after us, to avoid leaks.
      if (this.fileLocks.get(filePath) === tail) {
        this.fileLocks.delete(filePath);
      }
    };
  }

  /**
   * Initialize an LSP client for the given server definition and project root.
   * Handles timeout, deduplication of concurrent init calls, and caching.
   */
  private async initClient(
    serverDef: LSPServerDef,
    projectRoot: string,
    key: string,
    onAcquired?: (client: LSPClient) => void,
  ): Promise<LSPClient | null> {
    if (this.shuttingDown) return null;

    // In-progress initialization — wait for it
    if (this.initPromises.has(key)) {
      await this.initPromises.get(key);
      const client = this.shuttingDown ? null : (this.clients.get(key) ?? null);
      if (client) onAcquired?.(client);
      return client;
    }

    const initialize = async (): Promise<void> => {
      if (!(await this.ensureClientCapacity())) return;
      const initTimeout = this.config.initTimeout ?? 15000;
      let timedOut = false;
      let client: LSPClient | undefined;
      let cleanupPromise: Promise<void> | undefined;
      const cleanupClient = async (): Promise<void> => {
        if (!client) return;
        cleanupPromise ??= client.shutdown().catch(() => {});
        await cleanupPromise;
        cleanupPromise = undefined;
      };
      const startPromise = (async () => {
        client = new LSPClient(serverDef, projectRoot, this.processManager);
        try {
          await client.initialize(initTimeout);
        } catch (error) {
          await cleanupClient();
          throw error;
        }
        if (timedOut || this.shuttingDown) {
          await cleanupClient();
          return;
        }
        this.clients.set(key, client);
      })();
      startPromise.catch(() => {}); // prevent unhandled rejection if timeout wins

      try {
        let initTimer: ReturnType<typeof setTimeout>;
        await Promise.race([
          startPromise,
          new Promise<void>((_, reject) => {
            initTimer = setTimeout(() => reject(new Error('LSP client initialization timed out')), initTimeout + 1000);
          }),
        ]).finally(() => clearTimeout(initTimer!));
      } catch (err) {
        timedOut = true;
        await cleanupClient();
        this.clients.delete(key);
        const command = serverDef.command(projectRoot);
        const hint = this.config.binaryOverrides?.[serverDef.id]
          ? ` (using binaryOverrides: "${this.config.binaryOverrides[serverDef.id]}")`
          : command
            ? ` (command: "${command}")`
            : '';
        console.warn(`[LSP] Failed to start ${serverDef.name}${hint}: ${err instanceof Error ? err.message : err}`);
      }

      if (client && this.clients.get(key) === client) {
        onAcquired?.(client);
      }
    };

    // A configured cap requires serialized initialization so concurrent calls
    // cannot all observe spare capacity and exceed the process limit.
    const initPromise = this.config.maxOpenClients === undefined ? initialize() : this.clientInitQueue.then(initialize);
    if (this.config.maxOpenClients !== undefined) {
      this.clientInitQueue = initPromise.catch(() => {});
    }
    this.initPromises.set(key, initPromise);

    try {
      await initPromise;
      return this.clients.get(key) || null;
    } finally {
      this.initPromises.delete(key);
    }
  }

  /**
   * Get or create an LSP client for a file path.
   * Resolves the project root per-file using the server's markers.
   * Returns null if no server is available.
   */
  private async getClientInternal(
    filePath: string,
    onAcquired?: (client: LSPClient) => void,
  ): Promise<LSPClient | null> {
    if (this.shuttingDown) return null;

    const servers = getServersForFile(filePath, this.config.disableServers, this.serverDefs, this.customExtensions);
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
    if (this.shuttingDown) return null;

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
        this.touchClient(key, existing);
        onAcquired?.(existing);
        return existing;
      }
    }

    return this.initClient(serverDef, projectRoot, key, onAcquired);
  }

  /**
   * Get LSP client ready to query a file.
   * Opens the file in the client so queries can be made. Call `release` after
   * closing the file to allow the client to be evicted.
   * Returns null when no LSP client is available.
   */
  async prepareQuery(filePath: string): Promise<{
    client: LSPClient;
    uri: string;
    languageId: string;
    serverName: string;
    release: () => void;
  } | null> {
    const lease = await this.acquireClientLease(onAcquired => this.getClientInternal(filePath, onAcquired));
    if (!lease) return null;

    const { client, release } = lease;
    const languageId = getLanguageId(filePath, this.customExtensions);
    if (!languageId) {
      release();
      return null;
    }

    try {
      // Open the file (content doesn't matter for position queries, but server may need it)
      const fs = await import('node:fs/promises');
      let content = '';
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch {
        content = '';
      }

      client.notifyOpen(filePath, content, languageId);

      // Use the same URI format as notifyOpen (pathToFileURL for proper encoding)
      const { pathToFileURL } = await import('node:url');
      const uri = pathToFileURL(filePath).toString();
      return { client, uri, languageId, serverName: client.serverName, release };
    } catch (error) {
      release();
      throw error;
    }
  }

  /**
   * Convenience method: open file, send content, wait for diagnostics, return normalized results.
   * Returns null when no LSP client is available; otherwise returns diagnostics
   * (or an empty array on runtime failures after client acquisition).
   * Uses a per-file lock to serialize concurrent calls for the same file.
   */
  async getDiagnostics(filePath: string, content: string): Promise<LSPDiagnostic[] | null> {
    const release = await this.acquireFileLock(filePath);
    try {
      return await this.withClientLease(
        onAcquired => this.getClientInternal(filePath, onAcquired),
        async client => {
          const languageId = getLanguageId(filePath, this.customExtensions);
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
        },
      );
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
    if (this.shuttingDown) return [];

    const servers = getServersForFile(filePath, this.config.disableServers, this.serverDefs, this.customExtensions);
    if (servers.length === 0) return [];

    const release = await this.acquireFileLock(filePath);
    try {
      const languageId = getLanguageId(filePath, this.customExtensions);
      if (!languageId) return [];

      const allDiagnostics: LSPDiagnostic[] = [];

      const results = await Promise.allSettled(
        servers.map(async serverDef => {
          const projectRoot = await this.resolveRoot(filePath, serverDef.markers);
          if (serverDef.command(projectRoot) === undefined) return [];

          const key = `${serverDef.name}:${projectRoot}`;

          const diagnostics = await this.withClientLease(
            async onAcquired => {
              // Existing client — check liveness
              if (this.clients.has(key)) {
                const existing = this.clients.get(key)!;
                if (!existing.isAlive) {
                  this.clients.delete(key);
                  existing.shutdown().catch(() => {});
                } else {
                  this.touchClient(key, existing);
                  onAcquired(existing);
                  return existing;
                }
              }

              return this.initClient(serverDef, projectRoot, key, onAcquired);
            },
            client => this.collectDiagnostics(client, filePath, content, languageId),
          );
          return diagnostics ?? [];
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
  shutdownAll(): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;

    this.shuttingDown = true;
    this.wakeClientLeaseWaiters();
    this.shutdownPromise = (async () => {
      // Drain acquisition and initialization before taking the final client
      // snapshot. New acquisitions are rejected once shuttingDown is set.
      await Promise.allSettled([...this.initPromises.values(), this.clientInitQueue, this.clientLeaseAcquisitionQueue]);
      await this.waitForClientLeasesToDrain();
      await Promise.allSettled(Array.from(this.clients.values()).map(client => client.shutdown()));
      this.clients.clear();
      this.initPromises.clear();
      this.activeClientLeases.clear();
      this.fileLocks.clear();
      // Everything is drained and cleared — return the manager to its
      // fresh-constructed state so it can spawn clients again. This makes
      // shutdownAll() a "stop" rather than a one-way door: Workspace.stop()
      // relies on the same manager accepting clients after a restart.
      this.shuttingDown = false;
      this.shutdownPromise = undefined;
    })();

    return this.shutdownPromise;
  }
}
