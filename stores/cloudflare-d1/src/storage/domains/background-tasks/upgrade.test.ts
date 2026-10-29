import { BackgroundTaskManager } from '@mastra/core/background-tasks';
import { Mastra } from '@mastra/core/mastra';
import { TABLE_BACKGROUND_TASKS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { Miniflare } from 'miniflare';
import { describe, expect, it, vi } from 'vitest';

import { D1Store } from '../..';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

// Columns added to the background tasks table after its first release.
const ADDED_COLUMNS = ['suspend_payload', 'suspendedAt', 'ownerId', 'leaseExpiresAt', 'expiresAt', 'metadata'];

describe('D1 background tasks table upgrade', () => {
  it('keeps finished rows from before expiresAt existed under the global retention', async () => {
    const mf = new Miniflare({ modules: true, script: 'export default {};', d1Databases: { DB: ':memory:' } });
    try {
      const binding = await mf.getD1Database('DB');
      const table = `upgrade_${TABLE_BACKGROUND_TASKS}`;
      const legacyColumns = Object.keys(TABLE_SCHEMAS[TABLE_BACKGROUND_TASKS]).filter(c => !ADDED_COLUMNS.includes(c));
      await binding.prepare(`CREATE TABLE ${table} (${legacyColumns.map(c => `"${c}" TEXT`).join(', ')})`).run();
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
      await binding
        .prepare(
          `INSERT INTO ${table} (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
        )
        .bind(...Object.values(row))
        .run();

      const store = new D1Store({ id: 'upgrade', binding, tablePrefix: 'upgrade_' });
      await store.init();
      const manager = new BackgroundTaskManager({ enabled: true, recoverStaleTasksOnStart: false });
      manager.__registerMastra(new Mastra({ logger: false, storage: store }));

      const backgroundTasks = (await store.getStore('backgroundTasks'))!;
      expect((await backgroundTasks.getTask('legacy-task'))?.expiresAt).toBeUndefined();

      // Completed rows are kept for an hour by default; this one finished five minutes ago.
      await manager.cleanup();
      expect(await backgroundTasks.getTask('legacy-task')).toMatchObject({ status: 'completed', result: 'done' });
    } finally {
      await mf.dispose();
    }
  });
});
