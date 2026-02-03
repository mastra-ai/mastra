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
 * Manages filesystem mounts for a sandbox.
 *
 * Provides methods for tracking mount state, updating entries,
 * and processing pending mounts.
 */
export class MountManager {
  private _entries: Map<string, MountEntry> = new Map();

  constructor(private logger: IMastraLogger) {}

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
   *
   * @param mountFn - The mount implementation to use for each filesystem
   */
  async processPending(
    mountFn?: (filesystem: WorkspaceFilesystem, mountPath: string) => Promise<MountResult>,
  ): Promise<void> {
    for (const [path, entry] of this._entries) {
      if (entry.state !== 'pending') {
        continue;
      }

      // Check if filesystem supports mounting
      if (!entry.filesystem.getMountConfig) {
        entry.state = 'unsupported';
        entry.error = 'Filesystem does not support mounting';
        continue;
      }

      // Get and store the mount config
      entry.config = entry.filesystem.getMountConfig();
      entry.configHash = this.hashConfig(entry.config);
      entry.state = 'mounting';

      try {
        const result = await mountFn?.(entry.filesystem, path);
        if (result?.success) {
          entry.state = 'mounted';
        } else {
          entry.state = 'error';
          entry.error = result?.error ?? 'Mount failed';
        }
      } catch (err) {
        entry.state = 'error';
        entry.error = String(err);
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
