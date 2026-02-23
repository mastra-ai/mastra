import * as nodePath from 'node:path';

/**
 * File Write Lock
 *
 * Per-file promise queue that serializes write operations to the same path.
 * Prevents read-modify-write race conditions when multiple tool calls
 * target the same file concurrently.
 */

/** Options for constructing a FileWriteLock. */
export interface FileWriteLockOptions {
  /** Maximum time (ms) a single lock-holder may run before being rejected. Default: 30 000. */
  timeoutMs?: number;
}

/**
 * Interface for per-file write locking.
 */
export interface FileWriteLock {
  /** Execute `fn` while holding an exclusive lock on `filePath`. */
  withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T>;

  /** Number of paths that currently have queued operations. */
  get size(): number;
}

/**
 * In-memory implementation of FileWriteLock using per-path promise queues.
 *
 * Adapted from mastracode's `withWriteLock` pattern.
 */
export class InMemoryFileWriteLock implements FileWriteLock {
  private queues = new Map<string, Promise<void>>();
  private readonly timeoutMs: number;

  constructor(opts?: FileWriteLockOptions) {
    this.timeoutMs = opts?.timeoutMs ?? 30_000;
  }

  get size(): number {
    return this.queues.size;
  }

  withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    const key = this.normalizePath(filePath);

    // Get the current queue for this file (or a resolved promise if none)
    const currentQueue = this.queues.get(key) ?? Promise.resolve();

    // Create a deferred promise for our result
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const resultPromise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Chain our operation onto the queue
    const queuePromise = currentQueue
      .catch(() => {}) // Ignore errors from previous operations
      .then(async () => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = await Promise.race([
            fn(),
            new Promise<never>((_, rej) => {
              timeoutId = setTimeout(
                () => rej(new Error(`write-lock timeout on "${key}" after ${this.timeoutMs}ms`)),
                this.timeoutMs,
              );
            }),
          ]);
          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

    // Update the queue
    this.queues.set(key, queuePromise);

    // Clean up when our operation completes
    void queuePromise.finally(() => {
      // Only delete if we're still the last in queue
      if (this.queues.get(key) === queuePromise) {
        this.queues.delete(key);
      }
    });

    return resultPromise;
  }

  private normalizePath(pathStr: string): string {
    // Normalize path: unify separators, resolve dot segments, remove trailing slash.
    //
    // Known limitations:
    // - Case-sensitive comparison: on case-insensitive filesystems (macOS HFS+,
    //   Windows NTFS) "Foo.txt" and "foo.txt" produce different lock keys.
    //   Acceptable because workspace tool calls echo paths back consistently.
    // - No base-directory resolution: "foo.txt" and "/workspace/foo.txt" are
    //   distinct keys. Workspace tools pass paths relative to the workspace root,
    //   so this doesn't arise in practice.
    // Collapse leading //+ before normalize (POSIX preserves leading //)
    const normalized = nodePath.posix.normalize(pathStr.replace(/\\/g, '/').replace(/^\/\/+/, '/'));
    return normalized.replace(/\/+$/, '') || '/';
  }
}
