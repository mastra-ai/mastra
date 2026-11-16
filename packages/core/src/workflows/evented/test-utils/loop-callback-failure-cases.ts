/**
 * Shared cases for user callbacks that a loop or foreach runs inline (COR-1466).
 * Run them against each storage: stores with workflow step guards (Postgres)
 * evaluate the loop condition on a different code path than stores without.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Event } from '../../../events';
import { Mastra } from '../../../mastra';
import type { MastraStorage } from '../../../storage';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { createStep, createWorkflow } from '..';
import { markFrameworkCondition } from '../../framework-condition';
import { RedeliveryDriver } from './redelivery-driver';

const schema = z.object({ n: z.number() });
const optionalState = z.object({ n: z.number().optional() });

async function runStatuses(store: WorkflowsStorage, workflowName: string) {
  const { runs } = await store.listWorkflowRuns({ workflowName });
  return runs.map(run => (typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot).status);
}

function countingStep(counter: { calls: number }) {
  return createStep({
    id: 'charge',
    inputSchema: schema,
    outputSchema: schema,
    execute: async ({ inputData }) => {
      counter.calls++;
      return { n: inputData.n + 1 };
    },
  });
}

async function runToEnd({
  storage,
  build,
  rejectPublish = () => false,
  outputOptions,
}: {
  storage: MastraStorage;
  build: () => any;
  outputOptions?: { includeState?: boolean };
  /** Rejects a `workflows` publish; called with the number of publishes rejected so far. */
  rejectPublish?: (event: Omit<Event, 'id' | 'createdAt'>, rejected: number) => boolean;
}) {
  const driver = new RedeliveryDriver();
  const workflow = build();
  const mastra = new Mastra({ logger: false, storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
  const publish = driver.pubsub.publish.bind(driver.pubsub);
  let rejected = 0;
  const publishSpy = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
    if (topic === 'workflows' && rejectPublish(event, rejected)) {
      rejected++;
      throw new Error('pubsub unavailable');
    }
    return publish(topic, event, options);
  });
  await mastra.startWorkers();
  try {
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { n: 0 }, outputOptions });
    const store = (await storage.getStore('workflows'))!;
    const failEvents = driver.events.filter(event => event.type === 'workflow.fail');
    return { result, runId: run.runId as string, store, failEvents, rejected };
  } finally {
    publishSpy.mockRestore();
    await mastra.stopWorkers();
    driver.dispose();
  }
}

