import * as nodePath from 'node:path';
import type { WorkspaceFilesystem } from './filesystem';

/**
 * File Read Tracker
 *
 * Tracks when files were last read by the workspace.
 * Used to enforce "read before write" semantics.
 */

/**
 * Record of when a file was read.
 */
export interface FileReadRecord {
  /** The file path that was read */
  path: string;
  /** When the file was read */
  readAt: Date;
  /** The file's modification time when it was read */
  modifiedAtRead: Date;
  /**
   * Filesystem scope the file was read from (see {@link deriveReadScope}).
   * A record only satisfies the read-before-write gate for writes on a
   * filesystem with the same scope.
   */
  scope?: string;
}

/**
 * Interface for tracking file reads.
 *
 * Methods may return promises so implementations can be backed by external
 * storage (e.g. to persist read records across process restarts in
 * serverless environments).
 */
export interface FileReadTracker {
  /** Record that a file was read, optionally tagged with a filesystem scope */
  recordRead(path: string, modifiedAt: Date, scope?: string): void | Promise<void>;

  /** Get the last read record for a path */
  getReadRecord(path: string): FileReadRecord | undefined | Promise<FileReadRecord | undefined>;

  /**
   * Check if file needs re-reading.
   * Returns needsReRead: true if the file was never read, was modified since
   * last read, or was read on a filesystem with a different scope.
   */
  needsReRead(
    path: string,
    currentModifiedAt: Date,
    scope?: string,
  ): { needsReRead: boolean; reason?: string } | Promise<{ needsReRead: boolean; reason?: string }>;

  /** Clear read record (typically after a successful write) */
  clearReadRecord(path: string): void | Promise<void>;

  /** Clear all records */
  clear(): void | Promise<void>;
}

/**
 * Derive a stable read-record scope for a filesystem from its configuration.
 *
 * The scope identifies the *backing file store*, not the object instance:
 * two `LocalFilesystem` instances with the same `basePath` point at the same
 * files and must share read records (suspend/resume creates fresh instances),
 * while different base paths are different files and must not. Instance ids
 * (`filesystem.id`, `workspace.id`) are auto-generated per construction and
 * would break record persistence across resume for dynamically resolved
 * workspaces — so the scope is derived from `provider` + `basePath` instead.
 *
 * Filesystems without a `basePath` (e.g. in-memory or composite filesystems)
 * fall back to the bare provider string. That is deliberately coarse:
 * same-provider filesystems share records, which matches the pre-scoping
 * behavior and is still guarded by the mtime staleness check. Per-mount scope
 * routing for CompositeFilesystem is a possible follow-up.
 */
export function deriveReadScope(fs: Pick<WorkspaceFilesystem, 'provider' | 'basePath'>): string {
  return fs.basePath ? `${fs.provider}:${fs.basePath}` : fs.provider;
}

/**
 * Normalize a path for read-record keying: unify separators, resolve dot
 * segments, remove trailing slash. Shared by all FileReadTracker
 * implementations so records key identically regardless of backing store.
 */
export function normalizeReadTrackerPath(pathStr: string): string {
  const normalized = nodePath.posix.normalize(pathStr.replace(/\\/g, '/'));
  return normalized.replace(/\/$/, '') || '/';
}

/**
 * Evaluate whether a file needs re-reading given its read record (if any) and
 * its current modification time. Shared by all FileReadTracker implementations
 * so the policy semantics and error messages stay identical.
 */
export function evaluateReadRecord(
  path: string,
  record: FileReadRecord | undefined,
  currentModifiedAt: Date,
  scope?: string,
): { needsReRead: boolean; reason?: string } {
  if (!record) {
    return {
      needsReRead: true,
      reason: `File "${path}" has not been read. You must read a file before writing to it.`,
    };
  }

  // A record only counts for the filesystem it was read from. Records without
  // a scope fail closed when a scope is expected.
  if (record.scope !== scope) {
    return {
      needsReRead: true,
      reason: `File "${path}" was read in a different filesystem. You must read a file before writing to it.`,
    };
  }

  // Compare timestamps - if current modification time is newer than when we read it
  if (currentModifiedAt.getTime() > record.modifiedAtRead.getTime()) {
    return {
      needsReRead: true,
      reason: `File "${path}" was modified since last read (read at: ${record.modifiedAtRead.toISOString()}, current: ${currentModifiedAt.toISOString()}). Please re-read the file to get the latest contents.`,
    };
  }

  return { needsReRead: false };
}

/**
 * In-memory implementation of FileReadTracker.
 */
export class InMemoryFileReadTracker implements FileReadTracker {
  private records = new Map<string, FileReadRecord>();

  recordRead(path: string, modifiedAt: Date, scope?: string): void {
    const normalizedPath = normalizeReadTrackerPath(path);
    this.records.set(normalizedPath, {
      path: normalizedPath,
      readAt: new Date(),
      modifiedAtRead: modifiedAt,
      scope,
    });
  }

  getReadRecord(path: string): FileReadRecord | undefined {
    return this.records.get(normalizeReadTrackerPath(path));
  }

  needsReRead(path: string, currentModifiedAt: Date, scope?: string): { needsReRead: boolean; reason?: string } {
    return evaluateReadRecord(path, this.getReadRecord(path), currentModifiedAt, scope);
  }

  clearReadRecord(path: string): void {
    this.records.delete(normalizeReadTrackerPath(path));
  }

  clear(): void {
    this.records.clear();
  }
}
