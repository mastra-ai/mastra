import type { ComputeStateSignalArgs } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { applyPinOps, createPinnedTools, PinnedStateProcessor, stablePinsCacheKey } from '../subconscious';
import type { PinDeltaOp, PinEntry } from '../subconscious';

const threadScope = ['org:acme', 'resource:user-42', 'thread:alpha'];

function createHarness() {
  const storage = new InMemoryStore();
  const memory = { storage } as unknown as Parameters<typeof createPinnedTools>[0];
  const tools = createPinnedTools(memory, {
    scope: threadScope,
    sourceThreadId: 'alpha',
    defaultScope: 'resource',
    maxPins: 20,
    maxCharacters: 2_000,
  });
  const processor = new PinnedStateProcessor({
    getKnowledgeStore: async () => (storage as any).getStore('knowledge'),
  });
  return { tools, processor };
}

function makeArgs(overrides: Partial<ComputeStateSignalArgs> = {}): ComputeStateSignalArgs {
  const context = new Map<string, unknown>([['organizationId', 'acme']]);
  return {
    threadId: 'alpha',
    resourceId: 'user-42',
    requestContext: {
      get: (key: string) => context.get(key),
      set: (key: string, value: unknown) => void context.set(key, value),
    },
    contextWindow: { hasSnapshot: false },
    lastSnapshot: undefined,
    deltasSinceSnapshot: [],
    tracking: undefined,
    ...overrides,
  } as unknown as ComputeStateSignalArgs;
}

function snapshotSignal(pins: PinEntry[]) {
  return {
    metadata: { state: { mode: 'snapshot' }, value: { pins } },
    contents: '',
  } as any;
}

function deltaSignal(ops: PinDeltaOp[], pins: PinEntry[]) {
  return {
    metadata: { state: { mode: 'delta' }, value: { pins }, delta: { ops } },
    contents: '',
  } as any;
}