export function describeLoopCallbackFailures({ getStorage }: { getStorage: () => MastraStorage }) {
  describe('evented loop callbacks that throw (COR-1466)', () => {
    it.each(['dowhile', 'dountil'] as const)(
      'fails the run once without rerunning the body when a %s condition throws',
      async loopType => {
        const body = { calls: 0 };
        let conditionCalls = 0;
        const { result, failEvents } = await runToEnd({
          storage: getStorage(),
          build: () =>
            createWorkflow({ id: `throwing-${loopType}`, inputSchema: schema, outputSchema: schema })
              [loopType](countingStep(body), async () => {
                conditionCalls++;
                throw new Error('condition boom');
              })
              .commit(),
        });

        expect(result.status).toBe('failed');
        expect((result as any).error?.message).toBe('condition boom');
        expect(result.steps.charge).toMatchObject({ status: 'failed', error: { message: 'condition boom' } });
        expect(conditionCalls).toBe(1);
        expect(body.calls).toBe(1);
        expect(failEvents).toHaveLength(1);
      },
    );

    it.each([false, true])(
      'keeps the state the body set when the condition throws (failure publish rejected: %s)',
      async rejectStepEnd => {
        const { result, runId, store } = await runToEnd({
          storage: getStorage(),
          rejectPublish: (event, rejectedSoFar) =>
            rejectStepEnd &&
            rejectedSoFar === 0 &&
            event.type === 'workflow.step.end' &&
            event.data.prevResult?.status === 'failed',
          outputOptions: { includeState: true },
          build: () =>
            createWorkflow({
              id: 'throwing-condition-state',
              inputSchema: schema,
              outputSchema: schema,
              stateSchema: optionalState,
            })
              .dowhile(
                createStep({
                  id: 'charge',
                  inputSchema: schema,
                  outputSchema: schema,
                  stateSchema: optionalState,
                  execute: async ({ inputData, setState }) => {
                    await setState({ n: 42 });
                    return inputData;
                  },
                }),
                async () => {
                  throw new Error('condition boom');
                },
              )
              .commit(),
        });

        expect(result.status).toBe('failed');
        expect((result as any).state).toEqual({ n: 42 });
        const snapshot = await store.loadWorkflowSnapshot({ workflowName: 'throwing-condition-state', runId });
        expect(snapshot?.context.__state).toEqual({ n: 42 });
        expect(snapshot?.context.charge).toMatchObject({ status: 'failed' });
      },
    );

    // The condition runs while handling the child's workflow.end, so the failure must
    // still be reported against the loop's run and leave the finished child alone.
    it('fails only the loop run when the condition throws after a nested workflow body', async () => {
      const body = { calls: 0 };
      let conditionCalls = 0;
      const childId = 'nested-loop-child';
      const { result, store, failEvents } = await runToEnd({
        storage: getStorage(),
        build: () =>
          createWorkflow({ id: 'nested-loop', inputSchema: schema, outputSchema: schema })
            .dowhile(
              createWorkflow({ id: childId, inputSchema: schema, outputSchema: schema })
                .then(countingStep(body))
                .commit(),
              async () => {
                conditionCalls++;
                throw new Error('condition boom');
              },
            )
            .commit(),
      });

      expect(result.status).toBe('failed');
      expect((result as any).error?.message).toBe('condition boom');
      expect(result.steps[childId]).toMatchObject({ status: 'failed', error: { message: 'condition boom' } });
      expect(conditionCalls).toBe(1);
      expect(body.calls).toBe(1);
      expect(failEvents.map(event => event.data.workflowId)).toEqual(['nested-loop']);
      expect(await runStatuses(store, childId)).toEqual(['success']);
    });

    // With the first workflow.fail rejected, the failure is reported on a redelivery
    // that must not call the concurrency function again.
    it.each([false, true])(
      'fails the run once when a foreach concurrency resolver throws (failure publish rejected: %s)',
      async rejectFail => {
        const body = { calls: 0 };
        let resolverCalls = 0;
        const { result, failEvents, rejected } = await runToEnd({
          storage: getStorage(),
          rejectPublish: (event, rejectedSoFar) => rejectFail && rejectedSoFar === 0 && event.type === 'workflow.fail',
          build: () =>
            createWorkflow({ id: 'throwing-foreach', inputSchema: schema, outputSchema: z.any() })
              .then(
                createStep({
                  id: 'list',
                  inputSchema: schema,
                  outputSchema: z.array(schema),
                  execute: async () => [{ n: 1 }, { n: 2 }],
                }),
              )
              .foreach(countingStep(body), {
                concurrency: () => {
                  resolverCalls++;
                  throw new Error('concurrency boom');
                },
              })
              .commit(),
        });

        expect(rejected).toBe(rejectFail ? 1 : 0);
        expect(result.status).toBe('failed');
        expect((result as any).error?.message).toBe('concurrency boom');
        expect(resolverCalls).toBe(1);
        expect(body.calls).toBe(0);
        expect(failEvents).toHaveLength(1);
        expect(failEvents[0]!.data).toMatchObject({
          executionPath: [1],
          prevResult: { status: 'failed', error: { message: 'concurrency boom' } },
        });
      },
    );

    // The loop's failed step.end and the first workflow.fail are both rejected, so the
    // failure reaches the loop's run through a redelivery that must not rerun user code.
    it.each([
      ['step', 1],
      ['step', 2],
      ['nested workflow', 1],
      ['nested workflow', 2],
    ] as const)(
      'fails the loop run when reporting the failure needs a redelivery (%s body, storage v%s)',
      async (bodyKind, storageVersion) => {
        const body = { calls: 0 };
        let conditionCalls = 0;
        const loopId = `fail-publish-${bodyKind.replace(' ', '-')}-v${storageVersion}`;
        const { result, runId, store, failEvents, rejected } = await runToEnd({
          storage: getStorage(),
          rejectPublish: (event, rejectedSoFar) =>
            rejectedSoFar === 0
              ? event.type === 'workflow.step.end' && event.data.prevResult?.status === 'failed'
              : rejectedSoFar === 1 && event.type === 'workflow.fail',
          build: () =>
            createWorkflow({ id: loopId, inputSchema: schema, outputSchema: schema, options: { storageVersion } })
              .dowhile(
                bodyKind === 'step'
                  ? countingStep(body)
                  : createWorkflow({ id: `${loopId}-child`, inputSchema: schema, outputSchema: schema })
                      .then(countingStep(body))
                      .commit(),
                async () => {
                  conditionCalls++;
                  throw new Error('condition boom');
                },
              )
              .commit(),
        });

        expect(rejected).toBe(2);
        expect(result.status).toBe('failed');
        expect((result as any).error?.message).toBe('condition boom');
        expect(conditionCalls).toBe(1);
        expect(body.calls).toBe(1);
        expect(failEvents.map(event => event.data.workflowId)).toEqual([loopId]);
        // Failed at the loop step, so the failure is streamed for that step.
        expect(failEvents[0]!.data).toMatchObject({
          executionPath: [0],
          prevResult: { status: 'failed', error: { message: 'condition boom' } },
        });
        if (bodyKind === 'nested workflow') {
          expect(await runStatuses(store, `${loopId}-child`)).toEqual(['success']);
        }
        // The failed step.end never published, yet the stored step must not stay running.
        const leafId = bodyKind === 'step' ? 'charge' : `${loopId}-child`;
        const snapshot = await store.loadWorkflowSnapshot({ workflowName: loopId, runId });
        expect(snapshot?.status).toBe('failed');
        expect(snapshot?.context[leafId]).toMatchObject({ status: 'failed', error: { message: 'condition boom' } });
      },
    );

    // Framework conditions (the durable agent loop) do storage and pubsub I/O of their own.
    it('retries a framework loop condition that fails transiently', async () => {
      const body = { calls: 0 };
      let conditionCalls = 0;
      const { result } = await runToEnd({
        storage: getStorage(),
        build: () =>
          createWorkflow({ id: 'framework-condition', inputSchema: schema, outputSchema: schema })
            .dountil(
              countingStep(body),
              markFrameworkCondition(async () => {
                if (++conditionCalls === 1) throw new Error('storage unavailable');
                return true;
              }),
            )
            .commit(),
      });

      expect(result.status).toBe('success');
      expect(conditionCalls).toBe(2);
      // At-least-once delivery: the retry redelivers the event that ran the step body.
      expect(body.calls).toBe(2);
    });
  });
}
