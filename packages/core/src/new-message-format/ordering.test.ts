import { describe, expect, it } from 'vitest';
import { InMemoryDB } from '../storage/domains/inmemory-db';
import { InMemoryMemory } from '../storage/domains/memory/inmemory';
import { scriptedModel, textTurn } from './model.mock';
import { runAgent } from './run';
import { InMemoryActionStorage, createActionIdGenerator } from './storage';
import type { PersistableAction } from './types';
import { createUlid } from './ulid';

const HOUR = 60 * 60 * 1000;

describe('createUlid({ after })', () => {
  it('mints above the seed even when the clock is behind it', () => {
    const seed = createUlid()(Date.now() + HOUR);
    const next = createUlid({ after: seed });
    const ids = [next(), next(), next(Date.now() - HOUR)];
    expect(ids.every(id => id > seed)).toBe(true);
    expect(ids).toEqual([...ids].sort());
  });

  it('moves to the clock once it passes the seed', () => {
    const seed = createUlid()(1_700_000_000_000);
    const id = createUlid({ after: seed })(1_800_000_000_000);
    expect(id > seed).toBe(true);
    expect(id.slice(0, 10)).toBe(createUlid()(1_800_000_000_000).slice(0, 10));
  });

  it('rejects a seed that is not a ULID', () => {
    expect(() => createUlid({ after: 'not-a-ulid' })).toThrow(/not a ULID/);
  });
});

describe.each([
  ['InMemoryActionStorage', () => new InMemoryActionStorage()],
  ['InMemoryMemory', () => new InMemoryMemory({ db: new InMemoryDB() })],
])('getLatestActionId on %s', (_name, create) => {
  it('returns the greatest id of the thread, or null', async () => {
    const store = create();
    expect(await store.getLatestActionId('t1')).toBeNull();
    const id = createUlid();
    const [a, b, c] = [id(), id(), id()];
    const text = (actionId: string, threadId: string): PersistableAction => ({
      id: actionId,
      threadId,
      createdAt: new Date(),
      type: 'text',
      role: 'user',
      text: actionId,
    });
    await store.saveActions({ actions: [text(b!, 't1'), text(a!, 't1'), text(c!, 't2')] });
    expect(await store.getLatestActionId('t1')).toBe(b);
    expect(await store.getLatestActionId('t2')).toBe(c);
  });
});

describe('runAgent ordering', () => {
  it('writes after the last stored id when this host clock is behind the writer of that id', async () => {
    const memory = new InMemoryActionStorage();
    // A row written by a host whose clock is an hour ahead of ours.
    const ahead = createUlid()(Date.now() + HOUR);
    await memory.saveActions({
      actions: [{ id: ahead, threadId: 't1', createdAt: new Date(), type: 'text', role: 'user', text: 'earlier turn' }],
    });

    const { model } = scriptedModel([textTurn('hello')]);
    for await (const _ of runAgent({ model, threadId: 't1', memory, input: 'next turn' })) void _;

    const stored = await memory.listActions({ threadId: 't1' });
    const texts = stored.flatMap(a => (a.type === 'text' ? [a.text] : []));
    // Log order is conversation order: the earlier turn stays first, and a cursor at it still sees the new run.
    expect(texts).toEqual(['earlier turn', 'next turn', 'hello']);
    expect(stored.slice(1).every(a => a.id > ahead)).toBe(true);
    expect(await memory.listActions({ threadId: 't1', after: ahead })).toHaveLength(stored.length - 1);
  });

  it('seeds from the thread through the shared helper', async () => {
    const memory = new InMemoryActionStorage();
    const fresh = await createActionIdGenerator(memory, 't1');
    const ahead = createUlid()(Date.now() + HOUR);
    await memory.saveActions({
      actions: [{ id: ahead, threadId: 't1', createdAt: new Date(), type: 'text', role: 'user', text: 'x' }],
    });
    expect(fresh() < ahead).toBe(true);
    expect((await createActionIdGenerator(memory, 't1'))() > ahead).toBe(true);
    expect((await createActionIdGenerator(undefined, 't1'))() < ahead).toBe(true);
  });
});
