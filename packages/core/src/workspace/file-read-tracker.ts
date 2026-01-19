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
 */
export interface FileReadTracker {
  /** Record that a file was read */
  recordRead(path: string, modifiedAt: Date): void;

  /** Get the last read record for a path */
  getReadRecord(path: string): FileReadRecord | undefined;

  /**
   * Check if file needs re-reading.
   * Returns needsReRead: true if file was never read or was modified since last read.
   */
  needsReRead(path: string, currentModifiedAt: Date): { needsReRead: boolean; reason?: string };

  /** Clear read record (typically after a successful write) */
  clearReadRecord(path: string): void;

  /** Clear all records */
  clear(): void;
}

/**
 * In-memory implementation of FileReadTracker.
 */
export class InMemoryFileReadTracker implements FileReadTracker {
  private records = new Map<string, FileReadRecord>();

  recordRead(path: string, modifiedAt: Date): void {
    const normalizedPath = this.normalizePath(path);
    this.records.set(normalizedPath, {
      path: normalizedPath,
      readAt: new Date(),
      modifiedAtRead: modifiedAt,
    });
  }

  getReadRecord(path: string): FileReadRecord | undefined {
    return this.records.get(this.normalizePath(path));
  }

  needsReRead(path: string, currentModifiedAt: Date): { needsReRead: boolean; reason?: string } {
    const record = this.getReadRecord(path);

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

  clearReadRecord(path: string): void {
    this.records.delete(this.normalizePath(path));
  }

  clear(): void {
    this.records.clear();
  }

  private normalizePath(path: string): string {
    // Normalize path: remove duplicate slashes, remove trailing slash (except for root)
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }
}
