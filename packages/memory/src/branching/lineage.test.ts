import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { MASTRA_THREAD_BRANCH_METADATA_KEY } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { Memory } from '../index';
import {
  MAX_THREAD_BRANCH_DEPTH,
  compareMessageTuples,
  parseThreadBranchMetadata,
  resolveThreadLineage,
  sanitizeThread,
} from './lineage';

const resourceId = 'resource';
const timestamp = new Date('2026-01-01T00:00:00.000Z');

function branchMetadata(
  threadId: string,
  parentThreadId: string,
  branchPointMessageId = 'root-message',
  state = 'ready',
) {
  return {
    parentThreadId,
    branchPointMessageId,
    branchPointCreatedAt: timestamp.toISOString(),
    branchCreatedAt: timestamp.toISOString(),
    observationalMemoryThreadId: threadId,
    state,
  };
}

describe('thread branch lineage', () => {
  let memory: Memory;
  let store: MemoryStorage;

  beforeEach(async () => {
    memory = new Memory({ storage: new InMemoryStore() });
    store = (await memory.storage.getStore('memory'))!;
  });

  async function saveRawThread(id: string, metadata?: Record<string, unknown>): Promise<StorageThreadType> {
    return store.saveThread({
      thread: { id, resourceId, metadata, createdAt: timestamp, updatedAt: timestamp },
    });
  }

  async function seedRoot(): Promise<void> {
    await saveRawThread('root');
    await store.saveMessages({
      messages: [
        {
          id: 'root-message',
          threadId: 'root',
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'root' }] },
          createdAt: timestamp,
        },
      ],
    });
  }

  it('enables branching on standard Memory and resolves root, sibling, and nested ancestry', async () => {
    expect(memory.supportsThreadBranching).toBe(true);
    await seedRoot();
    const left = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'root-message' });
    const right = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'root-message' });
    const nested = await memory.branchThread({ threadId: left.thread.id, branchPointMessageId: 'root-message' });

    const resolved = await resolveThreadLineage(store, nested.thread.id);
    expect(resolved.entries.map(entry => entry.thread.id)).toEqual(['root', left.thread.id, nested.thread.id]);
    expect(resolved.messages.map(message => message.id)).toEqual(['root-message']);
    expect((await resolveThreadLineage(store, right.thread.id)).entries).toHaveLength(2);
  });

  it('compares equal timestamps by message id and strips internal metadata', async () => {
    expect(compareMessageTuples({ id: 'a', createdAt: timestamp }, { id: 'b', createdAt: timestamp })).toBeLessThan(0);
    const raw = await saveRawThread('child', {
      ordinary: true,
      [MASTRA_THREAD_BRANCH_METADATA_KEY]: branchMetadata('child', 'root'),
    });
    expect(parseThreadBranchMetadata(raw)?.branchPointCreatedAt).toEqual(timestamp);
    expect(sanitizeThread(raw).metadata).toEqual({ ordinary: true });
  });

  it.each([
    ['non-object', 'bad'],
    ['missing fields', { parentThreadId: 'root' }],
    ['unknown fields', { ...branchMetadata('child', 'root'), extra: true }],
    ['invalid date', { ...branchMetadata('child', 'root'), branchPointCreatedAt: 'not-a-date' }],
    ['invalid state', { ...branchMetadata('child', 'root'), state: 'other' }],
  ])('rejects malformed stored lineage: %s', async (_name, lineage) => {
    const thread = await saveRawThread('child', { [MASTRA_THREAD_BRANCH_METADATA_KEY]: lineage });
    expect(() => parseThreadBranchMetadata(thread)).toThrow(expect.objectContaining({ id: 'BRANCH_LINEAGE_CORRUPT' }));
  });

  it('rejects pending, missing-parent, cycles, cross-resource, and unreachable fork lineage', async () => {
    await seedRoot();
    await saveRawThread('pending', {
      [MASTRA_THREAD_BRANCH_METADATA_KEY]: branchMetadata('pending', 'root', 'root-message', 'pending'),
    });
    await expect(resolveThreadLineage(store, 'pending')).rejects.toMatchObject({ id: 'BRANCH_NOT_FOUND' });

    await saveRawThread('missing', {
      [MASTRA_THREAD_BRANCH_METADATA_KEY]: branchMetadata('missing', 'does-not-exist'),
    });
    await expect(resolveThreadLineage(store, 'missing')).rejects.toMatchObject({ id: 'BRANCH_NOT_FOUND' });

    await saveRawThread('bad-locator', {
      [MASTRA_THREAD_BRANCH_METADATA_KEY]: {
        ...branchMetadata('bad-locator', 'root'),
        observationalMemoryThreadId: 'root',
      },
    });
    await expect(resolveThreadLineage(store, 'bad-locator')).rejects.toMatchObject({ id: 'BRANCH_LINEAGE_CORRUPT' });

    await saveRawThread('cycle-a', {
      [MASTRA_THREAD_BRANCH_METADATA_KEY]: branchMetadata('cycle-a', 'cycle-b'),
    });
    await saveRawThread('cycle-b', {
      [MASTRA_THREAD_BRANCH_METADATA_KEY]: branchMetadata('cycle-b', 'cycle-a'),
    });
    await expect(resolveThreadLineage(store, 'cycle-a')).rejects.toMatchObject({ id: 'BRANCH_LINEAGE_CORRUPT' });

    await store.saveThread({
      thread: {
        id: 'cross-resource',
        resourceId: 'other-resource',
        metadata: { [MASTRA_THREAD_BRANCH_METADATA_KEY]: branchMetadata('cross-resource', 'root') },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
    await expect(resolveThreadLineage(store, 'cross-resource')).rejects.toMatchObject({
      id: 'BRANCH_LINEAGE_CORRUPT',
    });

    await saveRawThread('unreachable', {
      [MASTRA_THREAD_BRANCH_METADATA_KEY]: branchMetadata('unreachable', 'root', 'unknown-message'),
    });
    await expect(resolveThreadLineage(store, 'unreachable')).rejects.toMatchObject({
      id: 'BRANCH_LINEAGE_CORRUPT',
    });
  });

  it('accepts exactly the depth limit and rejects one level beyond it without writes', async () => {
    await seedRoot();
    let parent = 'root';
    for (let depth = 1; depth <= MAX_THREAD_BRANCH_DEPTH + 1; depth += 1) {
      const id = `depth-${depth}`;
      await saveRawThread(id, {
        [MASTRA_THREAD_BRANCH_METADATA_KEY]: branchMetadata(id, parent),
      });
      parent = id;
    }

    await expect(resolveThreadLineage(store, `depth-${MAX_THREAD_BRANCH_DEPTH}`)).resolves.toMatchObject({
      entries: expect.any(Array),
    });
    await expect(resolveThreadLineage(store, `depth-${MAX_THREAD_BRANCH_DEPTH + 1}`)).rejects.toMatchObject({
      id: 'BRANCH_INVALID_REQUEST',
    });
  });

  it('rejects child-owned physical rows at or before the lower fork bound', async () => {
    await seedRoot();
    await saveRawThread('child', {
      [MASTRA_THREAD_BRANCH_METADATA_KEY]: branchMetadata('child', 'root'),
    });
    const invalid: MastraDBMessage = {
      id: 'a-before-root-message',
      threadId: 'child',
      resourceId,
      role: 'assistant',
      content: { format: 2, parts: [{ type: 'text', text: 'invalid' }] },
      createdAt: timestamp,
    };
    await store.saveMessages({ messages: [invalid] });

    await expect(resolveThreadLineage(store, 'child')).rejects.toMatchObject({ id: 'BRANCH_LINEAGE_CORRUPT' });
  });
});
