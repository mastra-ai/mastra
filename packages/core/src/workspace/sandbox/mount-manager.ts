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

import type { MountEntry, MountState } from './types';

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
 * onMount hook function.
 */
export type OnMountHook = (args: {
  filesystem: WorkspaceFilesystem;
  mountPath: string;
  config: FilesystemMountConfig | undefined;
}) => Promise<OnMountResult> | OnMountResult;

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
  private logger: IMastraLogger;

  constructor(config: MountManagerConfig) {
    this._mountFn = config.mount;
    this.logger = config.logger;
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
      if (updates.error !== undefined) {
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
        } else {
          entry.state = 'error';
          entry.error = result.error ?? 'Mount failed';
          this.logger.error(`Mount failed`, { path, provider: fsProvider, error: entry.error });
        }
      } catch (err) {
        entry.state = 'error';
        entry.error = String(err);
        this.logger.error(`Mount threw error`, { path, provider: fsProvider, error: entry.error });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Hash a mount config for comparison.
   */
  private hashConfig(config: FilesystemMountConfig): string {
    const normalized = JSON.stringify(config, Object.keys(config).sort());
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }
}
