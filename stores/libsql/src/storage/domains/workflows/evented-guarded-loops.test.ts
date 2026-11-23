/**
 * Evented loops must keep looping after their body is restarted or resumed on a store that
 * enforces step guards. The re-driven iteration has to complete under the occurrence that
 * started it; otherwise the loop leaf stays `running`, the next iteration's step.run is
 * rejected as stale and silently acked, and the run never finishes.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { LibSQLStore } from '../..';
import { EventEmitterPubSub } from '../../../../../../packages/core/src/events/event-emitter';
import { Mastra } from '../../../../../../packages/core/src/mastra';
import { createStep, createWorkflow } from '../../../../../../packages/core/src/workflows/evented';

const Value = z.object({ n: z.number() });
const hosts: Mastra[] = [];
let storage: LibSQLStore;

beforeAll(async () => {
  storage = new LibSQLStore({ id: 'evented-guarded-loops', url: ':memory:' });
  await storage.init();
  expect((await storage.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
});

afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.stopWorkers()));
});

afterAll(async () => {
  await storage.close();
});

async function makeHost(workflows: Record<string, any>) {
  const mastra = new Mastra({ logger: false, storage, workflows, pubsub: new EventEmitterPubSub() });
  await mastra.startWorkers();
  hosts.push(mastra);
  return mastra;
}

function withinTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<{ status: 'hung' }>(resolve => setTimeout(() => resolve({ status: 'hung' }), 10_000)),
  ]);
}

async function loadLeaf(workflowName: string, runId: string, stepId: string) {
  const workflows = (await storage.getStore('workflows'))!;
  const snapshot = await workflows.loadWorkflowSnapshot({ workflowName, runId });
  return snapshot?.context[stepId];
}

/** Starts a run whose second iteration hangs on host A, as if the process died mid-step. */
async function crashSecondIteration(
  outerId: string,
  build: (execute: (n: number) => Promise<{ n: number }>) => Record<string, any>,
) {
  const runId = crypto.randomUUID();
  const crashed = Promise.withResolvers<void>();
  const hostA = build(async n => {
    if (n === 1) {
      crashed.resolve();
      await new Promise<never>(() => {});
    }
    return { n: n + 1 };
  });
  await makeHost(hostA);
  const runA = await hostA[outerId].createRun({ runId });
  runA.start({ inputData: { n: 0 } }).catch(() => {});
  await crashed.promise;
  return runId;
}

describe('LibSQL evented loop over a plain step', () => {
  // This PR's case: a restarted plain-step body completes under its stored occurrence.
  it('keeps looping after the step is restarted mid-iteration', async () => {
    const build = (execute: (n: number) => Promise<{ n: number }>) => {
      const inc = createStep({
        id: 'inc',
        inputSchema: Value,
        outputSchema: Value,
        execute: async ({ inputData }) => execute(inputData.n),
      });
      const outer = createWorkflow({ id: 'restart-step-loop', inputSchema: Value, outputSchema: Value })
        .dountil(inc, async ({ inputData }) => inputData.n >= 3)
        .commit();
      return { [outer.id]: outer };
    };
    const runId = await crashSecondIteration('restart-step-loop', build);

    // Host B: fresh instances over the same storage restart the run.
    const seen: number[] = [];
    const hostB = build(async n => {
      seen.push(n);
      return { n: n + 1 };
    });
    await makeHost(hostB);
    const runB = await hostB['restart-step-loop'].createRun({ runId });
    const result = await withinTimeout(runB.restart());

    const leaf = await loadLeaf('restart-step-loop', runId, 'inc');
    expect(result.status, `loop leaf: ${JSON.stringify(leaf)}`).toBe('success');
    expect(result).toMatchObject({ result: { n: 3 } });
    expect(seen).toEqual([1, 2]);
  }, 20_000);

  // Control: the resume path shares the occurrence selection changed for restart.
  it('keeps looping after the step is resumed from a suspension', async () => {
    const seen: number[] = [];
    const ask = createStep({
      id: 'ask',
      inputSchema: Value,
      outputSchema: Value,
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (inputData.n === 1 && !resumeData) return suspend({});
        seen.push(inputData.n);
        return { n: inputData.n + 1 };
      },
    });
    const outer = createWorkflow({ id: 'resume-step-loop', inputSchema: Value, outputSchema: Value })
      .dountil(ask, async ({ inputData }) => inputData.n >= 3)
      .commit();
    await makeHost({ [outer.id]: outer });
    const run = await outer.createRun();

    const started = await withinTimeout(run.start({ inputData: { n: 0 } }));
    expect(started.status).toBe('suspended');

    const result = await withinTimeout(run.resume({ step: 'ask', resumeData: { approved: true } }));
    const leaf = await loadLeaf(outer.id, run.runId, 'ask');
    expect(result.status, `loop leaf: ${JSON.stringify(leaf)}`).toBe('success');
    expect(result).toMatchObject({ result: { n: 3 } });
    // Each iteration ran once: the resume neither skipped nor repeated one.
    expect(seen).toEqual([0, 1, 2]);
  }, 20_000);
});

