import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

// On storage v2 an evented run's step messages leave out what the processor loads from storage:
// earlier steps' results and the state.

const BIG = 'x'.repeat(10_000);
const looseObject = z.looseObject({});

function makeWorkflow(storageVersion: 1 | 2) {
  const big = createStep({
    id: 'big',
    inputSchema: looseObject,
    outputSchema: looseObject,
    execute: async ({ setState }) => {
      await setState({ log: [BIG] });
      return { big: BIG };
    },
  });
  const arm = (id: string) =>
    createStep({
      id,
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ setState }) => {
        await setState({ [id]: true });
        return { [id]: true };
      },
    });
  const last = createStep({
    id: 'last',
    inputSchema: looseObject,
    outputSchema: looseObject,
    execute: async ({ getState, getStepResultAsync }) => ({
      state: await getState(),
      big: ((await getStepResultAsync('big')) as { big: string }).big.length,
    }),
  });
  return createWorkflow({
    id: `messages-v${storageVersion}`,
    inputSchema: looseObject,
    outputSchema: looseObject,
    stateSchema: looseObject,
    options: { storageVersion },
  })
    .then(big)
    .parallel([arm('left'), arm('right')])
    .then(last)
    .commit();
}

async function run(storageVersion: 1 | 2) {
  return runWorkflow(makeWorkflow(storageVersion));
}

async function runWorkflow(workflow: { createRun: () => Promise<any> }, storage = new MockStore()) {
  const pubsub = new EventEmitterPubSub();
  const messages: { type: string; bytes: number; data: string }[] = [];
  const publish = pubsub.publish.bind(pubsub);
  pubsub.publish = async (topic, event) => {
    if (topic === 'workflows') {
      const data = JSON.stringify(event.data);
      messages.push({ type: event.type, bytes: data.length, data });
    }
    return publish(topic, event);
  };
  const mastra = new Mastra({ logger: false, storage, workflows: { wf: workflow as any }, pubsub });
  await mastra.startWorkers();
  try {
    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });
    return { result, run, messages };
  } finally {
    await mastra.stopWorkers();
  }
}

