import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';

import { defineBehavior } from '../definition/normalize.js';
import { InMemoryBehaviorRuntimeStore } from './in-memory-store.js';
import { LibSQLBehaviorRuntimeStore } from './libsql-store.js';
import { BehaviorStateProcessor } from './state-processor.js';
import { BehaviorTransitionEngine } from './transition-engine.js';

const definition = defineBehavior({
  id: 'debug',
  version: '2',
  initialState: 'understand',
  states: [
    {
      id: 'understand',
      instructions: 'Actor instructions',
      judgeInstructions: 'Secret judge instructions',
      transitions: [
        { id: 'test', target: 'test', guards: [{ id: 'ready' }], judge: true },
        { id: 'exit', target: 'exit', exit: true },
      ],
    },
    { id: 'test', transitions: [{ id: 'exit', target: 'exit', exit: true }] },
  ],
  migrations: { investigate: 'understand' },
});

describe.each([
  ['memory', () => new InMemoryBehaviorRuntimeStore()],
  ['libsql', () => new LibSQLBehaviorRuntimeStore(createClient({ url: `file:${path.join(os.tmpdir(), `behavior-${crypto.randomUUID()}.db`)}` }))],
])('%s behavior runtime store', (_name, createStore) => {
  it('serializes concurrent transactions and enumerates due work', async () => {
    const store = createStore();
    await store.init();
    const key = { threadId: 'thread', behaviorId: 'debug' };
    const base = {
      threadId: 'thread', behaviorId: 'debug', definitionVersion: '1', revision: 0, status: 'active' as const,
      activeState: 'understand', enteredAt: '2026-01-01T00:00:00.000Z', transitionHistory: [], conditionState: {},
      checkpoints: {}, judgeResults: {}, audit: {}, nextCheckAt: '2026-01-02T00:00:00.000Z',
    };
    await store.transactThread(key, () => ({ next: base, result: undefined }));
    await Promise.all([
      store.transactThread(key, current => ({ next: { ...current!, revision: current!.revision + 1 }, result: undefined })),
      store.transactThread(key, current => ({ next: { ...current!, revision: current!.revision + 1 }, result: undefined })),
    ]);
    expect((await store.readThread(key))?.revision).toBe(2);
    expect(await store.listDue(new Date('2026-01-03T00:00:00.000Z'))).toHaveLength(1);
  });
});

it('serializes LibSQL transactions across store instances', async () => {
  const url = `file:${path.join(os.tmpdir(), `behavior-shared-${crypto.randomUUID()}.db`)}`;
  const firstClient = createClient({ url });
  const secondClient = createClient({ url });
  const first = new LibSQLBehaviorRuntimeStore(firstClient);
  const second = new LibSQLBehaviorRuntimeStore(secondClient);
  await first.init();
  const key = { threadId: 'thread', behaviorId: 'shared' };
  const initial = {
    threadId: 'thread', behaviorId: 'shared', definitionVersion: '1', revision: 0, status: 'active' as const,
    activeState: 'state', enteredAt: '', transitionHistory: [], conditionState: {}, checkpoints: {}, judgeResults: {}, audit: {},
  };
  await first.transactThread(key, () => ({ next: initial, result: undefined }));
  await Promise.all([
    first.transactThread(key, async current => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return { next: { ...current!, revision: current!.revision + 1 }, result: undefined };
    }),
    second.transactThread(key, current => ({ next: { ...current!, revision: current!.revision + 1 }, result: undefined })),
  ]);
  expect((await first.readThread(key))?.revision).toBe(2);
  firstClient.close();
  secondClient.close();
});

describe('BehaviorTransitionEngine', () => {
  it('runs guards before judges, commits atomically, and mirrors committed state', async () => {
    const order: string[] = [];
    const mirror = { setState: vi.fn() };
    const store = new InMemoryBehaviorRuntimeStore();
    const engine = new BehaviorTransitionEngine({
      definition,
      store,
      mirror,
      guards: { ready: () => { order.push('guard'); return true; } },
      judge: async input => { order.push('judge'); expect(input.judgeInstructions).toBe('Secret judge instructions'); return { approved: true }; },
    });
    await engine.initialize('thread');
    const result = await engine.transition({ threadId: 'thread', transitionId: 'test', attemptId: 'attempt' });
    expect(order).toEqual(['guard', 'judge']);
    expect(result).toMatchObject({ activeState: 'test', revision: 2 });
    expect(mirror.setState).toHaveBeenLastCalledWith(expect.objectContaining({ type: '@mastra/behaviors:debug' }));
  });

  it('rejects stale judge results after a concurrent transition', async () => {
    const store = new InMemoryBehaviorRuntimeStore();
    let release!: () => void;
    const pending = new Promise<void>(resolve => (release = resolve));
    const engine = new BehaviorTransitionEngine({
      definition,
      store,
      guards: { ready: () => true },
      judge: async () => { await pending; return { approved: true }; },
    });
    await engine.initialize('thread');
    const judged = engine.transition({ threadId: 'thread', transitionId: 'test', attemptId: 'judged' });
    await Promise.resolve();
    await engine.transition({ threadId: 'thread', transitionId: 'exit', attemptId: 'exit' });
    release();
    await expect(judged).rejects.toThrow('Stale transition result');
  });

  it('fails closed before judging when a guard rejects', async () => {
    const judge = vi.fn();
    const engine = new BehaviorTransitionEngine({ definition, store: new InMemoryBehaviorRuntimeStore(), guards: { ready: () => false }, judge });
    await engine.initialize('thread');
    await expect(engine.transition({ threadId: 'thread', transitionId: 'test', attemptId: 'bad' })).rejects.toThrow('Guard');
    expect(judge).not.toHaveBeenCalled();
  });

  it('migrates mapped states and pauses removed states', async () => {
    const store = new InMemoryBehaviorRuntimeStore();
    const old = { threadId: 'thread', behaviorId: 'debug', definitionVersion: '1', revision: 1, status: 'active' as const, activeState: 'investigate', enteredAt: '', transitionHistory: [], conditionState: {}, checkpoints: {}, judgeResults: {}, audit: {} };
    await store.transactThread({ threadId: 'thread', behaviorId: 'debug' }, () => ({ next: old, result: undefined }));
    const engine = new BehaviorTransitionEngine({ definition, store });
    expect((await engine.initialize('thread')).activeState).toBe('understand');

    await store.transactThread({ threadId: 'other', behaviorId: 'debug' }, () => ({ next: { ...old, threadId: 'other', activeState: 'removed' }, result: undefined }));
    expect(await engine.initialize('other')).toMatchObject({ status: 'paused', pausedReason: expect.stringContaining('removed') });
  });
});

describe('BehaviorStateProcessor', () => {
  it('re-snapshots after compaction and never projects judge instructions', async () => {
    const store = new InMemoryBehaviorRuntimeStore();
    const engine = new BehaviorTransitionEngine({ definition, store });
    await engine.initialize('thread');
    const processor = new BehaviorStateProcessor(definition, store);
    const args = { threadId: 'thread', contextWindow: { hasSnapshot: false }, lastSnapshot: undefined } as any;
    const signal = await processor.computeStateSignal(args);
    expect(signal?.contents).toContain('Actor instructions');
    expect(signal?.contents).not.toContain('Secret judge instructions');
    expect(await processor.computeStateSignal({ ...args, contextWindow: { hasSnapshot: true }, lastSnapshot: { metadata: { state: { cacheKey: signal?.cacheKey }, record: { revision: 1, status: 'active' } } } } as any)).toBeUndefined();
  });
});
