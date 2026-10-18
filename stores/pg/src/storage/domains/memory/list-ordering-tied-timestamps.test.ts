import { createSampleMessageV2, createSampleThread } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { connectionString } from '../../test-utils';
import { MemoryPG } from './index';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const SCHEMA_NAME = 'list_ordering_tied_timestamps';
const TOTAL = 205;
const PER_PAGE = 100;
const SAME_MOMENT = new Date('2025-06-01T12:00:00.000Z');

/** Walks every page and returns the ids in the order the store handed them out. */
async function collectIds(readPage: (page: number) => Promise<{ id: string }[]>, between: () => Promise<void>) {
  const ids: string[] = [];
  for (let page = 0; page * PER_PAGE < TOTAL; page++) {
    const rows = await readPage(page);
    ids.push(...rows.map(row => row.id));
    if (page === 0) await between();
  }
  return ids;
}

/** Ids of one page must already be in id order (ascending or descending) when every timestamp is equal. */
function expectPageInIdOrder(ids: string[], direction: 'ASC' | 'DESC') {
  const sorted = [...ids].sort((a, b) => (direction === 'ASC' ? a.localeCompare(b) : b.localeCompare(a)));
  expect(ids).toEqual(sorted);
}

describe('MemoryPG paging over rows that share one timestamp', () => {
  let pool: Pool;
  let store: MemoryPG;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    store = new MemoryPG({ pool, schemaName: SCHEMA_NAME });
    await store.init();
  });

  afterAll(async () => {
    await pool.end();
  });

  for (const direction of ['ASC', 'DESC'] as const) {
    it(`lists ${TOTAL} threads created at the same moment exactly once (${direction}) even after one is updated between pages`, async () => {
      const resourceId = `resource-threads-${direction}-${Date.now()}`;
      const created = new Set<string>();
      for (let index = 0; index < TOTAL; index++) {
        const thread = createSampleThread({ resourceId, date: SAME_MOMENT });
        await store.saveThread({ thread });
        created.add(thread.id);
      }

      let firstId = '';
      const ids = await collectIds(
        async page => {
          const result = await store.listThreads({
            page,
            perPage: PER_PAGE,
            orderBy: { field: 'createdAt', direction },
            filter: { resourceId },
          });
          if (page === 0) firstId = result.threads[0]!.id;
          return result.threads;
        },
        async () => {
          await store.updateThread({ id: firstId, title: 'renamed between pages', metadata: { touched: true } });
        },
      );

      expect(ids).toHaveLength(TOTAL);
      expect(new Set(ids).size).toBe(TOTAL);
      expect(new Set(ids)).toEqual(created);
    });

    it(`lists ${TOTAL} thread messages created at the same moment exactly once (${direction}) even after one is updated between pages`, async () => {
      const thread = createSampleThread();
      await store.saveThread({ thread });
      const created = new Set<string>();
      const messages = Array.from({ length: TOTAL }, (_, index) => {
        const message = createSampleMessageV2({
          threadId: thread.id,
          resourceId: thread.resourceId,
          content: { content: `message ${index}` },
          createdAt: SAME_MOMENT,
        });
        created.add(message.id);
        return message;
      });
      await store.saveMessages({ messages });

      let firstId = '';
      const ids = await collectIds(
        async page => {
          const result = await store.listMessages({
            threadId: thread.id,
            page,
            perPage: PER_PAGE,
            orderBy: { field: 'createdAt', direction },
          });
          if (page === 0) firstId = result.messages[0]!.id;
          expectPageInIdOrder(
            result.messages.map(message => message.id),
            direction,
          );
          return result.messages;
        },
        async () => {
          await store.updateMessages({ messages: [{ id: firstId, content: { metadata: { touched: true } } }] });
        },
      );

      expect(ids).toHaveLength(TOTAL);
      expect(new Set(ids).size).toBe(TOTAL);
      expect(new Set(ids)).toEqual(created);
    });

    it(`lists ${TOTAL} resource messages created at the same moment exactly once (${direction}) even after one is updated between pages`, async () => {
      const resourceId = `resource-messages-${direction}-${Date.now()}`;
      const threadA = createSampleThread({ resourceId });
      const threadB = createSampleThread({ resourceId });
      await store.saveThread({ thread: threadA });
      await store.saveThread({ thread: threadB });
      const created = new Set<string>();
      const messages = Array.from({ length: TOTAL }, (_, index) => {
        const message = createSampleMessageV2({
          threadId: index % 2 === 0 ? threadA.id : threadB.id,
          resourceId,
          content: { content: `message ${index}` },
          createdAt: SAME_MOMENT,
        });
        created.add(message.id);
        return message;
      });
      await store.saveMessages({ messages });

      let firstId = '';
      const ids = await collectIds(
        async page => {
          const result = await store.listMessagesByResourceId({
            resourceId,
            page,
            perPage: PER_PAGE,
            orderBy: { field: 'createdAt', direction },
          });
          if (page === 0) firstId = result.messages[0]!.id;
          expectPageInIdOrder(
            result.messages.map(message => message.id),
            direction,
          );
          return result.messages;
        },
        async () => {
          await store.updateMessages({ messages: [{ id: firstId, content: { metadata: { touched: true } } }] });
        },
      );

      expect(ids).toHaveLength(TOTAL);
      expect(new Set(ids).size).toBe(TOTAL);
      expect(new Set(ids)).toEqual(created);
    });
  }
});
