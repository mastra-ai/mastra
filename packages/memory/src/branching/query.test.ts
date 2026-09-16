import { MASTRA_THREAD_BRANCH_METADATA_KEY } from '@mastra/core/memory';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../index';
import { serializeThreadBranchMetadata } from './lineage';
import { queryThreadMessages } from './query';

const resourceId = 'query-resource';
const baseTime = new Date('2026-02-01T00:00:00.000Z');

function message(
  id: string,
  threadId: string,
  milliseconds: number,
  metadata?: Record<string, string>,
): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: id }], ...(metadata ? { metadata } : {}) },
    createdAt: new Date(baseTime.getTime() + milliseconds),
  };
}

describe('branch logical message queries', () => {
  let memory: Memory;
  let store: MemoryStorage;

  beforeEach(async () => {
    memory = new Memory({ storage: new InMemoryStore() });
    store = (await memory.storage.getStore('memory'))!;
  });

  async function seedRoot(messages: MastraDBMessage[]): Promise<void> {
    await memory.createThread({ threadId: 'root', resourceId, title: 'Root' });
    await memory.saveMessages({ messages });
  }

  it('resolves root, sibling, and nested paths with tuple cutoffs and physical ownership', async () => {
    await seedRoot([
      message('a', 'root', 0),
      message('b', 'root', 0),
      message('c', 'root', 0),
      message('d', 'root', 1),
    ]);
    const first = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'b' });
    const sibling = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'a' });
    await memory.saveMessages({ messages: [message('first-tail', first.thread.id, 10)] });
    await memory.saveMessages({ messages: [message('sibling-tail', sibling.thread.id, 11)] });
    const nested = await memory.branchThread({ threadId: first.thread.id, branchPointMessageId: 'a' });
    await memory.saveMessages({ messages: [message('nested-tail', nested.thread.id, 12)] });

    expect((await memory.recall({ threadId: 'root', perPage: false })).messages.map(item => item.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect((await memory.recall({ threadId: first.thread.id, perPage: false })).messages.map(item => item.id)).toEqual([
      'a',
      'b',
      'first-tail',
    ]);
    expect(
      (await memory.recall({ threadId: sibling.thread.id, perPage: false })).messages.map(item => item.id),
    ).toEqual(['a', 'sibling-tail']);
    const nestedMessages = (await memory.recall({ threadId: nested.thread.id, perPage: false })).messages;
    expect(nestedMessages.map(item => item.id)).toEqual(['a', 'nested-tail']);
    expect(nestedMessages.map(item => item.threadId)).toEqual(['root', nested.thread.id]);
  });

  it('loads inherited history when recall is limited by tokens', async () => {
    await seedRoot([message('a', 'root', 0), message('b', 'root', 1), message('parent-tail', 'root', 2)]);
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'b' });
    await memory.saveMessages({ messages: [message('child-tail', branch.thread.id, 3)] });

    const result = await memory.recall({
      threadId: branch.thread.id,
      threadConfig: { messageHistory: { maxTokens: 10_000 } },
    });

    expect(result.messages.map(item => item.id)).toEqual(['a', 'b', 'child-tail']);
  });

  it('applies filters, deterministic pagination, exact totals, and both order directions', async () => {
    await seedRoot([
      message('a', 'root', 0, { kind: 'keep' }),
      message('b', 'root', 1, { kind: 'drop' }),
      message('c', 'root', 2, { kind: 'keep' }),
    ]);
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'c' });
    await memory.saveMessages({
      messages: [
        message('d', branch.thread.id, 3, { kind: 'keep' }),
        message('e', branch.thread.id, 4, { kind: 'keep' }),
      ],
    });

    const firstPage = await queryThreadMessages(store, {
      threadId: branch.thread.id,
      perPage: 2,
      page: 0,
      filter: {
        metadata: { kind: 'keep' },
        dateRange: { start: new Date(baseTime.getTime()), end: new Date(baseTime.getTime() + 4) },
      },
    });
    expect(firstPage).toMatchObject({ total: 4, page: 0, perPage: 2, hasMore: true });
    expect(firstPage.messages.map(item => item.id)).toEqual(['a', 'c']);

    const descending = await memory.recall({
      threadId: branch.thread.id,
      perPage: 2,
      page: 1,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
    expect(descending).toMatchObject({ total: 5, hasMore: true });
    expect(descending.messages.map(item => item.id)).toEqual(['b', 'c']);
    expect(
      (
        await queryThreadMessages(store, {
          threadId: branch.thread.id,
          perPage: 2,
          page: 1,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        })
      ).messages.map(item => item.id),
    ).toEqual(['c', 'b']);

    const unlimited = await memory.recall({ threadId: branch.thread.id, perPage: false });
    expect(unlimited).toMatchObject({ total: 5, perPage: false, hasMore: false });
  });

  it('counts equal-timestamp tuple boundaries exactly', async () => {
    await seedRoot([message('a', 'root', 0), message('b', 'root', 0), message('c', 'root', 0)]);
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'b' });
    await memory.saveMessages({ messages: [message('tail', branch.thread.id, 1)] });

    const first = await queryThreadMessages(store, { threadId: branch.thread.id, perPage: 1, page: 0 });
    const second = await queryThreadMessages(store, { threadId: branch.thread.id, perPage: 1, page: 1 });
    expect(first).toMatchObject({ total: 3, hasMore: true });
    expect(second).toMatchObject({ total: 3, hasMore: true });
    expect(first.messages.map(item => item.id)).toEqual(['a']);
    expect(second.messages.map(item => item.id)).toEqual(['b']);
  });

  it('resolves includes and context across segment boundaries without leaking unreachable rows', async () => {
    await seedRoot([message('a', 'root', 0), message('b', 'root', 1), message('parent-tail', 'root', 2)]);
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'b' });
    await memory.saveMessages({ messages: [message('child-tail', branch.thread.id, 3)] });

    const branchInclude = await queryThreadMessages(store, {
      threadId: branch.thread.id,
      perPage: 0,
      include: [{ id: 'child-tail', withPreviousMessages: 1 }],
    });
    expect(branchInclude.messages.map(item => item.id)).toEqual(['b', 'child-tail']);

    const unreachable = await queryThreadMessages(store, {
      threadId: branch.thread.id,
      perPage: 0,
      include: [{ id: 'parent-tail', withPreviousMessages: 2, withNextMessages: 2 }],
    });
    expect(unreachable.messages).toEqual([]);

    const rootLeak = await queryThreadMessages(store, {
      threadId: 'root',
      perPage: 0,
      include: [{ id: 'child-tail', withPreviousMessages: 2 }],
    });
    expect(rootLeak.messages).toEqual([]);
  });

  it('recovers a timestamp cohort larger than a page while bounding normal reads', async () => {
    const tied = Array.from({ length: 150 }, (_, index) => message(`m-${String(index).padStart(3, '0')}`, 'root', 0));
    await seedRoot(tied);
    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'm-120' });
    const listSpy = vi.spyOn(store, 'listMessages');

    const result = await queryThreadMessages(store, {
      threadId: branch.thread.id,
      perPage: 10,
      includeTotal: false,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    expect(result.messages.map(item => item.id)).toEqual([
      'm-120',
      'm-119',
      'm-118',
      'm-117',
      'm-116',
      'm-115',
      'm-114',
      'm-113',
      'm-112',
      'm-111',
    ]);
    expect(result.hasMore).toBe(true);
    expect(
      listSpy.mock.calls.some(
        ([input]) =>
          input.perPage === false &&
          input.filter?.dateRange?.start?.getTime() === baseTime.getTime() &&
          input.filter?.dateRange?.end?.getTime() === baseTime.getTime(),
      ),
    ).toBe(true);
    expect(
      listSpy.mock.calls.filter(
        ([input]) => input.perPage === false && input.filter?.dateRange?.start?.getTime() !== baseTime.getTime(),
      ),
    ).toHaveLength(0);
  });

  it('rejects branch participants in multi-thread and resource-wide reads but preserves ordinary and pending-only reads', async () => {
    await seedRoot([message('a', 'root', 0)]);
    await memory.createThread({ threadId: 'ordinary', resourceId });
    await memory.saveMessages({ messages: [message('ordinary-message', 'ordinary', 1)] });

    const ordinaryUnion = await queryThreadMessages(store, {
      threadId: ['ordinary'],
      perPage: false,
    });
    expect(ordinaryUnion.messages.map(item => item.id)).toEqual(['ordinary-message']);

    const branch = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'a' });
    await expect(queryThreadMessages(store, { threadId: [branch.thread.id] })).rejects.toMatchObject({
      id: 'BRANCH_INVALID_REQUEST',
    });
    await expect(queryThreadMessages(store, { threadId: ['ordinary', branch.thread.id] })).rejects.toMatchObject({
      id: 'BRANCH_INVALID_REQUEST',
    });
    await expect(memory.listMessagesByResourceId({ resourceId })).rejects.toMatchObject({
      id: 'BRANCH_INVALID_REQUEST',
    });

    const pendingResource = 'pending-resource';
    const now = new Date();
    const pending: StorageThreadType = {
      id: 'pending',
      resourceId: pendingResource,
      createdAt: now,
      updatedAt: now,
      metadata: {
        [MASTRA_THREAD_BRANCH_METADATA_KEY]: serializeThreadBranchMetadata({
          parentThreadId: 'missing-parent',
          branchPointMessageId: 'missing-message',
          branchPointCreatedAt: now,
          branchCreatedAt: now,
          observationalMemoryThreadId: 'pending',
          state: 'pending',
        }),
      },
    };
    await store.saveThread({ thread: pending });
    expect(await memory.listMessagesByResourceId({ resourceId: pendingResource })).toMatchObject({ messages: [] });
  });
});
