import { createSampleMessageV2 } from '@internal/storage-test-utils';
import { MastraError } from '@mastra/core/error';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { connectionString } from '../../test-utils';
import { MemoryPG } from './index';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const SCHEMA_NAME = 'save_thread_conflict';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

describe('MemoryPG.saveThread on an existing thread id', () => {
  let pool: Pool;
  let store: MemoryPG;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA_NAME} CASCADE`);
    store = new MemoryPG({ pool, schemaName: SCHEMA_NAME });
    await store.init();
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA_NAME} CASCADE`);
    await pool.end();
  });

  async function seedThread(id: string) {
    await store.saveThread({
      thread: {
        id,
        resourceId: 'user-1',
        title: 'Original',
        metadata: {},
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    });
    await store.saveMessages({
      messages: [createSampleMessageV2({ threadId: id, resourceId: 'user-1', content: { content: 'hello' } })],
    });
  }

  it('updates title and metadata but keeps the stored createdAt for the same owner', async () => {
    await seedThread('same-owner');
    const updatedAt = new Date('2026-02-01T00:00:00.000Z');

    const saved = await store.saveThread({
      thread: {
        id: 'same-owner',
        resourceId: 'user-1',
        title: 'Renamed',
        metadata: { k: 'v' },
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
        updatedAt,
      },
    });
    const stored = await store.getThreadById({ threadId: 'same-owner' });

    for (const thread of [saved, stored!]) {
      expect(thread.resourceId).toBe('user-1');
      expect(thread.title).toBe('Renamed');
      expect(thread.metadata).toEqual({ k: 'v' });
      expect(new Date(thread.createdAt).toISOString()).toBe(CREATED_AT.toISOString());
      expect(new Date(thread.updatedAt).toISOString()).toBe(updatedAt.toISOString());
    }
  });

  it('refuses a different owner and leaves the thread and its messages untouched', async () => {
    await seedThread('other-owner');

    const error = await store
      .saveThread({
        thread: {
          id: 'other-owner',
          resourceId: 'user-2',
          title: 'Hijacked',
          metadata: {},
          createdAt: new Date('2030-01-01T00:00:00.000Z'),
          updatedAt: new Date('2030-01-01T00:00:00.000Z'),
        },
      })
      .catch(e => e);

    expect(error).toBeInstanceOf(MastraError);
    expect(error.id).toBe('MASTRA_STORAGE_PG_SAVE_THREAD_RESOURCE_ID_MISMATCH');

    const thread = await store.getThreadById({ threadId: 'other-owner' });
    expect(thread!.resourceId).toBe('user-1');
    expect(thread!.title).toBe('Original');
    expect(new Date(thread!.createdAt).toISOString()).toBe(CREATED_AT.toISOString());

    const { messages } = await store.listMessages({ threadId: 'other-owner' });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.resourceId).toBe('user-1');
  });

  it('still moves the thread and its messages through updateThreadResourceId', async () => {
    await seedThread('transfer');

    await store.updateThreadResourceId({ threadId: 'transfer', resourceId: 'user-2' });

    const thread = await store.getThreadById({ threadId: 'transfer' });
    expect(thread!.resourceId).toBe('user-2');
    expect(new Date(thread!.createdAt).toISOString()).toBe(CREATED_AT.toISOString());
    const { messages } = await store.listMessages({ threadId: 'transfer' });
    expect(messages.map(m => m.resourceId)).toEqual(['user-2']);
  });
});
