import { describe, expect, it, beforeEach } from 'vitest';
import type { MastraDBMessage } from '../../../memory/types';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryMemory } from './inmemory';

// This mirrors createMessagesListIncludeResourceScopeTest in @internal/storage-test-utils.
// @mastra/core cannot depend on that package, because it would make the workspace
// dependency graph circular, so the same contract is asserted here by hand.

const makeMessage = ({
  id,
  threadId,
  resourceId,
  text,
  minute,
}: {
  id: string;
  threadId: string;
  resourceId: string;
  text: string;
  minute: number;
}): MastraDBMessage =>
  ({
    id,
    threadId,
    resourceId,
    role: 'user',
    type: 'text',
    createdAt: new Date(Date.UTC(2024, 0, 1, 0, minute)),
    content: { format: 2, parts: [{ type: 'text', text }] },
  }) as MastraDBMessage;

describe('InMemoryMemory listMessages include resource scope', () => {
  let store: InMemoryMemory;

  beforeEach(async () => {
    store = new InMemoryMemory({ db: new InMemoryDB() });
    await store.saveMessages({
      messages: [
        // resource-a owns thread-a1 and thread-a2.
        makeMessage({ id: 'a1', threadId: 'thread-a1', resourceId: 'resource-a', text: 'a first', minute: 0 }),
        makeMessage({ id: 'a2', threadId: 'thread-a1', resourceId: 'resource-a', text: 'a target', minute: 1 }),
        makeMessage({ id: 'a3', threadId: 'thread-a1', resourceId: 'resource-a', text: 'a last', minute: 2 }),
        makeMessage({ id: 'a4', threadId: 'thread-a2', resourceId: 'resource-a', text: 'a other thread', minute: 3 }),
        // resource-b owns thread-b1.
        makeMessage({ id: 'b1', threadId: 'thread-b1', resourceId: 'resource-b', text: 'b message', minute: 4 }),
      ],
    });
  });

  it('does not return messages owned by another resource', async () => {
    const result = await store.listMessages({
      threadId: 'thread-b1',
      resourceId: 'resource-b',
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['b1']);
  });

  it('still returns a cross-thread include from the same resource', async () => {
    const result = await store.listMessages({
      threadId: 'thread-a2',
      resourceId: 'resource-a',
      include: [{ id: 'a2', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('does not return another resource on the semantic recall fast path', async () => {
    const result = await store.listMessages({
      threadId: 'thread-b1',
      resourceId: 'resource-b',
      perPage: 0,
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages).toEqual([]);
  });

  it('keeps cross-resource includes when no resourceId is given', async () => {
    const result = await store.listMessages({
      threadId: 'thread-b1',
      include: [{ id: 'a2', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('reads the context window from the thread that owns the target message', async () => {
    // The include entry names a thread that the target message does not belong to.
    // The window must still come from the target message's own thread.
    const result = await store.listMessages({
      threadId: 'thread-a2',
      resourceId: 'resource-a',
      include: [{ id: 'a2', threadId: 'thread-b1', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('does not return messages owned by another resource from listMessagesByResourceId', async () => {
    const result = await store.listMessagesByResourceId({
      resourceId: 'resource-b',
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['b1']);
  });

  it('does not return another resource from listMessagesByResourceId on the fast path', async () => {
    const result = await store.listMessagesByResourceId({
      resourceId: 'resource-b',
      perPage: 0,
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages).toEqual([]);
  });

  it('returns the include context window from listMessagesByResourceId', async () => {
    const result = await store.listMessagesByResourceId({
      resourceId: 'resource-a',
      perPage: 0,
      include: [{ id: 'a2', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('treats an empty resourceId in listMessagesByResourceId as a real scope', async () => {
    // The main query of listMessagesByResourceId compares the resourceId exactly, so an
    // empty string selects nothing. The include lookup must not be looser than that.
    const result = await store.listMessagesByResourceId({
      resourceId: '',
      include: [{ id: 'a2', withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages).toEqual([]);
  });

  it('keeps an empty resourceId in listMessages unscoped, like its main query', async () => {
    const result = await store.listMessages({
      threadId: 'thread-b1',
      resourceId: '',
      include: [{ id: 'a2', withPreviousMessages: 1, withNextMessages: 1 }],
    });

    expect(result.messages.map(message => message.id)).toEqual(['a1', 'a2', 'a3', 'b1']);
  });
});

describe('InMemoryMemory observation archives', () => {
  const retiredObservations = 'alpha-body\n\nbeta-body';
  const retiredGroups = [
    {
      groupId: 'group-alpha',
      summary: 'Alpha summary',
      searchText: 'alpha summary alpha-body',
      messageRange: 'message-1:message-2',
      sourceThreadId: 'thread-alpha',
      observedAt: { from: new Date('2026-01-01T00:00:00.000Z'), to: new Date('2026-01-02T00:00:00.000Z') },
      tokenCount: 4,
      textStart: 0,
      textEnd: 10,
    },
    {
      groupId: 'group-beta',
      summary: 'Beta summary',
      searchText: 'beta summary beta-body',
      messageRange: 'message-3:message-4',
      sourceThreadId: 'thread-beta',
      observedAt: { from: new Date('2026-02-01T00:00:00.000Z'), to: new Date('2026-02-02T00:00:00.000Z') },
      tokenCount: 4,
      textStart: 12,
      textEnd: 21,
    },
  ];

  it('atomically seals the retired generation, preserves mutable state, and fences stale writes', async () => {
    const memory = new InMemoryMemory({ db: new InMemoryDB() });
    const current = await memory.initializeObservationalMemory({
      threadId: null,
      resourceId: 'resource-archive',
      scope: 'resource',
      config: { observationThreshold: 100 },
    });
    await memory.updateActiveObservations({
      id: current.id,
      expectedWriteEpoch: 0,
      observations: `${retiredObservations}\n\nretained-body`,
      observationGroups: retiredGroups,
      tokenCount: 12,
      totalTokensObserved: 20,
      lastObservedAt: new Date('2026-02-03T00:00:00.000Z'),
      observedMessageIds: ['message-4'],
    });
    await memory.updateBufferedObservations({
      id: current.id,
      expectedWriteEpoch: 0,
      chunk: {
        cycleId: 'cycle-pending',
        observations: 'pending-body',
        tokenCount: 3,
        messageIds: ['message-5'],
        messageTokens: 6,
        lastObservedAt: new Date('2026-02-04T00:00:00.000Z'),
      },
    });
    await memory.setPendingMessageTokens(current.id, 6, 0);

    const transition = {
      currentRecordId: current.id,
      expectedGenerationCount: 0,
      expectedWriteEpoch: 0,
      archiveId: 'archive-one',
      archivedAt: new Date('2026-03-01T00:00:00.000Z'),
      contentDigest: 'digest-one',
      retiredObservations,
      retiredObservationTokenCount: 8,
      retiredGroups,
      retainedObservations: 'retained-body',
      retainedObservationTokenCount: 4,
      retainedGroups: [],
    };
    const successor = await memory.createObservationArchiveGeneration(transition);

    expect(successor).toMatchObject({
      originType: 'archive',
      recordState: 'active',
      writeEpoch: 0,
      generationCount: 1,
      activeObservations: 'retained-body',
      observationTokenCount: 4,
      pendingMessageTokens: 6,
      observedMessageIds: ['message-4'],
    });
    expect(successor.bufferedObservationChunks?.[0]?.cycleId).toBe('cycle-pending');
    expect((await memory.getObservationalMemory(null, 'resource-archive'))?.id).toBe(successor.id);

    const history = await memory.getObservationalMemoryHistory(null, 'resource-archive');
    expect(history[1]).toMatchObject({
      id: current.id,
      recordState: 'sealed',
      activeObservations: retiredObservations,
      observationTokenCount: 8,
      archive: { archiveId: 'archive-one', successorRecordId: successor.id },
    });
    await expect(
      memory.updateActiveObservations({
        id: current.id,
        expectedWriteEpoch: 0,
        observations: 'stale',
        tokenCount: 1,
        totalTokensObserved: 1,
      }),
    ).rejects.toThrow('is sealed');

    await expect(memory.createObservationArchiveGeneration(transition)).resolves.toMatchObject({ id: successor.id });
    await expect(
      memory.createObservationArchiveGeneration({ ...transition, contentDigest: 'different-digest' }),
    ).rejects.toThrow('different transition');
  });

  it('lists and resolves only groups visible to the requested scope and filters', async () => {
    const memory = new InMemoryMemory({ db: new InMemoryDB() });
    const current = await memory.initializeObservationalMemory({
      threadId: null,
      resourceId: 'resource-query',
      scope: 'resource',
      config: {},
    });
    await memory.createObservationArchiveGeneration({
      currentRecordId: current.id,
      expectedGenerationCount: 0,
      expectedWriteEpoch: 0,
      archiveId: 'archive-query',
      archivedAt: new Date('2026-03-01T00:00:00.000Z'),
      contentDigest: 'query-digest',
      retiredObservations,
      retiredObservationTokenCount: 8,
      retiredGroups,
      retainedObservations: '',
      retainedObservationTokenCount: 0,
      retainedGroups: [],
    });

    const alphaPage = await memory.listObservationArchives({
      scope: 'thread',
      threadId: 'thread-alpha',
      resourceId: 'resource-query',
      text: 'ALPHA',
      from: new Date('2026-01-01T12:00:00.000Z'),
      limit: 1,
    });
    expect(alphaPage.archives).toHaveLength(1);
    expect(alphaPage.archives[0]?.groups.map(group => group.groupId)).toEqual(['group-alpha']);

    const alpha = await memory.getObservationArchive({
      scope: 'thread',
      threadId: 'thread-alpha',
      resourceId: 'resource-query',
      archiveId: 'archive-query',
      groupId: 'group-alpha',
    });
    expect(alpha?.observations).toBe('alpha-body');
    expect(
      await memory.getObservationArchive({
        scope: 'thread',
        threadId: 'thread-alpha',
        resourceId: 'resource-query',
        archiveId: 'archive-query',
        groupId: 'group-beta',
      }),
    ).toBeNull();
    expect(
      await memory.getObservationArchive({
        scope: 'resource',
        resourceId: 'another-resource',
        archiveId: 'archive-query',
      }),
    ).toBeNull();

    const matches = await memory.getObservationArchivesByGroupIds({
      scope: 'resource',
      resourceId: 'resource-query',
      groupIds: ['group-beta', 'missing'],
    });
    expect(matches.matches[0]?.groupIds).toEqual(['group-beta']);
    await expect(
      memory.getObservationArchivesByGroupIds({
        scope: 'resource',
        resourceId: 'resource-query',
        groupIds: Array.from({ length: 21 }, (_, index) => `group-${index}`),
      }),
    ).rejects.toThrow('at most 20');
  });

  it('clears buffered reflection state while advancing the write epoch', async () => {
    const memory = new InMemoryMemory({ db: new InMemoryDB() });
    const record = await memory.initializeObservationalMemory({
      threadId: 'thread-cleanup',
      resourceId: 'resource-cleanup',
      scope: 'thread',
      config: {},
    });
    await memory.updateBufferedReflection({
      id: record.id,
      expectedWriteEpoch: 0,
      reflection: 'buffered reflection',
      tokenCount: 5,
      inputTokenCount: 10,
      reflectedObservationLineCount: 1,
    });
    await memory.setBufferingReflectionFlag(record.id, true, 0);

    const cleaned = await memory.clearBufferedReflection({ id: record.id, expectedWriteEpoch: 0 });
    expect(cleaned).toMatchObject({ writeEpoch: 1, isReflecting: false, isBufferingReflection: false });
    expect(cleaned.bufferedReflection).toBeUndefined();
    await expect(memory.setReflectingFlag(record.id, true, 0)).rejects.toThrow('write epoch mismatch');
    await expect(memory.setReflectingFlag(record.id, true, 1)).resolves.toBeUndefined();
  });
});

describe('InMemoryMemory updateThread partial updates', () => {
  it('leaves the stored title alone when only metadata is provided', async () => {
    const memory = new InMemoryMemory({ db: new InMemoryDB() });
    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Generated title',
        metadata: { a: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const updated = await memory.updateThread({ id: 'thread-1', metadata: { b: 2 } });

    expect(updated.title).toBe('Generated title');
    expect(updated.metadata).toEqual({ a: 1, b: 2 });
  });
});
