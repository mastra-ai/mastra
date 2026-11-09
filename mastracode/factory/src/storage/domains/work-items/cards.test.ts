import type { FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../../test-utils.js';
import type { BoardItemDbRecord } from './work-item-schema.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const ORG = 'org-1';
const PROJECT = 'project-1';

afterEach(() => {
  vi.restoreAllMocks();
});

function pauseBeforeNextWorkItemRead(storage: FactoryStorage) {
  const findMany = storage.ops.findMany.bind(storage.ops);
  const reached = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  let pausing = true;
  vi.spyOn(storage.ops, 'findMany').mockImplementation(async (...args: Parameters<typeof findMany>) => {
    if (pausing && args[0] === 'factory_work_items') {
      pausing = false;
      reached.resolve();
      await resume.promise;
    }
    return findMany(...args);
  });
  return { reached: reached.promise, resume: resume.resolve };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('card reads on %s', backend => {
  async function setup() {
    const { storage, workItems } = await createFactoryStorageForTests(
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: 'card-reads-test', url: ':memory:' }),
    );
    const file = async (title: string) =>
      (
        await workItems.upsert({
          orgId: ORG,
          userId: 'user-alice',
          factoryProjectId: PROJECT,
          input: { title, stages: ['intake'], sessions: {}, metadata: {} },
        })
      ).item;
    return { storage, workItems, file };
  }

  it('keeps showing the board when a card is deleted while the board is read', async () => {
    const { storage, workItems, file } = await setup();
    await file('Kept');
    const doomed = await file('Doomed');
    const paused = pauseBeforeNextWorkItemRead(storage);
    const poll = workItems.list({ orgId: ORG, factoryProjectId: PROJECT });
    await paused.reached;

    await workItems.delete({ orgId: ORG, id: doomed.id });
    paused.resume();

    expect((await poll).map(card => card.title)).toEqual(['Kept']);
  });

  it('finds no card when it is deleted while being looked up', async () => {
    const { storage, workItems, file } = await setup();
    const doomed = await file('Doomed');
    const paused = pauseBeforeNextWorkItemRead(storage);
    const lookup = workItems.get({ orgId: ORG, id: doomed.id });
    await paused.reached;

    await workItems.delete({ orgId: ORG, id: doomed.id });
    paused.resume();

    expect(await lookup).toBeNull();
  });

  it('reports a card whose work item is missing instead of hiding it', async () => {
    const { storage, workItems, file } = await setup();
    const card = await file('Corrupt');
    const board = await storage.ops.findOne<BoardItemDbRecord>('factory_board_items', { id: card.id });
    await storage.ops.deleteMany('factory_work_items', { id: board!.work_item_id });

    await expect(workItems.list({ orgId: ORG, factoryProjectId: PROJECT })).rejects.toThrow(
      `Board item ${card.id} has no work item ${board!.work_item_id}.`,
    );
  });
});
