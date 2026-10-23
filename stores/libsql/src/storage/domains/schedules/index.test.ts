import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import type { Schedule } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SchedulesLibSQL } from './index';

// Table shapes written by builds before the schedules ownership/audit schema
// change (#16166). Existing databases still carry them.
const LEGACY_DDL = [
  `CREATE TABLE mastra_schedules (
    "id" TEXT NOT NULL PRIMARY KEY,
    "target" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "timezone" TEXT,
    "status" TEXT NOT NULL,
    "next_fire_at" INTEGER NOT NULL,
    "last_fire_at" INTEGER,
    "last_run_id" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "metadata" TEXT
  )`,
  `CREATE TABLE mastra_schedule_triggers (
    "schedule_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL PRIMARY KEY,
    "scheduled_fire_at" INTEGER NOT NULL,
    "actual_fire_at" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT
  )`,
  `CREATE INDEX idx_schedule_triggers_schedule_fire ON "mastra_schedule_triggers" ("schedule_id", "actual_fire_at")`,
];

function schedule(id: string, overrides: Partial<Schedule> = {}): Schedule {
  return {
    id,
    target: { type: 'workflow', workflowId: 'wf' },
    cron: '*/5 * * * *',
    status: 'active',
    nextFireAt: 2_000,
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('SchedulesLibSQL legacy schema migration', () => {
  let dir: string;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    // A file database: libsql opens a separate connection for write
    // transactions, which would not see a `:memory:` database.
    dir = mkdtempSync(join(tmpdir(), 'libsql-schedules-'));
    client = createClient({ url: `file:${join(dir, 'mastra.db')}` });
    for (const sql of LEGACY_DDL) await client.execute(sql);
    await client.execute({
      sql: `INSERT INTO mastra_schedules (id, target, cron, status, next_fire_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'legacy-schedule',
        JSON.stringify({ type: 'workflow', workflowId: 'wf' }),
        '0 * * * *',
        'active',
        5_000,
        1,
        1,
      ],
    });
    await client.execute({
      sql: `INSERT INTO mastra_schedule_triggers (schedule_id, run_id, scheduled_fire_at, actual_fire_at, status, error)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['legacy-schedule', 'run-1', 100, 110, 'failed', 'boom'],
    });
  });

  afterEach(() => {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function columns(table: string) {
    const info = await client.execute(`PRAGMA table_info("${table}")`);
    return info.rows.map(row => String(row.name));
  }

  it('adds the ownership columns and keeps existing schedules readable', async () => {
    const store = new SchedulesLibSQL({ client });
    await store.init();

    expect(await columns('mastra_schedules')).toEqual(expect.arrayContaining(['owner_type', 'owner_id']));
    const [legacy] = await store.listSchedules();
    expect(legacy).toMatchObject({ id: 'legacy-schedule', cron: '0 * * * *', status: 'active' });

    await store.createSchedule(schedule('owned', { ownerType: 'agent', ownerId: 'code-agent' }));
    expect((await store.listSchedules({ ownerType: 'agent' })).map(s => s.id)).toEqual(['owned']);
  });

  it('rebuilds the trigger table in the current shape and preserves history', async () => {
    const store = new SchedulesLibSQL({ client });
    await store.init();

    const cols = await columns('mastra_schedule_triggers');
    expect(cols).toEqual(expect.arrayContaining(['id', 'outcome', 'trigger_kind', 'parent_trigger_id', 'metadata']));
    expect(cols).not.toContain('status');

    expect(await store.listTriggers('legacy-schedule')).toEqual([
      expect.objectContaining({
        id: 'run-1',
        runId: 'run-1',
        scheduledFireAt: 100,
        actualFireAt: 110,
        outcome: 'failed',
        error: 'boom',
        triggerKind: 'schedule-fire',
      }),
    ]);

    // New writes may omit the run id, which the legacy NOT NULL primary key rejected.
    await store.recordTrigger({
      scheduleId: 'legacy-schedule',
      runId: null,
      scheduledFireAt: 200,
      actualFireAt: 210,
      outcome: 'skipped',
      triggerKind: 'manual',
    });
    expect(await store.listTriggers('legacy-schedule')).toHaveLength(2);

    const indexes = await client.execute(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'mastra_schedule_triggers'`,
    );
    expect(indexes.rows.map(row => row.name)).toContain('idx_schedule_triggers_schedule_fire');
  });

  it('is a no-op on later boots and when another process migrated first', async () => {
    await new SchedulesLibSQL({ client }).init();
    const second = new SchedulesLibSQL({ client });
    await expect(second.init()).resolves.toBeUndefined();
    expect(await second.listTriggers('legacy-schedule')).toHaveLength(1);
  });

  it('tolerates another process adding the ownership columns mid-migration', async () => {
    // Return the pre-migration column list once, after another "process" has
    // already added the columns, so our ALTER hits a duplicate column.
    let raced = false;
    const racingClient = new Proxy(client, {
      get(target, prop) {
        if (prop !== 'execute') {
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
        return async (stmt: Parameters<typeof client.execute>[0]) => {
          const sql = typeof stmt === 'string' ? stmt : stmt.sql;
          if (!raced && sql === 'PRAGMA table_info("mastra_schedules")') {
            raced = true;
            const stale = await target.execute(stmt);
            await target.execute('ALTER TABLE mastra_schedules ADD COLUMN "owner_type" TEXT DEFAULT NULL');
            await target.execute('ALTER TABLE mastra_schedules ADD COLUMN "owner_id" TEXT DEFAULT NULL');
            return stale;
          }
          return target.execute(stmt);
        };
      },
    });

    const store = new SchedulesLibSQL({ client: racingClient });
    await expect(store.init()).resolves.toBeUndefined();
    expect(raced).toBe(true);
    expect(await columns('mastra_schedules')).toEqual(expect.arrayContaining(['owner_type', 'owner_id']));
  });
});
