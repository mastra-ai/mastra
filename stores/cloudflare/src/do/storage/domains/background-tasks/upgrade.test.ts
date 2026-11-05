import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';

import { BackgroundTaskManager } from '@mastra/core/background-tasks';
import { Mastra } from '@mastra/core/mastra';
import { TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { CloudflareDOStorage } from '../../../index';

// Columns added to the background tasks table after its first release.
const ADDED_COLUMNS = ['suspend_payload', 'suspendedAt', 'ownerId', 'leaseExpiresAt', 'expiresAt', 'metadata'];

describe('Durable Object background tasks table upgrade', () => {
  it('keeps finished rows from before expiresAt existed under the global retention', async () => {
    // Stands in for a Durable Object's `ctx.storage.sql` with a real SQLite database.
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec(query: string, ...bindings: SQLInputValue[]) {
        const rows = db.prepare(query).all(...bindings) as Record<string, unknown>[];
        return { toArray: () => rows };
      },
    };
    const table = `upgrade_${TABLE_BACKGROUND_TASKS}`;
    const legacyColumns = Object.keys(TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS]).filter(c => !ADDED_COLUMNS.includes(c));
    db.exec(`CREATE TABLE ${table} (${legacyColumns.map(c => `"${c}" TEXT`).join(', ')})`);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const row: Record<string, string | number> = {
      id: 'legacy-task',
      tool_call_id: 'call-1',
      tool_name: 'report',
      agent_id: 'agent-1',
      run_id: 'run-1',
      status: 'completed',
      args: '{}',
      result: '"done"',
      retry_count: 0,
      max_retries: 0,
      timeout_ms: 300_000,
      createdAt: fiveMinutesAgo,
      completedAt: fiveMinutesAgo,
    };
    const keys = Object.keys(row);
    db.prepare(
      `INSERT INTO ${table} (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    ).run(...Object.values(row));

    const storage = new CloudflareDOStorage({ sql: sql as never, tablePrefix: 'upgrade_' });
    await storage.init();
    const manager = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: false });
    manager.__registerMastra(new Mastra({ logger: false, storage }));

    const backgroundTasks = (await storage.getStore('backgroundTasks'))!;
    expect((await backgroundTasks.getTask('legacy-task'))?.expiresAt).toBeUndefined();

    // Completed rows are kept for an hour by default; this one finished five minutes ago.
    await manager.cleanup();
    expect(await backgroundTasks.getTask('legacy-task')).toMatchObject({ status: 'completed', result: 'done' });
  });
});
