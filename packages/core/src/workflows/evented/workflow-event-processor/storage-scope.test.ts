import { describe, expect, it, vi } from 'vitest';
import type { PubSub } from '../../../events/pubsub';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { WorkflowsInMemory } from '../../../storage/domains/workflows/inmemory';
import { createRunStorage } from '../../run-storage';
import type { WorkflowRunState } from '../../types';
import { hydrateEventData, runInStorageScope, scopedPubSub, scopedRunStorage } from './storage-scope';

const ok = (output: unknown) => ({ status: 'success', output, payload: {}, startedAt: 1, endedAt: 2 }) as any;

function stored(context: Record<string, any>, value: Record<string, any>): WorkflowRunState {
  return { runId: 'r', status: 'running', context, value } as WorkflowRunState;
}

function recordingPubSub() {
  const published: { topic: string; event: any }[] = [];
  const pubsub = {
    publish: vi.fn(async (topic: string, event: any) => {
      published.push({ topic, event });
    }),
  } as unknown as PubSub;
  return { pubsub: scopedPubSub(pubsub), published };
}

const stepEnd = (data: Record<string, any>) => ({ type: 'workflow.step.end', runId: 'r', data });

describe('storage scope on storage v2', () => {
  it('sends a step message without step results, and its state as a patch on the stored state', async () => {
    const { pubsub, published } = recordingPubSub();
    await runInStorageScope(2, async () => {
      hydrateEventData('workflow.step.run', { runId: 'r' }, stored({ input: {}, a: ok('big') }, { n: 1, keep: true }));
      await pubsub.publish(
        'workflows',
        stepEnd({
          runId: 'r',
          stepResults: { input: { x: 1 }, a: ok('big'), __state: { n: 1, keep: true } },
          prevResult: { ...ok('b'), __state: { n: 2, keep: true } },
          state: { n: 1, keep: true },
        }),
      );
    });

    expect(published[0]!.event.data).toEqual({
      runId: 'r',
      prevResult: ok('b'),
      statePatch: [{ op: 'set', path: ['n'], value: 2 }],
      storageVersion: 2,
    });
  });

  it("sends a nested run's parent descriptors without the parents' step results, and its input only to its start", async () => {
    const { pubsub, published } = recordingPubSub();
    const grandparent = { workflowId: 'g', runId: 'gr', executionPath: [0], stepResults: { a: ok(1) }, input: ok(2) };
    const parent = { workflowId: 'p', runId: 'pr', executionPath: [1], stepResults: { b: ok(3) }, input: ok(4) };
    const descriptor = { ...parent, parentWorkflow: grandparent };
    await runInStorageScope(2, async () => {
      await pubsub.publish('workflows', {
        type: 'workflow.start',
        runId: 'r',
        data: { runId: 'r', parentWorkflow: descriptor },
      });
      await pubsub.publish('workflows', stepEnd({ runId: 'r', parentWorkflow: descriptor, parentContext: descriptor }));
    });

    const withoutResults = { workflowId: 'p', runId: 'pr', executionPath: [1] };
    const grandparentWithoutResults = { workflowId: 'g', runId: 'gr', executionPath: [0] };
    expect(published[0]!.event.data.parentWorkflow).toEqual({
      ...withoutResults,
      input: ok(4),
      parentWorkflow: grandparentWithoutResults,
    });
    expect(published[1]!.event.data.parentWorkflow).toEqual({
      ...withoutResults,
      parentWorkflow: grandparentWithoutResults,
    });
    expect(published[1]!.event.data.parentContext).toEqual({
      ...withoutResults,
      parentWorkflow: grandparentWithoutResults,
    });
  });

  it('fills a step message in from the stored run, the message winning for the steps it carries', () => {
    const data = runInStorageScope(2, () =>
      hydrateEventData(
        'workflow.step.end',
        {
          runId: 'r',
          stepResults: { input: { x: 1 }, b: ok('new') },
          statePatch: [{ op: 'set', path: ['n'], value: 2 }],
        },
        stored({ input: { x: 0 }, a: ok('a'), b: ok('old'), __state: { stale: true } }, { n: 1, keep: true }),
      ),
    );

    expect(data.state).toEqual({ n: 2, keep: true });
    expect(data.stepResults).toEqual({ input: { x: 1 }, a: ok('a'), b: ok('new'), __state: { n: 2, keep: true } });
    expect(data).not.toHaveProperty('statePatch');
  });

  it('keeps a whole state the message carries, and leaves start events as sent', () => {
    runInStorageScope(2, () => {
      const handBack = hydrateEventData('workflow.step.end', { runId: 'r', state: { child: 1 } }, stored({}, { n: 1 }));
      expect(handBack.state).toEqual({ child: 1 });

      const start = { runId: 'r', initialState: { n: 0 } };
      expect(hydrateEventData('workflow.start', start, stored({ a: ok(1) }, { n: 1 }))).toBe(start);
    });
  });

  it('sends other events and other topics as they are, tagged with the version on `workflows`', async () => {
    const { pubsub, published } = recordingPubSub();
    const data = { runId: 'r', stepResults: { input: {}, a: ok(1) }, state: { n: 1 } };
    await runInStorageScope(2, async () => {
      await pubsub.publish('workflows', { type: 'workflow.end', runId: 'r', data });
      await pubsub.publish('workflow.events.v2.r', stepEnd(data));
    });

    expect(published[0]!.event.data).toEqual({ ...data, storageVersion: 2 });
    expect(published[1]!.event.data).toBe(data);
  });

  it('writes whole states as patches on the stored state, each against the last write', async () => {
    const store = new WorkflowsInMemory({ db: new InMemoryDB() });
    const appended = vi.spyOn(store, 'appendWorkflowRunEntries');
    const inner = createRunStorage({ storageVersion: 2, workflowName: 'wf', runId: 'r', getStore: async () => store });

    await runInStorageScope(2, async () => {
      const runStorage = scopedRunStorage('r', inner);
      await runStorage.writeSnapshot(stored({ input: {} }, { n: 1, keep: true }));
      await runStorage.writeStepResult({ stepId: 'a', result: ok(1), requestContext: {}, state: { n: 2, keep: true } });
      await runStorage.writeState({ state: { n: 2, keep: true, added: 'x' }, requestContext: {} });
    });

    expect(appended.mock.calls.map(([args]) => args.statePatch)).toEqual([
      [{ op: 'set', path: ['n'], value: 2 }],
      [{ op: 'set', path: ['added'], value: 'x' }],
    ]);
    expect(await inner.loadState()).toEqual({ n: 2, keep: true, added: 'x' });
  });

  it('leaves storage v1 runs as they are', async () => {
    const { pubsub, published } = recordingPubSub();
    const inner = createRunStorage({
      storageVersion: 1,
      workflowName: 'wf',
      runId: 'r',
      getStore: async () => undefined,
    });
    const data = { runId: 'r', stepResults: { input: {}, a: ok(1) }, state: { n: 1 } };
    await runInStorageScope(1, async () => {
      await pubsub.publish('workflows', stepEnd(data));
      expect(scopedRunStorage('r', inner)).toBe(inner);
    });

    expect(published[0]!.event.data).toBe(data);
  });
});
