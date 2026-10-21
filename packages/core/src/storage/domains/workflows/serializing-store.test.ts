import { describe, expect, it } from 'vitest';
import { createEmptyWorkflowSnapshot } from '../../workflow-snapshot';
import { createSerializingStore } from './serializing-store.test-utils';

const target = { workflowName: 'serializing-workflow', runId: 'run-1' };

describe('serializing workflow storage', () => {
  it('reads persisted JSON rather than rich runtime values (COR-1387)', async () => {
    const { store } = createSerializingStore();
    const workflows = (await store.getStore('workflows'))!;
    const snapshot = createEmptyWorkflowSnapshot(target.runId);
    const shared = { marker: 'shared' };
    snapshot.context.input = {
      date: new Date(0),
      error: new Error('not enumerable'),
      optional: undefined,
      callback: () => 'live',
      left: shared,
      right: shared,
    };
    await workflows.persistWorkflowSnapshot({ ...target, snapshot });
    const loaded = await workflows.loadWorkflowSnapshot(target);
    expect(loaded?.context.input).toEqual({
      date: '1970-01-01T00:00:00.000Z',
      error: {},
      left: shared,
      right: shared,
    });
    expect(loaded?.context.input.left).not.toBe(loaded?.context.input.right);
  });

  it('uses safeStringify semantics for cycles and bigint without collapsing shared references', async () => {
    const { store, inspect } = createSerializingStore();
    const workflows = (await store.getStore('workflows'))!;
    const snapshot = createEmptyWorkflowSnapshot(target.runId);
    const cycle: { self?: unknown; count: bigint } = { count: 42n };
    cycle.self = cycle;
    snapshot.context.input = cycle;
    await workflows.persistWorkflowSnapshot({ ...target, snapshot });
    expect((await workflows.loadWorkflowSnapshot(target))?.context.input).toEqual({
      count: '42',
      self: '[Circular]',
    });
    expect(JSON.parse(inspect()[0]!.snapshot).context.input).toEqual({ count: '42', self: '[Circular]' });
  });

  it('detaches full writes and every read path from stored rows', async () => {
    const { store, inspect } = createSerializingStore();
    const workflows = (await store.getStore('workflows'))!;
    const snapshot = createEmptyWorkflowSnapshot(target.runId);
    snapshot.context.input = { message: 'original' };
    await workflows.persistWorkflowSnapshot({ ...target, snapshot });
    const committed = inspect();
    snapshot.context.input.message = 'mutated input';
    const loaded = (await workflows.loadWorkflowSnapshot(target))!;
    loaded.context.input.message = 'mutated load';
    const byId = (await workflows.getWorkflowRunById({ runId: target.runId }))!;
    expect(byId.snapshot).toMatchObject({ context: { input: { message: 'original' } } });
    if (typeof byId.snapshot === 'string') throw new Error('Expected parsed snapshot');
    byId.snapshot.context.input.message = 'mutated lookup';
    const listed = await workflows.listWorkflowRuns({ workflowName: target.workflowName });
    expect(listed.runs[0]?.snapshot).toMatchObject({ context: { input: { message: 'original' } } });
    const listedSnapshot = listed.runs[0]!.snapshot;
    if (typeof listedSnapshot === 'string') throw new Error('Expected parsed snapshot');
    listedSnapshot.context.input.message = 'mutated list';
    committed[0]!.snapshot = 'mutated inspection';
    expect((await workflows.loadWorkflowSnapshot(target))?.context.input.message).toBe('original');
    expect(inspect()[0]!.snapshot).not.toBe('mutated inspection');
  });

  it('serializes partial results, state and request context before returning them', async () => {
    const { store, inspect } = createSerializingStore();
    const workflows = (await store.getStore('workflows'))!;
    await workflows.persistWorkflowSnapshot({ ...target, snapshot: createEmptyWorkflowSnapshot(target.runId) });
    const output = { date: new Date(0), optional: undefined, error: new Error('hidden') };
    const context = await workflows.updateWorkflowResults({
      ...target,
      stepId: 'tool',
      result: { status: 'success', output },
      requestContext: { date: new Date(0), optional: undefined },
      state: { date: new Date(0) },
    });
    expect(context.tool).toEqual({ status: 'success', output: { date: new Date(0).toISOString(), error: {} } });
    const stored = JSON.parse(inspect()[0]!.snapshot);
    expect(stored.context).toEqual(context);
    expect(stored.requestContext).toEqual({ date: new Date(0).toISOString() });
    expect(stored.context.__state).toEqual({ date: new Date(0).toISOString() });
    output.date.setTime(100);
    context.tool!.output.date = 'mutated return';
    const result = await workflows.updateWorkflowState({
      ...target,
      opts: { status: 'completed', result: { status: 'success', output } },
    });
    expect(result?.result).toEqual({ status: 'success', output: { date: new Date(100).toISOString(), error: {} } });
    result!.context.input = 'mutated state return';
    expect((await workflows.loadWorkflowSnapshot(target))?.context).toEqual(stored.context);
    expect(JSON.parse(inspect()[0]!.snapshot).result).toEqual(result?.result);
  });

  it('commits concurrent disjoint updates atomically and observes each complete stored prefix', async () => {
    const writes: string[][] = [];
    const { store, inspect } = createSerializingStore(rows => writes.push(rows.map(row => row.snapshot)));
    const workflows = (await store.getStore('workflows'))!;
    await workflows.persistWorkflowSnapshot({ ...target, snapshot: createEmptyWorkflowSnapshot(target.runId) });
    await Promise.all(
      ['a', 'b'].map(stepId =>
        workflows.updateWorkflowResults({
          ...target,
          stepId,
          result: { status: 'success', output: stepId },
          requestContext: {},
        }),
      ),
    );
    expect(writes).toHaveLength(3);
    expect(JSON.parse(writes[1]![0]!).context).toHaveProperty('a.output', 'a');
    expect(JSON.parse(writes[1]![0]!).context).not.toHaveProperty('b');
    expect(JSON.parse(writes[2]![0]!).context).toMatchObject({ a: { output: 'a' }, b: { output: 'b' } });
    expect(inspect()[0]!.snapshot).toBe(writes[2]![0]);
  });

  it('preserves no-op return shapes without writing or notifying', async () => {
    let writes = 0;
    const { store, inspect } = createSerializingStore(() => writes++);
    const workflows = (await store.getStore('workflows'))!;
    const update = {
      ...target,
      stepId: 'tool',
      result: { status: 'success' as const, output: 'ok' },
      requestContext: {},
    };
    expect(await workflows.updateWorkflowResults(update)).toEqual({});
    expect(await workflows.updateWorkflowState({ ...target, opts: { status: 'completed' } })).toBeUndefined();
    expect(writes).toBe(0);
    await workflows.persistWorkflowSnapshot({ ...target, snapshot: createEmptyWorkflowSnapshot(target.runId) });
    const before = inspect();
    expect(
      await workflows.updateWorkflowState({
        ...target,
        opts: { status: 'completed', expectedStatus: 'suspended' },
      }),
    ).toBeUndefined();
    expect(inspect()).toEqual(before);
    expect(writes).toBe(1);
  });

  it('rejects stale fences on all mutations without changing stored JSON', async () => {
    let writes = 0;
    const { store, inspect } = createSerializingStore(() => writes++);
    const workflows = (await store.getStore('workflows'))!;
    const claim = await workflows.claimRunOwnership({ runId: target.runId, ownerId: 'old', leaseMs: 60_000 });
    if (!claim.acquired) throw new Error('Expected ownership');
    const fence = { runId: target.runId, ownerId: 'old', generation: claim.record.generation };
    const snapshot = createEmptyWorkflowSnapshot(target.runId);
    await workflows.persistWorkflowSnapshot({ ...target, snapshot, fence });
    await workflows.claimRunOwnership({ runId: target.runId, ownerId: 'new', leaseMs: 60_000, force: true });
    const before = inspect();
    await expect(workflows.persistWorkflowSnapshot({ ...target, snapshot, fence })).rejects.toThrow();
    await expect(
      workflows.updateWorkflowResults({
        ...target,
        stepId: 'tool',
        result: { status: 'success', output: 'stale' },
        requestContext: {},
        fence,
      }),
    ).rejects.toThrow();
    await expect(workflows.updateWorkflowState({ ...target, opts: { status: 'completed' }, fence })).rejects.toThrow();
    await expect(workflows.deleteWorkflowRunById({ ...target, fence })).rejects.toThrow();
    expect(inspect()).toEqual(before);
    expect(writes).toBe(1);
  });

  it('preserves row metadata, status filters, and deletion semantics', async () => {
    const { store, inspect } = createSerializingStore();
    const workflows = (await store.getStore('workflows'))!;
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const snapshot = createEmptyWorkflowSnapshot(target.runId);
    await workflows.persistWorkflowSnapshot({ ...target, snapshot, resourceId: 'resource', createdAt });
    await workflows.persistWorkflowSnapshot({ ...target, snapshot });
    const run = await workflows.getWorkflowRunById({ runId: target.runId });
    expect(run).toMatchObject({ createdAt, resourceId: 'resource' });
    expect(run?.createdAt).toBeInstanceOf(Date);
    expect(run?.updatedAt).toBeInstanceOf(Date);
    await workflows.updateWorkflowState({
      ...target,
      opts: { status: 'suspended', expectedStatus: ['pending', 'running'] },
    });
    expect(
      (
        await workflows.listWorkflowRuns({
          workflowName: target.workflowName,
          status: 'suspended',
          resourceId: 'resource',
        })
      ).total,
    ).toBe(1);
    expect((await workflows.listWorkflowRuns({ status: 'completed' })).total).toBe(0);
    expect(await workflows.getWorkflowRunById({ ...target, workflowName: 'other' })).toBeNull();
    await workflows.deleteWorkflowRunById(target);
    expect(inspect()).toEqual([]);
    expect(await workflows.loadWorkflowSnapshot(target)).toBeNull();
    expect(await workflows.getWorkflowRunById(target)).toBeNull();
    expect((await workflows.listWorkflowRuns()).total).toBe(0);
  });

  it('reports UTF-8 bytes of committed snapshots, including partial writes and Unicode', async () => {
    const { store, inspect } = createSerializingStore();
    const workflows = (await store.getStore('workflows'))!;
    const snapshot = createEmptyWorkflowSnapshot(target.runId);
    snapshot.context.input = { text: 'é漢字' };
    await workflows.persistWorkflowSnapshot({ ...target, snapshot });
    const first = inspect()[0]!;
    expect(first.snapshotBytes).toBe(new TextEncoder().encode(first.snapshot).length);
    expect(first.snapshotBytes).toBeGreaterThan(first.snapshot.length);
    snapshot.context.input.text = 'changed without a write';
    expect(inspect()[0]).toEqual(first);
    await workflows.updateWorkflowResults({
      ...target,
      stepId: 'tool',
      result: { status: 'success', output: '漢' },
      requestContext: {},
    });
    const second = inspect()[0]!;
    expect(second.snapshotBytes).toBe(new TextEncoder().encode(second.snapshot).length);
    expect(second.snapshotBytes).toBeGreaterThan(first.snapshotBytes);
    await workflows.updateWorkflowState({ ...target, opts: { status: 'suspended' } });
    const third = inspect()[0]!;
    expect(third.snapshotBytes).toBe(new TextEncoder().encode(third.snapshot).length);
    expect(JSON.parse(third.snapshot).status).toBe('suspended');
  });
});
