import * as nodePath from 'node:path';

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
}

/**
 * Interface for tracking file reads.
 *
 * Methods may return promises so implementations can be backed by external
 * storage (e.g. to persist read records across process restarts in
 * serverless environments).
 */
export interface FileReadTracker {
  /** Record that a file was read */
  recordRead(path: string, modifiedAt: Date): void | Promise<void>;

  /** Get the last read record for a path */
  getReadRecord(path: string): FileReadRecord | undefined | Promise<FileReadRecord | undefined>;

  /**
   * Check if file needs re-reading.
   * Returns needsReRead: true if file was never read or was modified since last read.
   */
  needsReRead(
    path: string,
    currentModifiedAt: Date,
  ): { needsReRead: boolean; reason?: string } | Promise<{ needsReRead: boolean; reason?: string }>;

  /** Clear read record (typically after a successful write) */
  clearReadRecord(path: string): void | Promise<void>;

  /** Clear all records */
  clear(): void | Promise<void>;
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
): { needsReRead: boolean; reason?: string } {
  if (!record) {
    return {
      needsReRead: true,
      reason: `File "${path}" has not been read. You must read a file before writing to it.`,
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

  recordRead(path: string, modifiedAt: Date): void {
    const normalizedPath = normalizeReadTrackerPath(path);
    this.records.set(normalizedPath, {
      path: normalizedPath,
      readAt: new Date(),
      modifiedAtRead: modifiedAt,
    });
  }

  getReadRecord(path: string): FileReadRecord | undefined {
    return this.records.get(normalizeReadTrackerPath(path));
  }

  needsReRead(path: string, currentModifiedAt: Date): { needsReRead: boolean; reason?: string } {
    return evaluateReadRecord(path, this.getReadRecord(path), currentModifiedAt);
  }

  clearReadRecord(path: string): void {
    this.records.delete(normalizeReadTrackerPath(path));
  }

  clear(): void {
    this.records.clear();
  }
}
