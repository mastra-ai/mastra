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
    const tx = await this.client.transaction('write');
    try {
      const selected = await tx.execute({
        sql: `SELECT value FROM ${TABLE} WHERE thread_id = ? AND behavior_id = ?`,
        args: [key.threadId, key.behaviorId],
      });
      const value = selected.rows[0]?.value;
      const current = typeof value === 'string' ? (JSON.parse(value) as BehaviorRuntimeRecord) : undefined;
      const { next, result } = await operation(current);
      await tx.execute({
        sql: `INSERT INTO ${TABLE} (thread_id, behavior_id, revision, next_check_at, value)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(thread_id, behavior_id) DO UPDATE SET
            revision = excluded.revision, next_check_at = excluded.next_check_at, value = excluded.value`,
        args: [key.threadId, key.behaviorId, next.revision, next.nextCheckAt ?? null, JSON.stringify(next)],
      });
      await tx.commit();
      return { runtime: structuredClone(next), result };
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
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