describe('evented step messages on storage v2', () => {
  it('leave out earlier step results and the state, which the steps still see', async () => {
    const v1 = await run(1);
    const v2 = await run(2);

    const expected = { state: { log: [BIG], left: true, right: true }, big: BIG.length };
    expect(v1.result.status).toBe('success');
    expect(v2.result.status).toBe('success');
    expect((v1.result as any).result).toEqual(expected);
    expect((v2.result as any).result).toEqual(expected);

    // Step messages carry no step results, and the state only as a patch.
    const isStep = (m: { type: string }) => m.type === 'workflow.step.run' || m.type === 'workflow.step.end';
    for (const message of v2.messages.filter(isStep)) {
      const data = JSON.parse(message.data);
      expect(data).not.toHaveProperty('stepResults');
      expect(data).not.toHaveProperty('state');
      expect(data.prevResult ?? {}).not.toHaveProperty('__state');
    }

    // `last` starts after the parallel join: on v1 its message still carries `big`'s result and the state.
    const lastRun = (messages: { type: string; data: string }[]) =>
      messages.find(m => m.type === 'workflow.step.run' && JSON.parse(m.data).executionPath[0] === 2)!;
    expect(lastRun(v1.messages).data).toContain(BIG);
    expect(lastRun(v2.messages).data).not.toContain(BIG);

    const bytes = (messages: { bytes: number }[]) => messages.reduce((sum, m) => sum + m.bytes, 0);
    expect(bytes(v2.messages)).toBeLessThan(bytes(v1.messages) / 2);
  });

  // A step's write returns only that step on v2; the dispatch that wrote it still hands every
  // step result on: to shouldPersistSnapshot, and to the end of a run deleted before its
  // workflow.end is dispatched (which then has no stored run to fill in from).
  it.each([1, 2] as const)('keep every step result in the dispatch that writes one (v%i)', async storageVersion => {
    const seen: Record<string, string[]> = {};
    const shouldPersistSnapshot = ({
      stepResults,
      workflowStatus,
    }: {
      stepResults: object;
      workflowStatus: string;
    }) => {
      seen[workflowStatus] = Object.keys(stepResults).filter(id => !id.startsWith('__'));
      return workflowStatus !== 'success';
    };
    const first = createStep({
      id: 'first',
      inputSchema: looseObject,
      outputSchema: z.array(z.number()),
      execute: async () => [1, 2],
    });
    const second = createStep({
      id: 'second',
      inputSchema: z.array(z.number()),
      outputSchema: looseObject,
      execute: async () => ({ done: true }),
    });
    const ended = await runWorkflow(
      createWorkflow({
        id: `ended-v${storageVersion}`,
        inputSchema: looseObject,
        outputSchema: looseObject,
        options: { storageVersion, shouldPersistSnapshot },
      })
        .then(first)
        .then(second)
        .commit(),
    );
    expect(ended.result.status).toBe('success');
    expect(Object.keys(ended.result.steps)).toEqual(['input', 'first', 'second']);
    expect(seen.success).toEqual(['input', 'first', 'second']);

    const suspends = createStep({
      id: 'suspends',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData, suspend }) => suspend({ inputData }),
    });
    const suspended = await runWorkflow(
      createWorkflow({
        id: `suspended-v${storageVersion}`,
        inputSchema: looseObject,
        outputSchema: looseObject,
        options: { storageVersion, shouldPersistSnapshot },
      })
        .then(first)
        .foreach(suspends)
        .commit(),
    );
    expect(suspended.result.status).toBe('suspended');
    expect(seen.suspended).toEqual(['input', 'first', 'suspends']);
  });

  // Steps of a v2 run load earlier results and the state from the stored run, so it is stored
  // while it runs whatever its workflow's shouldPersistSnapshot says about pending and running.
  it.each([1, 2] as const)('run workflows that decline pending and running snapshots (v%i)', async storageVersion => {
    const options = {
      storageVersion,
      shouldPersistSnapshot: ({ workflowStatus }: { workflowStatus: string }) =>
        workflowStatus !== 'pending' && workflowStatus !== 'running',
    };
    const sets = createStep({
      id: 'sets',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ setState }) => {
        await setState({ log: ['sets'] });
        return { value: 1 };
      },
    });
    const reads = createStep({
      id: 'reads',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ getState, getStepResultAsync }) => ({
        state: await getState(),
        sets: await getStepResultAsync('sets'),
      }),
    });
    const flow = (id: string) =>
      createWorkflow({ id, inputSchema: looseObject, outputSchema: looseObject, stateSchema: looseObject, options })
        .then(sets)
        .then(reads);
    const expected = { state: { log: ['sets'] }, sets: { value: 1 } };

    const flat = await runWorkflow(flow(`declines-v${storageVersion}`).commit());
    expect(flat.result.status).toBe('success');
    expect(flat.result.result).toEqual(expected);

    const nested = await runWorkflow(
      createWorkflow({
        id: `declines-outer-v${storageVersion}`,
        inputSchema: looseObject,
        outputSchema: looseObject,
        stateSchema: looseObject,
        options,
      })
        .then(flow(`declines-inner-v${storageVersion}`).commit())
        .commit(),
    );
    expect(nested.result.status).toBe('success');
    expect(nested.result.result).toEqual(expected);
  });

  // A loop's next iteration takes the body's iteration count from the stored run on v2.
  it.each([1, 2] as const)('count loop iterations (v%i)', async storageVersion => {
    const counts: number[] = [];
    const body = createStep({
      id: 'body',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async () => ({}),
    });
    const workflow = createWorkflow({
      id: `loop-v${storageVersion}`,
      inputSchema: looseObject,
      outputSchema: looseObject,
      options: { storageVersion },
    })
      .dountil(body, async ({ iterationCount }) => {
        counts.push(iterationCount);
        return iterationCount >= 3 || counts.length >= 5;
      })
      .commit();

    const { result } = await runWorkflow(workflow);
    expect(result.status).toBe('success');
    expect(counts).toEqual([1, 2, 3]);
  });

  // A nested run's messages leave out its parent's step results and the nested step's input on v2:
  // the parent's dispatches load them, and the nested run's start stores the input as the step's payload.
  it.each([1, 2] as const)("leave a nested run's parent's results out of its messages (v%i)", async storageVersion => {
    const big = createStep({
      id: 'big',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async () => ({ big: BIG }),
    });
    const flag = (id: string) =>
      createStep({
        id,
        inputSchema: looseObject,
        outputSchema: looseObject,
        execute: async ({ setState }) => {
          await setState({ [id]: true });
          return { [id]: true };
        },
      });
    const inner = createWorkflow({
      id: `inner-v${storageVersion}`,
      inputSchema: looseObject,
      outputSchema: looseObject,
      stateSchema: looseObject,
      options: { storageVersion },
    })
      .then(flag('a'))
      .then(flag('b'))
      .commit();
    const last = createStep({
      id: 'last',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ inputData, getState }) => ({ inner: inputData, state: await getState() }),
    });
    const workflow = createWorkflow({
      id: `nested-v${storageVersion}`,
      inputSchema: looseObject,
      outputSchema: looseObject,
      stateSchema: looseObject,
      options: { storageVersion },
    })
      .then(big)
      .then(inner)
      .then(last)
      .commit();

    const { result, messages } = await runWorkflow(workflow);
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ inner: { b: true }, state: { a: true, b: true } });
    expect(result.steps[inner.id].payload).toEqual({ big: BIG });

    if (storageVersion === 2) {
      const innerSteps = messages
        .map(m => ({ type: m.type, data: JSON.parse(m.data) }))
        .filter(m => m.type.startsWith('workflow.step.') && m.data.parentWorkflow?.workflowId === workflow.id);
      expect(innerSteps.length).toBeGreaterThan(0);
      for (const { data } of innerSteps) {
        expect(JSON.stringify(data.parentWorkflow)).not.toContain(BIG);
      }
    }
  });

  // A loop hands each iteration's nested run back without its parent's step results on v2: it loads them.
  it.each([1, 2] as const)('loop over a nested workflow (v%i)', async storageVersion => {
    const inc = createStep({
      id: 'inc',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ inputData }) => ({ n: ((inputData as { n?: number }).n ?? 0) + 1 }),
    });
    const inner = createWorkflow({
      id: `loop-body-v${storageVersion}`,
      inputSchema: looseObject,
      outputSchema: looseObject,
      options: { storageVersion },
    })
      .then(inc)
      .commit();
    const counts: number[] = [];
    const workflow = createWorkflow({
      id: `nested-loop-v${storageVersion}`,
      inputSchema: looseObject,
      outputSchema: looseObject,
      options: { storageVersion },
    })
      .dountil(inner, async ({ inputData, iterationCount }) => {
        counts.push(iterationCount);
        return (inputData as { n: number }).n >= 3 || counts.length >= 5;
      })
      .commit();

    const { result } = await runWorkflow(workflow);
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ n: 3 });
    expect(counts).toEqual([1, 2, 3]);
    expect(result.steps[inner.id].payload).toEqual({ n: 2 });
  });

  // Each iteration's hand-back takes the nested step's payload from the stored foreach result on v2.
  it.each([1, 2] as const)('run a foreach over a nested workflow (v%i)', async storageVersion => {
    const inc = createStep({
      id: 'inc',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ inputData }) => ({ n: (inputData as { n: number }).n + 1 }),
    });
    const inner = createWorkflow({
      id: `foreach-body-v${storageVersion}`,
      inputSchema: looseObject,
      outputSchema: looseObject,
      options: { storageVersion },
    })
      .then(inc)
      .commit();
    const items = [{ n: 1 }, { n: 10 }, { n: 100 }];
    const list = createStep({
      id: 'list',
      inputSchema: looseObject,
      outputSchema: z.array(looseObject),
      execute: async () => items,
    });
    const workflow = createWorkflow({
      id: `nested-foreach-v${storageVersion}`,
      inputSchema: looseObject,
      outputSchema: z.array(looseObject),
      options: { storageVersion },
    })
      .then(list)
      .foreach(inner, { concurrency: 2 })
      .commit();

    const { result } = await runWorkflow(workflow);
    expect(result.status).toBe('success');
    expect(result.result).toEqual([{ n: 2 }, { n: 11 }, { n: 101 }]);
    expect(result.steps[inner.id].payload).toEqual(items);
  });

  // A branch's write returns only its own result on v2, so it loads its siblings' as of its write:
  // of two branches that both wrote before either loaded, only the later writer joins.
  it.each([1, 2] as const)(
    "keep parallel branches' state changes out of step results, and under later changes (v%i)",
    async storageVersion => {
      const arm = (id: string) =>
        createStep({
          id,
          inputSchema: looseObject,
          outputSchema: looseObject,
          execute: async ({ setState }) => {
            await setState({ [id]: true, last: id });
            return { [id]: true };
          },
        });
      const after = createStep({
        id: 'after',
        inputSchema: looseObject,
        outputSchema: looseObject,
        execute: async ({ setState }) => {
          await setState({ last: 'after' });
          return { after: true };
        },
      });
      const read = createStep({
        id: 'read',
        inputSchema: looseObject,
        outputSchema: looseObject,
        execute: async ({ getState, getStepResultAsync }) => ({
          state: await getState(),
          left: await getStepResultAsync('left'),
        }),
      });
      const workflow = createWorkflow({
        id: `branch-state-v${storageVersion}`,
        inputSchema: looseObject,
        outputSchema: looseObject,
        stateSchema: looseObject,
        options: { storageVersion },
      })
        .parallel([arm('left'), arm('right')])
        .then(after)
        .then(read)
        .commit();

      const { result, run } = await runWorkflow(workflow);
      expect(result.status).toBe('success');
      expect(result.result).toEqual({ state: { left: true, right: true, last: 'after' }, left: { left: true } });
      const stored = await (workflow as any).getWorkflowRunById(run.runId);
      expect(JSON.stringify([result.steps, stored])).not.toContain('__stateDelta');
    },
  );

  it("skip a nested workflow's pruneSnapshot on v2, so its later steps read whole results", async () => {
    // As on the default engine: a v2 run's steps load earlier results from storage, so a pruned
    // stored result would change what they read.
    const pruned: string[] = [];
    const a = createStep({
      id: 'a',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async () => ({ keep: 1, heavy: BIG }),
    });
    const b = createStep({
      id: 'b',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ getStepResultAsync }) => ({ fromA: await getStepResultAsync('a') }),
    });
    const inner = createWorkflow({
      id: 'prune-inner',
      inputSchema: looseObject,
      outputSchema: looseObject,
      options: {
        pruneSnapshot: ({ snapshot, workflowStatus }) => {
          pruned.push(workflowStatus);
          return { ...snapshot, context: {} };
        },
      },
    })
      .then(a)
      .then(b)
      .commit();
    const workflow = createWorkflow({
      id: 'prune-outer',
      inputSchema: looseObject,
      outputSchema: looseObject,
      options: { storageVersion: 2 },
    })
      .then(inner)
      .commit();

    const { result } = await runWorkflow(workflow);
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ fromA: { keep: 1, heavy: BIG } });
    expect(pruned).toEqual([]);
  });

  it('join parallel branches once when both write before either loads the other', async () => {
    let joins = 0;
    const arm = (id: string) =>
      createStep({ id, inputSchema: looseObject, outputSchema: looseObject, execute: async () => ({ [id]: true }) });
    const after = createStep({
      id: 'after',
      inputSchema: looseObject,
      outputSchema: looseObject,
      execute: async ({ inputData }) => {
        joins++;
        return inputData;
      },
    });
    const workflow = createWorkflow({
      id: 'join-once',
      inputSchema: looseObject,
      outputSchema: looseObject,
      options: { storageVersion: 2 },
    })
      .parallel([arm('left'), arm('right')])
      .then(after)
      .commit();

    const storage = new MockStore();
    const store = storage.stores.workflows!;
    const written = new Set<string>();
    let bothWritten!: () => void;
    const both = new Promise<void>(resolve => (bothWritten = resolve));
    const append = store.appendWorkflowRunEntries.bind(store);
    store.appendWorkflowRunEntries = async args => {
      const appended = await append(args);
      for (const [id, result] of Object.entries(args.steps)) if (result.status === 'success') written.add(id);
      if (written.has('left') && written.has('right')) bothWritten();
      return appended;
    };
    const loadSteps = store.loadWorkflowRunSteps.bind(store);
    // Hold the branches' loads of each other until both have written.
    store.loadWorkflowRunSteps = async args => {
      if (args.stepIds.length > 1) await both;
      return loadSteps(args);
    };

    const { result } = await runWorkflow(workflow, storage);
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ left: { left: true }, right: { right: true } });
    expect(joins).toBe(1);
  });
});
