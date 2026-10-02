import { describe, expect, it } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryMemory } from './inmemory';

describe('observation history filters', () => {
  it('finds buffered original groups on retained generations without activating them', async () => {
    const store = new InMemoryMemory({ db: new InMemoryDB() });
    const first = await store.initializeObservationalMemory({
      threadId: 'thread',
      resourceId: 'resource',
      scope: 'thread',
    });
    const groupId = 'buffered_%.$group';
    await store.updateBufferedObservations({
      id: first.id,
      chunk: {
        cycleId: 'cycle',
        observations: `<observation-group id="${groupId}" range="a:b">original</observation-group>`,
        tokenCount: 1,
        messageIds: ['a', 'b'],
        messageTokens: 10,
        lastObservedAt: new Date(),
      },
    });
    await store.createReflectionGeneration({ currentRecord: first, reflection: 'newer generation', tokenCount: 1 });
    const before = structuredClone(await store.getObservationalMemoryHistory('thread', 'resource'));
    const found = await store.getObservationalMemoryHistory('thread', 'resource', 1, { groupId, sortDirection: 'ASC' });
    expect(found.map(r => r.id)).toEqual([first.id]);
    expect(
      await store.getObservationalMemoryHistory('thread', 'resource', 1, { groupId: groupId.toUpperCase() }),
    ).toEqual([]);
    expect(await store.getObservationalMemoryHistory('thread', 'resource')).toEqual(before);
  });
  it('skips buffered chunks that are not stored as an array', async () => {
    const db = new InMemoryDB();
    const store = new InMemoryMemory({ db });
    const record = await store.initializeObservationalMemory({
      threadId: 'thread',
      resourceId: 'resource',
      scope: 'thread',
      config: {},
    });
    for (const records of db.observationalMemory.values()) {
      for (const stored of records) stored.bufferedObservationChunks = {} as never;
    }
    expect(await store.getObservationalMemoryHistory('thread', 'resource', 1, { groupId: 'missing' })).toEqual([]);
    expect((await store.getObservationalMemoryHistory('thread', 'resource')).map(r => r.id)).toEqual([record.id]);
  });
  it('matches literal group tags and filters before ordering, offset, and limit', async () => {
    const store = new InMemoryMemory({ db: new InMemoryDB() });
    const first = await store.initializeObservationalMemory({
      threadId: 'thread',
      resourceId: 'resource',
      scope: 'thread',
    });
    const groupId = 'literal_%.$group';
    const group = `<observation-group id="${groupId}" range="a:b">original</observation-group>`;
    const second = await store.createReflectionGeneration({ currentRecord: first, reflection: group, tokenCount: 1 });
    const third = await store.createReflectionGeneration({ currentRecord: second, reflection: group, tokenCount: 1 });
    await store.createReflectionGeneration({ currentRecord: third, reflection: `mentions ${groupId}`, tokenCount: 1 });
    expect(
      (await store.getObservationalMemoryHistory('thread', 'resource', 1, { groupId, sortDirection: 'ASC' })).map(
        r => r.id,
      ),
    ).toEqual([second.id]);
    expect(
      (
        await store.getObservationalMemoryHistory('thread', 'resource', 1, { groupId, sortDirection: 'ASC', offset: 1 })
      ).map(r => r.id),
    ).toEqual([third.id]);
    expect(
      (
        await store.getObservationalMemoryHistory('thread', 'resource', 1, { afterGeneration: 0, beforeGeneration: 2 })
      ).map(r => r.id),
    ).toEqual([second.id]);
    expect((await store.getObservationalMemoryHistory('thread', 'resource', 1, { groupId })).map(r => r.id)).toEqual([
      third.id,
    ]);
    expect(await store.getObservationalMemoryHistory('thread', 'resource', 1, { groupId, to: new Date(0) })).toEqual(
      [],
    );
    expect(await store.getObservationalMemoryHistory('other', 'resource', 1, { groupId })).toEqual([]);
    // ASC queries must not mutate the stored default ordering.
    expect((await store.getObservationalMemoryHistory('thread', 'resource')).map(r => r.generationCount)).toEqual([
      3, 2, 1, 0,
    ]);
  });
});
