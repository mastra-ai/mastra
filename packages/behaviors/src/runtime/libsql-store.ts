import type { Client } from '@libsql/client';

import type {
  BehaviorDueWork,
  BehaviorRuntimeRecord,
  BehaviorRuntimeStore,
  BehaviorThreadKey,
  BehaviorTransactionResult,
} from './types.js';

const TABLE = 'mastra_behavior_runtime';

export class LibSQLBehaviorRuntimeStore implements BehaviorRuntimeStore {
  private readonly tails = new Map<string, Promise<void>>();

  constructor(private readonly client: Client) {}

  async init(): Promise<void> {
    await this.client.execute(`CREATE TABLE IF NOT EXISTS ${TABLE} (
      thread_id TEXT NOT NULL,
      behavior_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      next_check_at TEXT,
      value TEXT NOT NULL,
      PRIMARY KEY (thread_id, behavior_id)
    )`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_due ON ${TABLE} (next_check_at)`);
  }

  async readThread(key: BehaviorThreadKey): Promise<BehaviorRuntimeRecord | undefined> {
    const result = await this.client.execute({
      sql: `SELECT value FROM ${TABLE} WHERE thread_id = ? AND behavior_id = ?`,
      args: [key.threadId, key.behaviorId],
    });
    const value = result.rows[0]?.value;
    return typeof value === 'string' ? (JSON.parse(value) as BehaviorRuntimeRecord) : undefined;
  }

  async transactThread<T>(
    key: BehaviorThreadKey,
    operation: (current: BehaviorRuntimeRecord | undefined) => Promise<BehaviorTransactionResult<T>> | BehaviorTransactionResult<T>,
  ): Promise<{ runtime: BehaviorRuntimeRecord; result: T }> {
    const storageKey = `${key.threadId}\0${key.behaviorId}`;
    const prior = this.tails.get(storageKey) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const queued = prior.then(() => gate);
    this.tails.set(storageKey, queued);
    await prior;
    try {
      return await this.transactUnlocked(key, operation);
    } finally {
      release();
      if (this.tails.get(storageKey) === queued) this.tails.delete(storageKey);
    }
  }

  private async transactUnlocked<T>(
    key: BehaviorThreadKey,
    operation: (current: BehaviorRuntimeRecord | undefined) => Promise<BehaviorTransactionResult<T>> | BehaviorTransactionResult<T>,
  ): Promise<{ runtime: BehaviorRuntimeRecord; result: T }> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const selected = await this.client.execute({
        sql: `SELECT revision, value FROM ${TABLE} WHERE thread_id = ? AND behavior_id = ?`,
        args: [key.threadId, key.behaviorId],
      });
      const row = selected.rows[0];
      const current = typeof row?.value === 'string' ? (JSON.parse(row.value) as BehaviorRuntimeRecord) : undefined;
      const { next, result } = await operation(current);
      const write = current
        ? await this.client.execute({
            sql: `UPDATE ${TABLE} SET revision = ?, next_check_at = ?, value = ?
              WHERE thread_id = ? AND behavior_id = ? AND revision = ?`,
            args: [
              next.revision,
              next.nextCheckAt ?? null,
              JSON.stringify(next),
              key.threadId,
              key.behaviorId,
              current.revision,
            ],
          })
        : await this.client.execute({
            sql: `INSERT OR IGNORE INTO ${TABLE} (thread_id, behavior_id, revision, next_check_at, value)
              VALUES (?, ?, ?, ?, ?)`,
            args: [key.threadId, key.behaviorId, next.revision, next.nextCheckAt ?? null, JSON.stringify(next)],
          });
      if ((write.rowsAffected ?? 0) > 0) return { runtime: structuredClone(next), result };
    }
    throw new Error(`Behavior transaction contention exceeded for ${key.behaviorId}/${key.threadId}`);
  }

  async listDue(before: Date, limit = 100): Promise<BehaviorDueWork[]> {
    const result = await this.client.execute({
      sql: `SELECT thread_id, behavior_id, next_check_at FROM ${TABLE}
        WHERE next_check_at IS NOT NULL AND next_check_at <= ? ORDER BY next_check_at LIMIT ?`,
      args: [before.toISOString(), limit],
    });
    return result.rows.map(row => ({
      threadId: String(row.thread_id),
      behaviorId: String(row.behavior_id),
      dueAt: String(row.next_check_at),
    }));
  }
}