describe('LibSQL evented loop over a nested workflow', () => {
  // COR-1497 (#29431): a restarted child completes the loop leaf under its stored occurrence.
  it('keeps looping after the restarted child completes under the stored occurrence', async () => {
    const build = (execute: (n: number) => Promise<{ n: number }>) => {
      const inc = createStep({
        id: 'inc',
        inputSchema: Value,
        outputSchema: Value,
        execute: async ({ inputData }) => execute(inputData.n),
      });
      const body = createWorkflow({ id: 'restart-loop-body', inputSchema: Value, outputSchema: Value })
        .then(inc)
        .commit();
      const outer = createWorkflow({ id: 'restart-loop-outer', inputSchema: Value, outputSchema: Value })
        .dountil(body, async ({ inputData }) => inputData.n >= 3)
        .commit();
      return { [body.id]: body, [outer.id]: outer };
    };
    const runId = await crashSecondIteration('restart-loop-outer', build);

    // The crashed iteration's leaf is guarded: `running` under a stored occurrence.
    const crashedLeaf = await loadLeaf('restart-loop-outer', runId, 'restart-loop-body');
    expect(crashedLeaf?.status).toBe('running');
    expect(crashedLeaf?.metadata?.startedBy).toEqual(expect.any(String));

    // Host B: fresh instances over the same storage restart the run.
    const seen: number[] = [];
    const hostB = build(async n => {
      seen.push(n);
      return { n: n + 1 };
    });
    await makeHost(hostB);
    const runB = await hostB['restart-loop-outer'].createRun({ runId });
    const result = await withinTimeout(runB.restart());

    const leaf = await loadLeaf('restart-loop-outer', runId, 'restart-loop-body');
    expect(result.status, `loop leaf: ${JSON.stringify(leaf)}`).toBe('success');
    expect(result).toMatchObject({ result: { n: 3 } });
    expect(seen).toEqual([1, 2]);
    expect(leaf?.status).not.toBe('running');
  }, 20_000);

  // #28932 (fixed by #30832): a resumed child completes the loop leaf under its stored occurrence.
  // The resumed iteration either needs another one (the stall in #28932) or meets the exit
  // condition, so the condition must be evaluated on the resumed result, not a saved decision.
  it.each([
    { name: 'runs the next iteration', add: 1, seen: [0, 1, 1, 2] },
    { name: 'ends the loop', add: 2, seen: [0, 1, 1] },
  ])(
    '$name after the resumed child completes under the stored occurrence',
    async ({ add, seen: expected }) => {
      const seen: number[] = [];
      const inc = createStep({
        id: 'inc',
        inputSchema: Value,
        outputSchema: Value,
        resumeSchema: z.object({ add: z.number() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          seen.push(inputData.n);
          if (inputData.n === 1 && !resumeData) {
            return suspend({});
          }
          return { n: inputData.n + (resumeData?.add ?? 1) };
        },
      });
      const body = createWorkflow({ id: 'resume-loop-body', inputSchema: Value, outputSchema: Value })
        .then(inc)
        .commit();
      const outer = createWorkflow({ id: 'resume-loop-outer', inputSchema: Value, outputSchema: Value })
        .dountil(body, async ({ inputData }) => inputData.n >= 3)
        .commit();
      await makeHost({ [body.id]: body, [outer.id]: outer });

      const run = await outer.createRun();
      const suspended = await run.start({ inputData: { n: 0 } });
      expect(suspended.status).toBe('suspended');

      const result = await withinTimeout(run.resume({ step: [body.id, 'inc'], resumeData: { add } }));

      const leaf = await loadLeaf(outer.id, run.runId, body.id);
      expect(result.status, `loop leaf: ${JSON.stringify(leaf)}`).toBe('success');
      expect(result).toMatchObject({ result: { n: 3 } });
      expect(seen).toEqual(expected);
    },
    20_000,
  );
});
