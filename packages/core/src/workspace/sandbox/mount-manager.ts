/**
 * Mount Manager
 *
 * Encapsulates all mount-related state and operations for sandboxes.
 * Used by BaseSandbox to manage filesystem mounts.
 */

import { createHash } from 'node:crypto';

import type { IMastraLogger } from '../../logger';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { FilesystemMountConfig, MountResult } from '../filesystem/mount';

import type { Workspace } from '../workspace';
import { MountToolNotFoundError } from './mounts/types';
import type { WorkspaceSandbox } from './sandbox';
import type { MountEntry, MountState } from './types';

// Type-only import — erased at compile time, no circular dependency at runtime.

/**
 * Mount function signature.
 */
export type MountFn = (filesystem: WorkspaceFilesystem, mountPath: string) => Promise<MountResult>;

/**
 * onMount hook result.
 * - false: skip mount
 * - { success, error? }: hook handled it
 * - void: use default mount
 */
export type OnMountResult = false | { success: boolean; error?: string } | void;

/**
 * Arguments passed to the onMount hook.
 */
export interface OnMountArgs {
  /** The filesystem being mounted */
  filesystem: WorkspaceFilesystem;
  /** The mount path in the sandbox */
  mountPath: string;
  /** The mount configuration from filesystem.getMountConfig() (undefined if not supported) */
  config: FilesystemMountConfig | undefined;
  /** The sandbox instance for custom mount implementations */
  sandbox: WorkspaceSandbox;
  /** The workspace instance */
  workspace: Workspace;
}

/**
 * onMount hook function.
 *
 * Called for each filesystem before mounting into sandbox.
 * Return value controls mounting behavior (see {@link OnMountResult}).
 *
 * @example Skip local filesystems
 * ```typescript
 * onMount: ({ filesystem }) => {
 *   if (filesystem.provider === 'local') return false;
 * }
 * ```
 *
 * @example Custom mount implementation
 * ```typescript
 * onMount: async ({ filesystem, mountPath, sandbox }) => {
 *   if (mountPath === '/custom') {
 *     await sandbox.executeCommand?.('my-mount-script', [mountPath]);
 *     return { success: true };
 *   }
 * }
 * ```
 */
export type OnMountHook = (args: OnMountArgs) => Promise<OnMountResult> | OnMountResult;

/**
 * MountManager configuration.
 */
export interface MountManagerConfig {
  /** The mount implementation from the sandbox */
  mount: MountFn;
  /** Logger instance */
  logger: IMastraLogger;
}

/**
 * Manages filesystem mounts for a sandbox.
 *
 * Provides methods for tracking mount state, updating entries,
 * and processing pending mounts.
 */
export class MountManager {
  private _entries: Map<string, MountEntry> = new Map();
  private _mountFn: MountFn;
  private _onMount?: OnMountHook;
  private _sandbox?: WorkspaceSandbox;
  private _workspace?: Workspace;
  private logger: IMastraLogger;

  constructor(config: MountManagerConfig) {
    this._mountFn = config.mount;
    this.logger = config.logger;
  }

  /**
   * Set the sandbox and workspace references for onMount hook args.
   * Called by Workspace during construction.
   */
  setContext(context: { sandbox: WorkspaceSandbox; workspace: Workspace }): void {
    this._sandbox = context.sandbox;
    this._workspace = context.workspace;
  }

  /**
   * Set the onMount hook for custom mount handling.
   * Called before each mount - can skip, handle, or defer to default.
   */
  setOnMount(hook: OnMountHook | undefined): void {
    this._onMount = hook;
  }

  /**
   * Update the logger instance.
   * Called when the sandbox receives a logger from Mastra.
   * @internal
   */
  __setLogger(logger: IMastraLogger): void {
    this.logger = logger;
  }

  // ---------------------------------------------------------------------------
  // Entry Access
  // ---------------------------------------------------------------------------

  /**
   * Get all mount entries.
   */
  get entries(): ReadonlyMap<string, MountEntry> {
    return this._entries;
  }

