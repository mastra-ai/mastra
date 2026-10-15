import { describe, expect, it, vi } from 'vitest';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { buildStepResultAccessors, RunJournal } from './run-journal';
import type { WorkflowRunState } from './types';

function fakeStore() {
  const persistWorkflowSnapshot = vi.fn(async (_args: any) => {});
  return { store: { persistWorkflowSnapshot } as unknown as WorkflowsStorage, persistWorkflowSnapshot };
}

function snapshot(context: Record<string, unknown>, status: WorkflowRunState['status'] = 'running') {
  return { runId: 'r', status, value: {}, context } as unknown as WorkflowRunState;
}

const ok = (output: unknown) => ({ status: 'success', output });

function write(journal: RunJournal, store: WorkflowsStorage, snap: WorkflowRunState) {
  return journal.write(store, { workflowName: 'wf', runId: 'r', snapshot: snap });
}

describe('RunJournal', () => {
  it('writes a checkpoint first, then only the steps whose object changed', async () => {
    const { store, persistWorkflowSnapshot } = fakeStore();
    const journal = new RunJournal();
    const a = ok(1);
    const context: Record<string, unknown> = { input: {}, a };

    await write(journal, store, snapshot(context));
    expect(persistWorkflowSnapshot.mock.calls[0]![0]).toMatchObject({ storageVersion: 2, changes: undefined });

    context.b = ok(2);
    await write(journal, store, snapshot(context));
    expect(persistWorkflowSnapshot.mock.calls[1]![0].changes).toEqual({ stepIds: ['b'], state: false });

    // Same object: nothing to send. A replaced object is sent even if it looks the same.
    await write(journal, store, snapshot(context));
    expect(persistWorkflowSnapshot.mock.calls[2]![0].changes).toEqual({ stepIds: [], state: false });

    context.a = ok(1);
    await write(journal, store, snapshot(context));
    expect(persistWorkflowSnapshot.mock.calls[3]![0].changes).toEqual({ stepIds: ['a'], state: false });
  });

  it('starts from the seed on resume instead of writing a checkpoint', async () => {
    const { store, persistWorkflowSnapshot } = fakeStore();
    const a = ok(1);
    const gate = { status: 'suspended' };
    const journal = new RunJournal({ a, gate });

    await write(journal, store, snapshot({ a, gate: ok(true) }));
    expect(persistWorkflowSnapshot.mock.calls[0]![0].changes).toEqual({ stepIds: ['gate'], state: false });
  });

  it('writes state only after it was marked, and clears the mark', async () => {
    const { store, persistWorkflowSnapshot } = fakeStore();
    const journal = new RunJournal({});

    journal.markStateChanged();
    await write(journal, store, snapshot({}));
    await write(journal, store, snapshot({}));

    expect(persistWorkflowSnapshot.mock.calls.map(([args]) => args.changes.state)).toEqual([true, false]);
  });

  it.each(['suspended', 'success', 'failed', 'canceled', 'waiting', 'paused'] as const)(
    'always writes state when the run is %s',
    async status => {
      const { store, persistWorkflowSnapshot } = fakeStore();
      const journal = new RunJournal({});

      await write(journal, store, snapshot({}, status));
      expect(persistWorkflowSnapshot.mock.calls[0]![0].changes.state).toBe(true);
    },
  );

  it('sends the same changes again after a failed write', async () => {
    const { store, persistWorkflowSnapshot } = fakeStore();
    const journal = new RunJournal();
    persistWorkflowSnapshot.mockRejectedValueOnce(new Error('down'));

    await expect(write(journal, store, snapshot({ a: ok(1) }))).rejects.toThrow('down');
    await write(journal, store, snapshot({ a: ok(1) }));
    expect(persistWorkflowSnapshot.mock.calls[1]![0].changes).toBeUndefined();

    const a = ok(2);
    journal.markStateChanged();
    persistWorkflowSnapshot.mockRejectedValueOnce(new Error('down'));
    await expect(write(journal, store, snapshot({ a }))).rejects.toThrow('down');
    await write(journal, store, snapshot({ a }));
    expect(persistWorkflowSnapshot.mock.calls[3]![0].changes).toEqual({ stepIds: ['a'], state: true });
  });

  describe('overlapping writes', () => {
    /** A store whose writes resolve only when the test says so. */
    function heldStore() {
      const held: { resolve: () => void }[] = [];
      const persistWorkflowSnapshot = vi.fn(
        (_args: any) => new Promise<void>(resolve => held.push({ resolve: () => resolve() })),
      );
      return { store: { persistWorkflowSnapshot } as unknown as WorkflowsStorage, persistWorkflowSnapshot, held };
    }

    async function settle(writes: Promise<void>[], held: { resolve: () => void }[], order: number[]) {
      for (const i of order) {
        held[i]!.resolve();
        await writes[i];
      }
    }

    it.each([
      ['older first', [0, 1]],
      ['newer first', [1, 0]],
    ])('resends a step two writes carried with different values (%s)', async (_, order) => {
      const { store, persistWorkflowSnapshot, held } = heldStore();
      const journal = new RunJournal({});
      const context: Record<string, unknown> = { x: ok(1) };

      const writes = [write(journal, store, snapshot(context))];
      context.x = ok(2);
      writes.push(write(journal, store, snapshot(context)));
      await settle(writes, held, order);

      const next = write(journal, store, snapshot(context));
      held[2]!.resolve();
      await next;
      expect(persistWorkflowSnapshot.mock.calls[2]![0].changes).toEqual({ stepIds: ['x'], state: false });

      const after = write(journal, store, snapshot(context));
      held[3]!.resolve();
      await after;
      expect(persistWorkflowSnapshot.mock.calls[3]![0].changes).toEqual({ stepIds: [], state: false });
    });

    it('records a step two writes carried with the same value', async () => {
      const { store, persistWorkflowSnapshot, held } = heldStore();
      const journal = new RunJournal({});
      const context: Record<string, unknown> = { x: ok(1) };

      const writes = [write(journal, store, snapshot(context))];
      context.y = ok(2);
      writes.push(write(journal, store, snapshot(context)));
      expect(persistWorkflowSnapshot.mock.calls[1]![0].changes).toEqual({ stepIds: ['x', 'y'], state: false });
      await settle(writes, held, [1, 0]);

      const next = write(journal, store, snapshot(context));
      held[2]!.resolve();
      await next;
      expect(persistWorkflowSnapshot.mock.calls[2]![0].changes).toEqual({ stepIds: [], state: false });
    });

    it.each([
      ['checkpoint first', [0, 1]],
      ['append first', [1, 0]],
    ])('writes a checkpoint after a write overlapped one (%s)', async (_, order) => {
      const { store, persistWorkflowSnapshot, held } = heldStore();
      const journal = new RunJournal();
      const context: Record<string, unknown> = { a: ok(1) };

      const writes = [write(journal, store, snapshot(context))];
      context.b = ok(2);
      writes.push(write(journal, store, snapshot(context)));
      expect(persistWorkflowSnapshot.mock.calls.map(([args]) => args.changes)).toEqual([
        undefined,
        { stepIds: ['a', 'b'], state: false },
      ]);
      await settle(writes, held, order);

      const next = write(journal, store, snapshot(context));
      held[2]!.resolve();
      await next;
      expect(persistWorkflowSnapshot.mock.calls[2]![0].changes).toBeUndefined();

      const after = write(journal, store, snapshot(context));
      held[3]!.resolve();
      await after;
      expect(persistWorkflowSnapshot.mock.calls[3]![0].changes).toEqual({ stepIds: [], state: false });
    });

    it('marks steps unsure even when the other write fails', async () => {
      const { store, persistWorkflowSnapshot } = fakeStore();
      const journal = new RunJournal({});
      const context: Record<string, unknown> = { x: ok(1) };
      let fail!: (error: Error) => void;
      persistWorkflowSnapshot.mockImplementationOnce(() => new Promise<void>((_, reject) => (fail = reject)));

      const first = write(journal, store, snapshot(context));
      context.x = ok(2);
      await write(journal, store, snapshot(context));
      // A failed write may still have committed, after the other one.
      fail(new Error('timeout'));
      await expect(first).rejects.toThrow('timeout');

      await write(journal, store, snapshot(context));
      expect(persistWorkflowSnapshot.mock.calls[2]![0].changes).toEqual({ stepIds: ['x'], state: false });
    });
  });
});

describe('buildStepResultAccessors', () => {
  const stepResults = { a: ok('out') } as any;

  it('binds both accessors to the step results on v1 runs', async () => {
    const accessors = buildStepResultAccessors({ getRunJournal: () => undefined }, 'r', stepResults);
    expect(accessors.getStepResult('a')).toBe('out');
    expect(await accessors.getStepResultAsync('a')).toBe('out');
  });

  it('makes sync getStepResult throw on v2 runs', async () => {
    const accessors = buildStepResultAccessors({ getRunJournal: () => new RunJournal() }, 'r', stepResults);
    expect(() => accessors.getStepResult({ id: 'a' })).toThrow(/await getStepResultAsync\("a"\)/);
    expect(await accessors.getStepResultAsync('a')).toBe('out');
  });
});