describe('PinnedStateProcessor', () => {
  it('re-reads the store on a new turn even when the request context is reused', async () => {
    const { tools, processor } = createHarness();
    // Same request context across both turns, as real callers do.
    const args = makeArgs();

    // Turn 1, step 0: no pins yet, nothing emitted, but the empty read is memoized.
    expect(await processor.computeStateSignal(args)).toBeUndefined();

    // A pin lands between turns.
    const pinned = await tools.knowledge_pin!.execute!({ text: 'fresh pin' } as any, {} as any);

    // Turn 2, step 0 with the SAME request context: must read fresh, not serve the stale empty memo.
    const result = await processor.computeStateSignal({ ...args, stepNumber: 0 } as any);
    expect(result).toMatchObject({ mode: 'snapshot' });
    expect(result!.contents).toContain(pinned.id);
  });

  it('serves the memoized read for later steps of the same turn and same scope', async () => {
    const { tools, processor } = createHarness();
    await tools.knowledge_pin!.execute!({ text: 'memo pin' } as any, {} as any);
    const args = makeArgs({ stepNumber: 0 } as any);

    const first = await processor.computeStateSignal(args);
    expect(first).toMatchObject({ mode: 'snapshot' });

    // A pin lands mid-turn; step 1 must still see the step-0 read (one store read per turn).
    await tools.knowledge_pin!.execute!({ text: 'mid-turn pin' } as any, {} as any);
    const midTurn = await processor.computeStateSignal({
      ...args,
      stepNumber: 1,
      contextWindow: { hasSnapshot: true },
      lastSnapshot: snapshotSignal((first as any).value.pins),
    } as any);
    expect(midTurn).toBeUndefined();

    // A different scope on the same request context must not reuse the memo.
    const otherContext = makeArgs({ stepNumber: 1, threadId: 'beta' } as any);
    (otherContext as any).requestContext = (args as any).requestContext;
    const otherScope = await processor.computeStateSignal(otherContext);
    expect(otherScope).toMatchObject({ mode: 'snapshot' });
    expect(otherScope!.contents).toContain('mid-turn pin');
  });

  it('emits a snapshot on first emission when no snapshot is in the window', async () => {
    const { tools, processor } = createHarness();
    const pinned = await tools.knowledge_pin!.execute!({ text: 'Always speak French.' } as any, {} as any);
    const result = await processor.computeStateSignal(makeArgs());
    expect(result).toMatchObject({ mode: 'snapshot', tagName: 'pinned-knowledge' });
    expect(result!.contents).toContain(pinned.id);
    expect(result!.contents).toContain('Always speak French.');
  });

  it('emits a delta carrying only the change when a snapshot is in the window', async () => {
    const { tools, processor } = createHarness();
    const first = await tools.knowledge_pin!.execute!({ text: 'first pin' } as any, {} as any);
    const second = await tools.knowledge_pin!.execute!({ text: 'second pin' } as any, {} as any);
    const result = await processor.computeStateSignal(
      makeArgs({
        contextWindow: { hasSnapshot: true } as any,
        lastSnapshot: snapshotSignal([{ id: first.id, text: 'first pin' }]),
      }),
    );
    expect(result).toMatchObject({ mode: 'delta', tagName: 'pinned-knowledge-update' });
    const ops = (result as any).delta.ops as PinDeltaOp[];
    expect(ops).toEqual([{ op: 'add', pin: { id: second.id, text: 'second pin' } }]);
    expect(result!.contents).not.toContain('first pin');
  });

  it('emits nothing when nothing changed and the snapshot is still in the window', async () => {
    const { tools, processor } = createHarness();
    const pinned = await tools.knowledge_pin!.execute!({ text: 'stable pin' } as any, {} as any);
    const result = await processor.computeStateSignal(
      makeArgs({
        contextWindow: { hasSnapshot: true } as any,
        lastSnapshot: snapshotSignal([{ id: pinned.id, text: 'stable pin' }]),
      }),
    );
    expect(result).toBeUndefined();
  });

  it('re-emits a fresh snapshot, not an orphan delta, when the snapshot was evicted', async () => {
    const { tools, processor } = createHarness();
    const pinned = await tools.knowledge_pin!.execute!({ text: 'survivor pin' } as any, {} as any);
    // Deterministic eviction: lastSnapshot is populated but no longer visible.
    const result = await processor.computeStateSignal(
      makeArgs({
        contextWindow: { hasSnapshot: false } as any,
        lastSnapshot: snapshotSignal([{ id: pinned.id, text: 'survivor pin' }]),
      }),
    );
    expect(result).toMatchObject({ mode: 'snapshot' });
    expect(result!.contents).toContain('survivor pin');
  });

  it('clears the lane with an empty snapshot when the last pin is unpinned and a base is present', async () => {
    const { tools, processor } = createHarness();
    const pinned = await tools.knowledge_pin!.execute!({ text: 'doomed pin' } as any, {} as any);
    await tools.knowledge_unpin!.execute!({ factId: pinned.id } as any, {} as any);
    const result = await processor.computeStateSignal(
      makeArgs({
        contextWindow: { hasSnapshot: true } as any,
        lastSnapshot: snapshotSignal([{ id: pinned.id, text: 'doomed pin' }]),
      }),
    );
    expect(result).toMatchObject({ mode: 'snapshot', contents: '', attributes: { count: 0 } });
  });

  it('emits nothing for an empty set when there is no base in the window', async () => {
    const { tools, processor } = createHarness();
    const pinned = await tools.knowledge_pin!.execute!({ text: 'gone pin' } as any, {} as any);
    await tools.knowledge_unpin!.execute!({ factId: pinned.id } as any, {} as any);
    const result = await processor.computeStateSignal(
      makeArgs({
        contextWindow: { hasSnapshot: false } as any,
        lastSnapshot: snapshotSignal([{ id: pinned.id, text: 'gone pin' }]),
      }),
    );
    expect(result).toBeUndefined();
  });

  it('folds the same fact id added in one delta and removed in a later one order-stably', () => {
    const base: PinEntry[] = [];
    const afterAdd = applyPinOps(base, [{ op: 'add', pin: { id: 'f1', text: 'ephemeral' } }]);
    const afterRemove = applyPinOps(afterAdd, [{ op: 'remove', id: 'f1' }]);
    expect(afterAdd).toHaveLength(1);
    expect(afterRemove).toHaveLength(0);
  });

  it('reconstructs the effective prior across snapshot plus deltas so an unchanged turn emits nothing', async () => {
    const { tools, processor } = createHarness();
    const first = await tools.knowledge_pin!.execute!({ text: 'base pin' } as any, {} as any);
    const second = await tools.knowledge_pin!.execute!({ text: 'delta pin' } as any, {} as any);
    const result = await processor.computeStateSignal(
      makeArgs({
        contextWindow: { hasSnapshot: true } as any,
        lastSnapshot: snapshotSignal([{ id: first.id, text: 'base pin' }]),
        deltasSinceSnapshot: [deltaSignal([{ op: 'add', pin: { id: second.id, text: 'delta pin' } }], [])],
      }),
    );
    expect(result).toBeUndefined();
  });

  it('cache keys for different pin sets cannot collide across field boundaries', () => {
    const a = stablePinsCacheKey([{ id: 'a', text: 'b|c' }]);
    const b = stablePinsCacheKey([
      { id: 'a', text: 'b' },
      { id: 'c', text: '' },
    ]);
    expect(a).not.toBe(b);
    const c = stablePinsCacheKey([{ id: 'a:1', text: 'x' }]);
    const d = stablePinsCacheKey([{ id: 'a', text: '1:x' }]);
    expect(c).not.toBe(d);
  });
});