  /**
   * Get a mount entry by path.
   */
  get(path: string): MountEntry | undefined {
    return this._entries.get(path);
  }

  /**
   * Check if a mount exists at the given path.
   */
  has(path: string): boolean {
    return this._entries.has(path);
  }

  // ---------------------------------------------------------------------------
  // Entry Modification
  // ---------------------------------------------------------------------------

  /**
   * Add pending mounts from workspace config.
   * These will be processed when `processPending()` is called.
   */
  add(mounts: Record<string, WorkspaceFilesystem>): void {
    const paths = Object.keys(mounts);
    this.logger.debug(`Adding ${paths.length} pending mount(s)`, { paths });

    for (const [path, filesystem] of Object.entries(mounts)) {
      this._entries.set(path, {
        filesystem,
        state: 'pending',
      });
    }
  }

  /**
   * Update a mount entry's state.
   * Creates the entry if it doesn't exist.
   */
  set(
    path: string,
    updates: {
      filesystem?: WorkspaceFilesystem;
      state: MountState;
      config?: FilesystemMountConfig;
      error?: string;
    },
  ): void {
    const existing = this._entries.get(path);

    if (existing) {
      existing.state = updates.state;
      if (updates.config) {
        existing.config = updates.config;
        existing.configHash = this.hashConfig(updates.config);
      }
      if ('error' in updates) {
        existing.error = updates.error;
      }
    } else if (updates.filesystem) {
      // Create new entry (for direct mount() calls without add())
      this._entries.set(path, {
        filesystem: updates.filesystem,
        state: updates.state,
        config: updates.config,
        configHash: updates.config ? this.hashConfig(updates.config) : undefined,
        error: updates.error,
      });
    } else {
      this.logger.debug(`set() called for unknown path "${path}" without filesystem — no entry created`);
    }
  }

  /**
   * Delete a mount entry.
   */
  delete(path: string): boolean {
    return this._entries.delete(path);
  }

  /**
   * Clear all mount entries.
   */
  clear(): void {
    this._entries.clear();
  }

  // ---------------------------------------------------------------------------
  // Mount Processing
  // ---------------------------------------------------------------------------

