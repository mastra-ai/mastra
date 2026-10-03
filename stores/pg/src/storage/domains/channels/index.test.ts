import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exportSchemas, PostgresStore } from '../../index';
import { ChannelsPG } from './index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

describe('channel thread mappings table', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore({ id: `channels-threads-${randomUUID()}`, connectionString });
    await store.init();
  }, 60000);

  afterAll(async () => {
    await store?.close();
  });

  it('exports mastra_channel_threads with its composite primary key and threadId index', () => {
    const ddl = ChannelsPG.getExportDDL().join('\n');
    expect(ddl).toContain('"mastra_channel_threads"');
    expect(ddl).toContain('PRIMARY KEY ("platform", "ownerId", "externalThreadId")');
    expect(ddl).toContain('idx_channel_threads_thread_id');
    expect(exportSchemas()).toContain('"mastra_channel_threads"');
  });

  it('creates the composite primary key and dedupes upserts on the same key', async () => {
    const pkColumns = await store.db.manyOrNone<{ column_name: string }>(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       WHERE tc.table_schema = 'public' AND tc.table_name = 'mastra_channel_threads' AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.ordinal_position`,
    );
    expect(pkColumns.map(c => c.column_name)).toEqual(['platform', 'ownerId', 'externalThreadId']);

    const channels = (await store.getStore('channels'))!;
    const key = { platform: 'slack', ownerId: `owner-${randomUUID()}`, externalThreadId: `slack:C1:${randomUUID()}` };
    await channels.upsertThreadMapping!({ ...key, externalChannelId: 'C1', threadId: 'thread-1' });
    await channels.upsertThreadMapping!({ ...key, externalChannelId: 'C2', threadId: 'thread-2' });

    const { count } = await store.db.one<{ count: string }>(
      `SELECT count(*)::text AS count FROM "mastra_channel_threads" WHERE "platform" = $1 AND "ownerId" = $2 AND "externalThreadId" = $3`,
      [key.platform, key.ownerId, key.externalThreadId],
    );
    expect(count).toBe('1');
    expect(await channels.getThreadMapping!(key)).toMatchObject({ threadId: 'thread-1', externalChannelId: 'C2' });
  });
});

describe('channel JSONB storage', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore({ id: `channels-json-${randomUUID()}`, connectionString });
    await store.init();
  }, 60000);

  afterAll(async () => {
    await store?.close();
  });

  it('repairs invalid characters while preserving literal escapes in installation and config data', async () => {
    const channels = await store.getStore('channels');
    const platform = `test-${randomUUID()}`;
    const data = { path: 'C:\\path\\\uD800-end', literal: String.raw`literal\uD800`, nul: 'a\0b' };
    const expected = { path: 'C:\\path\\�-end', literal: data.literal, nul: 'ab' };

    await channels.saveInstallation({
      id: randomUUID(),
      platform,
      agentId: randomUUID(),
      status: 'active',
      data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const installation = await channels.getInstallationByAgent(
      platform,
      (await channels.listInstallations(platform))[0]!.agentId,
    );
    expect(installation?.data).toEqual(expected);

    await channels.saveConfig({ platform, data, updatedAt: new Date() });
    expect((await channels.getConfig(platform))?.data).toEqual(expected);
  });
});
