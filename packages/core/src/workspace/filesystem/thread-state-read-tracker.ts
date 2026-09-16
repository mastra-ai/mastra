import type { IMastraLogger } from '../../logger';
import type { ThreadStateStorage } from '../../storage/domains/thread-state';
import type { FileReadRecord, FileReadTracker } from './file-read-tracker';
import { evaluateReadRecord, normalizeReadTrackerPath } from './file-read-tracker';

/**
 * `threadState` storage `type` namespace under which workspace read records
 * are stored. One slot per thread, alongside the built-in task list
 * (`'task'`) and goal objectives (`'goal'`).
 */
export const WORKSPACE_READS_STATE_TYPE = 'workspace-reads';

/**
 * Maximum number of read records kept per thread. When exceeded, the record
 * with the oldest `readAt` is evicted — forcing at worst a re-read of a file
 * that was read long ago.
 */
const MAX_RECORDS_PER_THREAD = 200;

/**
 * JSON-safe wire format for a read record. Dates are ISO strings so the value
 * round-trips through SQL-backed thread-state adapters.
 */
interface SerializedReadRecord {
  readAt: string;
  modifiedAtRead: string;
  scope?: string;
}

type SerializedReadRecords = Record<string, SerializedReadRecord>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deserializeRecords(value: unknown): Map<string, FileReadRecord> {
  const records = new Map<string, FileReadRecord>();
  if (!isPlainObject(value)) return records;
  for (const [path, raw] of Object.entries(value)) {
    if (!isPlainObject(raw)) continue;
    if (typeof raw.readAt !== 'string' || typeof raw.modifiedAtRead !== 'string') continue;
    const readAt = new Date(raw.readAt);
    const modifiedAtRead = new Date(raw.modifiedAtRead);
    if (Number.isNaN(readAt.getTime()) || Number.isNaN(modifiedAtRead.getTime())) continue;
    // Tolerate records without a scope (they fail closed at the gate).
    const scope = typeof raw.scope === 'string' ? raw.scope : undefined;
    records.set(path, { path, readAt, modifiedAtRead, scope });
  }
  return records;
}

function serializeRecords(records: Map<string, FileReadRecord>): SerializedReadRecords {
  const out: SerializedReadRecords = {};
  for (const [path, record] of records) {
    out[path] = {
      readAt: record.readAt.toISOString(),
      modifiedAtRead: record.modifiedAtRead.toISOString(),
      ...(record.scope !== undefined ? { scope: record.scope } : {}),
    };
  }
  return out;
}

/**
 * FileReadTracker backed by the `threadState` storage domain.
 *
 * Read records are stored per thread under `type: 'workspace-reads'`, so
 * `requireReadBeforeWrite` state survives suspend/resume (plan approval,
 * `requireApproval` tools), later turns on the same thread, and process
 * restarts on serverless runtimes — whenever the configured storage adapter
 * persists the thread-state domain. Tracker instances are cheap and carry no
 * authoritative state of their own: the agent constructs one per run.
 *
 * Storage failures degrade gracefully: the tracker keeps an in-instance cache
 * that stays correct for the current run, and persistence resumes on the next
 * successful write.
 */
export class ThreadStateFileReadTracker implements FileReadTracker {
  private readonly threadId: string;
  private readonly store: ThreadStateStorage;
  private readonly logger?: Pick<IMastraLogger, 'debug'>;
  private cache?: Map<string, FileReadRecord>;
  private loadPromise?: Promise<Map<string, FileReadRecord>>;
  /** Serializes setState calls so parallel tool calls don't interleave writes. */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor({
    threadId,
    store,
    logger,
  }: {
    threadId: string;
    store: ThreadStateStorage;
    logger?: Pick<IMastraLogger, 'debug'>;
  }) {
    this.threadId = threadId;
    this.store = store;
    this.logger = logger;
  }

  async recordRead(path: string, modifiedAt: Date, scope?: string): Promise<void> {
    const records = await this.ensureLoaded();
    const normalizedPath = normalizeReadTrackerPath(path);
    if (!records.has(normalizedPath) && records.size >= MAX_RECORDS_PER_THREAD) {
      this.evictOldest(records);
    }
    records.set(normalizedPath, {
      path: normalizedPath,
      readAt: new Date(),
      modifiedAtRead: modifiedAt,
      scope,
    });
    await this.persist();
  }

  async getReadRecord(path: string): Promise<FileReadRecord | undefined> {
    const records = await this.ensureLoaded();
    return records.get(normalizeReadTrackerPath(path));
  }

  async needsReRead(
    path: string,
    currentModifiedAt: Date,
    scope?: string,
  ): Promise<{ needsReRead: boolean; reason?: string }> {
    return evaluateReadRecord(path, await this.getReadRecord(path), currentModifiedAt, scope);
  }

  async clearReadRecord(path: string): Promise<void> {
    const records = await this.ensureLoaded();
    if (!records.delete(normalizeReadTrackerPath(path))) return;
    await this.persist();
  }

  async clear(): Promise<void> {
    const records = await this.ensureLoaded();
    records.clear();
    await this.persist();
  }

  /**
   * Load records from storage once per instance; later calls hit the cache.
   * Load failures fall back to an empty record set (per-run semantics).
   */
  private ensureLoaded(): Promise<Map<string, FileReadRecord>> {
    if (this.cache) return Promise.resolve(this.cache);
    this.loadPromise ??= this.store
      .getState<SerializedReadRecords>({ threadId: this.threadId, type: WORKSPACE_READS_STATE_TYPE })
      .then(value => deserializeRecords(value))
      .catch(error => {
        this.logger?.debug('Failed to load workspace read records from thread state; starting empty', {
          threadId: this.threadId,
          error,
        });
        return new Map<string, FileReadRecord>();
      })
      .then(records => {
        this.cache = records;
        return records;
      });
    return this.loadPromise;
  }

  private evictOldest(records: Map<string, FileReadRecord>): void {
    let oldestPath: string | undefined;
    let oldestReadAt = Infinity;
    for (const [path, record] of records) {
      const readAt = record.readAt.getTime();
      if (readAt < oldestReadAt) {
        oldestReadAt = readAt;
        oldestPath = path;
      }
    }
    if (oldestPath !== undefined) records.delete(oldestPath);
  }

  /**
   * Persist the full record map (full-replacement semantics of the
   * thread-state domain). Failures are logged at debug and swallowed — the
   * in-instance cache keeps the current run correct.
   */
  private persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => {
      if (!this.cache) return;
      return this.store
        .setState({
          threadId: this.threadId,
          type: WORKSPACE_READS_STATE_TYPE,
          value: serializeRecords(this.cache),
        })
        .catch(error => {
          this.logger?.debug('Failed to persist workspace read records to thread state', {
            threadId: this.threadId,
            error,
          });
        });
    });
    return this.writeQueue;
  }
}
