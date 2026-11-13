import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createGate, createRestartScenario } from '../../agent/durable/__tests__/restart-harness';
import type { Gate } from '../../agent/durable/__tests__/restart-harness';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(scenario => scenario.stop()));
});

async function timebox<T>(promise: Promise<T>, ms: number): Promise<T | 'timed out'> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<'timed out'>(resolve => {
        timer = setTimeout(() => resolve('timed out'), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe.each([1, 2] as const)('foreach concurrent writes (storage v%s)', storageVersion => {
  it('keeps every child run id when iterations start together', async () => {
    const id = `foreach-child-starts-v${storageVersion}`;
    const allStarted = Promise.withResolvers<void>();
    let started = 0;
    const child = createWorkflow({
      id: `${id}-child`,
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
      options: { storageVersion },
    })
      .then(
        createStep({
          id: 'inc',
          inputSchema: z.object({ n: z.number() }),
          outputSchema: z.object({ n: z.number() }),
          execute: async ({ inputData }) => {
            if (++started === 3) allStarted.resolve();
            await allStarted.promise;
            return { n: inputData.n + 1 };
          },
        }),
      )
      .commit();
    const parent = createWorkflow({
      id,
      inputSchema: z.array(z.object({ n: z.number() })),
      outputSchema: z.any(),
      options: { storageVersion },
    })
      .foreach(child, { concurrency: 3 })
      .commit();
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { [id]: parent, [child.id]: child },
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startWorkers();
    try {
      const run = await parent.createRun();
      const startedRun = run.start({ inputData: [{ n: 1 }, { n: 2 }, { n: 3 }] });
      await allStarted.promise;
      const store = (await storage.getStore('workflows'))!;
      const midRun: any = await store.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      const startedIds = midRun?.context?.[child.id]?.metadata?.foreachNestedRunIds ?? {};
      // Every start carries only its own index, so a replacing write would leave one id.
      expect(Object.keys(startedIds).sort()).toEqual(['0', '1', '2']);

      const result: any = await startedRun;
      expect(result.status).toBe('success');
      expect(result.result).toEqual([{ n: 2 }, { n: 3 }, { n: 4 }]);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('fails the run when the first failure cannot be published', async () => {
    const pubsub = new EventEmitterPubSub();
    const publishing = Promise.withResolvers<void>();
    const siblingRecorded = Promise.withResolvers<void>();
    let rejected = 0;
    let failEvents = 0;
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic, event, options) => {
      const data = (event as any).data;
      if (data?.type === 'workflow-step-progress' && data.payload?.iterationStatus === 'failed') {
        if (data.payload.currentIndex === 1) siblingRecorded.resolve();
      }
      if (topic === 'workflows' && event.type === 'workflow.fail') {
        failEvents++;
        if (rejected === 0) {
          rejected++;
          publishing.resolve();
          // Record another failure before the redelivery, then fail the transport for this publish.
          await siblingRecorded.promise;
          throw new Error('pubsub unavailable');
        }
      }
      return publish(topic, event, options);
    };

    const id = `foreach-failed-publish-v${storageVersion}`;
    const item = z.object({ n: z.number() });
    const boom = createStep({
      id: 'boom',
      inputSchema: item,
      outputSchema: item,
      retries: 0,
      execute: async ({ inputData }) => {
        if (inputData.n === 1) throw new Error('first failure');
        await publishing.promise;
        throw new Error('second failure');
      },
    });
    const workflow = createWorkflow({
      id,
      inputSchema: z.object({}),
      outputSchema: z.array(item),
      options: { storageVersion },
    })
      .then(
        createStep({
          id: 'list',
          inputSchema: z.object({}),
          outputSchema: z.array(item),
          execute: async () => [{ n: 1 }, { n: 2 }],
        }),
      )
      .foreach(boom, { concurrency: 2 })
      .commit();
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [id]: workflow } });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const outcome = await timebox(run.start({ inputData: {} }), 3000);
      expect(outcome).not.toBe('timed out');
      expect((outcome as any).status).toBe('failed');
      // The failed publish is retried by redelivery instead of both iterations skipping it.
      expect(failEvents).toBeGreaterThanOrEqual(2);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('reuses the recorded child runs when the parent restarts mid-foreach', async () => {
    const item = z.object({ n: z.number() });
    const runId = `foreach-restart-v${storageVersion}`;
    const childId = `${runId}-child`;
    // Finishes iteration 0, then parks inside iteration 1 so the parent can be cut while running.
    const gate = createGate();
    gates.push(gate);
    const runs: { generation: number; input: { n: number } }[] = [];
    const nestedRunIds = async (workflows: any) => {
      const snapshot: any = await workflows.loadWorkflowSnapshot({ workflowName: runId, runId });
      return snapshot?.context?.[childId]?.metadata?.foreachNestedRunIds ?? {};
    };
    const scenario = createRestartScenario({
      kind: 'workflow',
      runId,
      storageVersion,
      build: ({ core, generation }) => {
        const child = core
          .createEventedWorkflow({ id: childId, inputSchema: item, outputSchema: item, options: { storageVersion } })
          .then(
            core.createEventedStep({
              id: 'inc',
              inputSchema: item,
              outputSchema: item,
              execute: async ({ inputData }: any) => {
                runs.push({ generation, input: inputData });
                if (generation === 1 && inputData.n === 10) await gate.wait();
                return { n: inputData.n + 1 };
              },
            }),
          )
          .commit();
        return core
          .createEventedWorkflow({
            id: runId,
            inputSchema: z.array(item),
            outputSchema: z.any(),
            options: { storageVersion },
          })
          .foreach(child, { concurrency: 1 })
          .commit();
      },
    });
    scenarios.push(scenario);
    const original = await scenario.start(async ({ workflow }) =>
      (await workflow.createRun({ runId })).start({ inputData: [{ n: 1 }, { n: 10 }] }),
    );
    await gate.reached;

    let before: Record<string, string> = {};
    for (let attempt = 0; attempt < 200 && Object.keys(before).length < 2; attempt++) {
      before = await nestedRunIds(original.graph.workflows);
      if (Object.keys(before).length < 2) await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(Object.keys(before).sort()).toEqual(['0', '1']);

    const { result, graph } = await scenario.restart(await original.checkpoint());

    expect(result).toMatchObject({ status: 'success', result: [{ n: 2 }, { n: 11 }] });
    // Only the interrupted iteration ran again; iteration 0 reused the child run recorded before the cut.
    expect(runs.filter(run_ => run_.generation === 2)).toEqual([{ generation: 2, input: { n: 10 } }]);
    expect(await nestedRunIds(graph.workflows)).toEqual(before);
  }, 60_000);
});