  /**
   * Process all pending mounts.
   * Call this after sandbox is ready (in start()).
   */
  async processPending(): Promise<void> {
    const pendingCount = [...this._entries.values()].filter(e => e.state === 'pending').length;
    if (pendingCount === 0) {
      return;
    }

    this.logger.debug(`Processing ${pendingCount} pending mount(s)`);

    for (const [path, entry] of this._entries) {
      if (entry.state !== 'pending') {
        continue;
      }

      const fsProvider = entry.filesystem.provider;

      // Get config if available
      const config = entry.filesystem.getMountConfig?.();

      // Call onMount hook if configured
      if (this._onMount) {
        try {
          const hookResult = await this._onMount({
            filesystem: entry.filesystem,
            mountPath: path,
            config,
            sandbox: this._sandbox!,
            workspace: this._workspace!,
          });

          // false = skip mount entirely
          if (hookResult === false) {
            entry.state = 'unsupported';
            entry.error = 'Skipped by onMount hook';
            this.logger.debug(`Mount skipped by onMount hook`, { path, provider: fsProvider });
            continue;
          }

          // { success, error? } = hook handled it
          if (hookResult && typeof hookResult === 'object') {
            if (hookResult.success) {
              entry.state = 'mounted';
              entry.config = config;
              entry.configHash = config ? this.hashConfig(config) : undefined;
              this.logger.info(`Mount handled by onMount hook`, { path, provider: fsProvider });
            } else {
              entry.state = 'error';
              entry.error = hookResult.error ?? 'Mount hook failed';
              this.logger.error(`Mount hook failed`, { path, provider: fsProvider, error: entry.error });
            }
            continue;
          }

          // void = continue with default mount
        } catch (err) {
          entry.state = 'error';
          entry.error = `Mount hook error: ${String(err)}`;
          this.logger.error(`Mount hook threw error`, { path, provider: fsProvider, error: entry.error });
          continue;
        }
      }

      // Check if filesystem supports mounting (for default behavior)
      if (!config) {
        entry.state = 'unsupported';
        entry.error = 'Filesystem does not support mounting';
        this.logger.debug(`Filesystem does not support mounting`, { path, provider: fsProvider });
        continue;
      }

      // Store config and mark as mounting
      entry.config = config;
      entry.configHash = this.hashConfig(config);
      entry.state = 'mounting';

      this.logger.debug(`Mounting filesystem`, { path, provider: fsProvider, type: config.type });

      // Call the sandbox's mount implementation
      try {
        const result = await this._mountFn(entry.filesystem, path);
        if (result.success) {
          entry.state = 'mounted';
          this.logger.info(`Mount successful`, { path, provider: fsProvider });
        } else if (result.unavailable) {
          entry.state = 'unavailable';
          entry.error = result.error ?? 'FUSE tool not installed';
          this.logger.warn(`FUSE mount unavailable`, { path, provider: fsProvider, error: entry.error });
        } else {
          entry.state = 'error';
          entry.error = result.error ?? 'Mount failed';
          this.logger.error(`Mount failed`, { path, provider: fsProvider, error: entry.error });
        }
      } catch (err) {
        if (err instanceof MountToolNotFoundError) {
          entry.state = 'unavailable';
          entry.error = String(err);
          this.logger.warn(`FUSE mount unavailable`, { path, provider: fsProvider, error: entry.error });
        } else {
          entry.state = 'error';
          entry.error = String(err);
          this.logger.error(`Mount threw error`, { path, provider: fsProvider, error: entry.error });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Marker File Helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate a marker filename for a mount path.
   * Used by sandboxes to store mount metadata for reconnection detection.
   *
   * @param mountPath - The mount path to generate a filename for
   * @returns A safe filename like "mount-abc123"
   */
  markerFilename(mountPath: string): string {
    let hash = 0;
    for (let i = 0; i < mountPath.length; i++) {
      const char = mountPath.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return `mount-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Generate marker file content for a mount path.
   * Format: "path|configHash" - used for detecting config changes on reconnect.
   *
   * @param mountPath - The mount path
   * @returns Marker content string, or null if no config hash available
   */
  getMarkerContent(mountPath: string): string | null {
    const entry = this._entries.get(mountPath);
    if (!entry?.configHash) {
      return null;
    }
    return `${mountPath}|${entry.configHash}`;
  }

  /**
   * Parse marker file content.
   *
   * @param content - The marker file content (format: "path|configHash")
   * @returns Parsed path and configHash, or null if invalid format
   */
  parseMarkerContent(content: string): { path: string; configHash: string } | null {
    const separatorIndex = content.lastIndexOf('|');
    if (separatorIndex <= 0) {
      return null;
    }
    const path = content.slice(0, separatorIndex);
    const configHash = content.slice(separatorIndex + 1);
    if (!path || !configHash) return null;
    return { path, configHash };
  }

  /**
   * Check if a config hash matches the expected hash for a mount path.
   *
   * @param mountPath - The mount path to check
   * @param storedHash - The hash from the marker file
   * @returns true if the hashes match
   */
  isConfigMatching(mountPath: string, storedHash: string): boolean {
    const entry = this._entries.get(mountPath);
    return entry?.configHash === storedHash;
  }

  /**
   * Compute a hash for a mount config. Used for comparing configs across mounts.
   *
   * @param config - The config to hash
   * @returns A hash string suitable for comparison
   */
  computeConfigHash(config: FilesystemMountConfig): string {
    return this.hashConfig(config);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Hash a mount config for comparison.
   */
  private hashConfig(config: FilesystemMountConfig): string {
    const normalized = JSON.stringify(this.sortKeysDeep(config));
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  private sortKeysDeep(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortKeysDeep(item));
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = this.sortKeysDeep((obj as Record<string, unknown>)[key]);
          return acc;
        },
        {} as Record<string, unknown>,
      );
  }
}
