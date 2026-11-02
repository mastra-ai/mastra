import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

describe('background task JSONB storage', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore({ id: `background-json-${randomUUID()}`, connectionString });
    await store.init();
  }, 60000);

  afterAll(async () => {
    await store?.close();
  });

  it('repairs task arguments and updated results without losing literal escapes', async () => {
    const tasks = await store.getStore('backgroundTasks');
    const id = randomUUID();
    const data = { path: 'C:\\path\\\uD800-end', literal: String.raw`literal\uD800`, nul: 'a\0b' };
    const expected = { path: 'C:\\path\\�-end', literal: data.literal, nul: 'ab' };

    await tasks.createTask({
      id,
      toolCallId: randomUUID(),
      toolName: 'test',
      agentId: 'agent',
      runId: randomUUID(),
      status: 'pending',
      args: data,
      retryCount: 0,
      maxRetries: 1,
      timeoutMs: 1000,
      createdAt: new Date(),
    });
    expect((await tasks.getTask(id))?.args).toEqual(expected);

    await tasks.updateTask(id, { result: data });
    expect((await tasks.getTask(id))?.result).toEqual(expected);
  });
});

describe('background task expiresAt column upgrade', () => {
  const schemaName = `bg_upgrade_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const table = `"${schemaName}".mastra_background_tasks`;
  const stores: PostgresStore[] = [];
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString });
  });

  afterAll(async () => {
    await Promise.all(stores.map(s => s.close()));
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.end();
  });

  it('leaves rows that predate the column without an expiry', async () => {
    const before = new PostgresStore({ id: `bg-upgrade-a-${randomUUID()}`, connectionString, schemaName });
    stores.push(before);
    await before.init();
    // Recreate the table shape from before the columns existed.
    await pool.query(`ALTER TABLE ${table} DROP COLUMN "expiresAt", DROP COLUMN "expiresAtZ", DROP COLUMN "metadata"`);
    const id = randomUUID();
    const completedAt = new Date(Date.now() - 60_000).toISOString();
    await pool.query(
      `INSERT INTO ${table} (id, tool_call_id, tool_name, agent_id, run_id, status, args, retry_count, max_retries, timeout_ms, "createdAt", "createdAtZ", "completedAt", "completedAtZ")
       VALUES ($1, $1, 'tool', 'agent', $1, 'completed', '{}', 0, 0, 1000, $2, $3, $2, $3)`,
      [id, completedAt, completedAt],
    );

    // A new process adds the columns. Postgres backfills the TIMESTAMPTZ twin
    // with its DEFAULT NOW(), so presence must come from the naive column.
    const after = new PostgresStore({ id: `bg-upgrade-b-${randomUUID()}`, connectionString, schemaName });
    stores.push(after);
    await after.init();
    const tasks = await after.getStore('backgroundTasks');

    expect((await tasks.getTask(id))?.expiresAt).toBeUndefined();
    expect((await tasks.listTasks({ hasExpiresAt: false })).tasks.map(t => t.id)).toEqual([id]);

    await tasks.deleteTasks({ status: 'completed', dateFilterBy: 'expiresAt', toDate: new Date(Date.now() + 60_000) });
    expect(await tasks.getTask(id)).not.toBeNull();
  });
});
