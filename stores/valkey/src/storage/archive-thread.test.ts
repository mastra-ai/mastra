import { randomUUID } from 'node:crypto';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ValkeyStore } from './index';

describe.runIf(process.env.ENABLE_TESTS === 'true')('ValkeyStore thread archiving', () => {
  const store = new ValkeyStore({
    id: 'valkey-archive-test',
    host: 'localhost',
    port: 6382,
    password: 'valkey_password',
  });
  let memory: MemoryStorage;
  const resourceId = `resource-${randomUUID()}`;
  const created = new Date('2024-01-01T00:00:00.000Z');

  beforeAll(async () => {
    await store.init();
    memory = (await store.getStore('memory'))!;
    for (const id of ['a', 'b']) {
      await memory.saveThread({
        thread: {
          id: `${resourceId}-${id}`,
          resourceId,
          title: id,
          metadata: {},
          createdAt: created,
          updatedAt: created,
        },
      });
    }
  });

  afterAll(async () => {
    await store.close();
  });

  const ids = async (archived?: boolean) => {
    const { threads, total } = await memory.listThreads({ filter: { resourceId, archived }, perPage: false });
    return { ids: threads.map(t => t.id.slice(resourceId.length + 1)).sort(), total };
  };

  it('archives, filters, preserves on title update, and unarchives', async () => {
    const archivedAt = new Date('2024-02-01T00:00:00.000Z');
    const updated = await memory.updateThread({ id: `${resourceId}-a`, archivedAt });
    expect(updated.updatedAt.getTime()).toBe(created.getTime());

    expect(await ids(true)).toEqual({ ids: ['a'], total: 1 });
    expect(await ids(false)).toEqual({ ids: ['b'], total: 1 });
    expect(await ids()).toEqual({ ids: ['a', 'b'], total: 2 });

    await memory.updateThread({ id: `${resourceId}-a`, title: 'renamed' });
    const fetched = await memory.getThreadById({ threadId: `${resourceId}-a` });
    expect(fetched?.archivedAt?.getTime()).toBe(archivedAt.getTime());

    await memory.updateThread({ id: `${resourceId}-a`, archivedAt: null });
    expect(await ids(true)).toEqual({ ids: [], total: 0 });
  });
});
