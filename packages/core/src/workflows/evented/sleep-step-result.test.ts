import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../create';
import { createStep as createDefaultStep } from '../workflow';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '.';

// See https://github.com/mastra-ai/mastra/issues/30008.
const engines = [
  { name: 'evented v1', createStep: createEventedStep, createWorkflow: createEventedWorkflow, storageVersion: 1 },
  { name: 'evented v2', createStep: createEventedStep, createWorkflow: createEventedWorkflow, storageVersion: 2 },
  { name: 'default', createStep: createDefaultStep, createWorkflow: createDefaultWorkflow, storageVersion: undefined },
] as const;

const order = { customer: 'c1', order: 42 };
const schema = z.object({ customer: z.string(), order: z.number() });

describe.each(engines)(
  'a finished sleep on the $name engine',
  ({ name, createStep: makeStep, createWorkflow, storageVersion }) => {
    const createStep = makeStep as (...args: any[]) => any;
    async function setup(until: boolean, duration = 1) {
      const chargeInputs: unknown[] = [];
      let chargeFails = true;
      const prepare = createStep({
        id: 'prepare',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }: any) => inputData,
      });
      const charge = createStep({
        id: 'charge',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }: any) => {
          chargeInputs.push(inputData);
          if (chargeFails) {
            chargeFails = false;
            throw new Error('card declined');
          }
          return inputData;
        },
      });
      const base = (createWorkflow as any)({
        id: `sleep-result-${name.replace(' ', '-')}-${until ? 'until' : 'sleep'}-${duration}`,
        inputSchema: schema,
        outputSchema: schema,
        ...(storageVersion ? { options: { storageVersion } } : {}),
      }).then(prepare);
      const workflow = (until ? base.sleepUntil(new Date(Date.now() + duration)) : base.sleep(duration))
        .then(charge)
        .commit();

      const storage = new MockStore();
      const mastra = new Mastra({
        logger: false,
        storage,
        pubsub: new EventEmitterPubSub(),
        workflows: { [workflow.id]: workflow },
      });
      await mastra.startWorkers();
      return { workflow, storage, mastra, chargeInputs };
    }

    it.each([false, true])('is recorded as success with its output (sleepUntil: %s)', async until => {
      const { workflow, mastra, chargeInputs } = await setup(until);
      try {
        const run = await workflow.createRun();
        const first = await run.start({ inputData: order });
        expect(first.status).toBe('failed');

        const stored = await workflow.getWorkflowRunById(run.runId);
        const sleepId = Object.keys(stored!.steps!).find(id => id.startsWith('sleep'))!;
        const finished = { status: 'success', output: order, endedAt: expect.any(Number) };
        expect(stored!.steps![sleepId]).toMatchObject(finished);
        // Storage v2 run results leave `steps` to be loaded on demand.
        if (storageVersion !== 2) expect(first.steps[sleepId]).toMatchObject(finished);

        const retried = await run.timeTravel({ step: 'charge' });
        expect(retried.status).toBe('success');
        expect(chargeInputs).toEqual([order, order]);
        expect(retried.status === 'success' && retried.result).toEqual(order);
      } finally {
        await mastra.stopWorkers();
      }
    });

    it.each([false, true])('stays unfinished when the run is canceled mid-sleep (sleepUntil: %s)', async until => {
      const { workflow, mastra, chargeInputs } = await setup(until, 1000);
      try {
        const run = await workflow.createRun();
        const events: string[] = [];
        run.watch((event: any) => events.push(`${event.type}:${event.payload?.id}`));
        const started = run.start({ inputData: order });
        await vi.waitFor(async () => {
          const stored = await workflow.getWorkflowRunById(run.runId);
          expect(Object.values(stored?.steps ?? {}).some((r: any) => r.status === 'waiting')).toBe(true);
        });
        await run.cancel();
        expect((await started).status).toBe('canceled');
        await new Promise(resolve => setTimeout(resolve, 1100));

        const stored = await workflow.getWorkflowRunById(run.runId);
        expect(stored?.status).toBe('canceled');
        const sleepId = Object.keys(stored!.steps!).find(id => id.startsWith('sleep'))!;
        expect((stored!.steps![sleepId] as any).status).not.toBe('success');
        expect(events).not.toContain(`workflow-step-result:${sleepId}`);
        expect(events).not.toContain(`workflow-step-finish:${sleepId}`);
        expect(chargeInputs).toEqual([]);
      } finally {
        await mastra.stopWorkers();
      }
    });
  },
);

// A sleep's timer publishes `workflow.step.end`; the processor saves the
// result inside that delivery, so storage errors there are retried.
describe.each([1, 2] as const)('a finished sleep on evented storage v%s', storageVersion => {
  const isSleepSuccess = (stepId: unknown, result: any) =>
    String(stepId).startsWith('sleep') && result?.status === 'success';

  async function setup(
    until: boolean,
    { last = false, pubsub = new EventEmitterPubSub() }: { last?: boolean; pubsub?: EventEmitterPubSub } = {},
  ) {
    const charge = vi.fn(async ({ inputData }: any) => inputData);
    const base = createEventedWorkflow({
      id: `sleep-end-${storageVersion}-${until}-${last}`,
      inputSchema: schema,
      outputSchema: schema,
      options: { storageVersion },
    } as any).then(
      createEventedStep({
        id: 'prepare',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }) => inputData,
      }),
    );
    const slept = until ? base.sleepUntil(new Date(Date.now() + 20)) : base.sleep(20);
    const workflow = (
      last
        ? slept
        : slept.then(createEventedStep({ id: 'charge', inputSchema: schema, outputSchema: schema, execute: charge }))
    ).commit();
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [workflow.id]: workflow } });
    const store = (await storage.getStore('workflows')) as any;
    const writeMethod = storageVersion === 1 ? 'updateWorkflowResults' : 'appendWorkflowRunEntries';
    const write = store[writeMethod].bind(store);
    const sleepWrites: any[] = [];
    let failNext = false;
    vi.spyOn(store, writeMethod).mockImplementation(async (args: any) => {
      const [stepId, result] = args.stepId ? [args.stepId, args.result] : (Object.entries(args.steps ?? {})[0] ?? []);
      if (isSleepSuccess(stepId, result)) {
        sleepWrites.push(result);
        if (failNext) {
          failNext = false;
          throw new Error('storage down');
        }
      }
      return write(args);
    });
    await mastra.startWorkers();
    return { workflow, mastra, charge, sleepWrites, failOnce: () => (failNext = true) };
  }

  async function withUnhandled<T>(fn: (unhandled: unknown[]) => Promise<T>) {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      return await fn(unhandled);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  }

  it.each([false, true])('retries a failed save of its result (sleepUntil: %s)', async until => {
    const { workflow, mastra, charge, sleepWrites, failOnce } = await setup(until);
    await withUnhandled(async unhandled => {
      try {
        failOnce();
        const run = await workflow.createRun();
        const result = await run.start({ inputData: order });
        expect(sleepWrites).toHaveLength(2);
        expect(result.status).toBe('success');
        expect(charge).toHaveBeenCalledTimes(1);
        const stored = await workflow.getWorkflowRunById(run.runId);
        const sleepId = Object.keys(stored!.steps!).find(id => id.startsWith('sleep'))!;
        expect(stored!.steps![sleepId]).toMatchObject({ status: 'success', output: order });
        expect(sleepWrites[1].endedAt).toBe(sleepWrites[0].endedAt);
        expect(unhandled).toEqual([]);
      } finally {
        await mastra.stopWorkers();
      }
    });
  });

  it.each([false, true])('reports its result and finish as watch events (sleepUntil: %s)', async until => {
    const { workflow, mastra } = await setup(until);
    try {
      const run = await workflow.createRun();
      const events: any[] = [];
      run.watch((event: any) => events.push(event));
      await run.start({ inputData: order });
      const stepResult = events.find(e => e.type === 'workflow-step-result' && e.payload.id.startsWith('sleep'));
      expect(stepResult?.payload).toMatchObject({
        status: 'success',
        payload: order,
        output: order,
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'workflow-step-finish',
          payload: expect.objectContaining({ id: stepResult.payload.id }),
        }),
      );
    } finally {
      await mastra.stopWorkers();
    }
  });

  it.each([false, true])('ends the run when it is the last step (sleepUntil: %s)', async until => {
    const { workflow, mastra } = await setup(until, { last: true });
    try {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: order });
      expect(result.status).toBe('success');
      expect(result.status === 'success' && result.result).toEqual(order);
      const stored = await workflow.getWorkflowRunById(run.runId);
      expect(stored?.status).toBe('success');
      expect(stored?.activeStepsPath ?? {}).toEqual({});
    } finally {
      await mastra.stopWorkers();
    }
  });

  it.each([false, true])('saves the same result again on a redelivered end (sleepUntil: %s)', async until => {
    const pubsub = new EventEmitterPubSub();
    const publish = pubsub.publish.bind(pubsub);
    vi.spyOn(pubsub, 'publish').mockImplementation(async (topic: string, event: any) => {
      await publish(topic, event);
      // The sleep is entry 1 (after `prepare`); deliver its end twice.
      if (event.type === 'workflow.step.end' && event.data?.executionPath?.join() === '1') {
        await new Promise(resolve => setTimeout(resolve, 50));
        await publish(topic, event);
      }
    });
    const { workflow, mastra, sleepWrites, charge } = await setup(until, { pubsub });
    try {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: order });
      expect(result.status).toBe('success');
      await new Promise(resolve => setTimeout(resolve, 200));
      // A sleep's end is a step's end: on a store that does not guard steps a
      // redelivered end saves and routes again, like any step's redelivered end.
      // Only a store that guards step starts drops the second run of `charge`.
      expect(charge.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(sleepWrites).toHaveLength(2);
      expect(sleepWrites[1]).toEqual(sleepWrites[0]);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it.each([false, true])('pauses after the sleep when run per step (sleepUntil: %s)', async until => {
    const charge = vi.fn(async ({ inputData }: any) => inputData);
    const base = createEventedWorkflow({
      id: `sleep-per-step-${storageVersion}-${until}`,
      inputSchema: schema,
      outputSchema: schema,
      options: { storageVersion },
    } as any);
    const workflow = (until ? base.sleepUntil(new Date(Date.now() + 20)) : base.sleep(20))
      .then(createEventedStep({ id: 'charge', inputSchema: schema, outputSchema: schema, execute: charge }))
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflow.id]: workflow },
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: order, perStep: true });
      expect(result.status).toBe('paused');
      expect(charge).not.toHaveBeenCalled();
    } finally {
      await mastra.stopWorkers();
    }
  });

  it.each([false, true])('finishes a nested workflow that ends with it (sleepUntil: %s)', async until => {
    const charge = vi.fn(async ({ inputData }: any) => inputData);
    const innerBase = createEventedWorkflow({
      id: `sleep-inner-${storageVersion}-${until}`,
      inputSchema: schema,
      outputSchema: schema,
      options: { storageVersion },
    } as any).then(
      createEventedStep({
        id: 'prepare',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }) => inputData,
      }),
    );
    const inner = (until ? innerBase.sleepUntil(new Date(Date.now() + 20)) : innerBase.sleep(20)).commit();
    const workflow = createEventedWorkflow({
      id: `sleep-outer-${storageVersion}-${until}`,
      inputSchema: schema,
      outputSchema: schema,
      options: { storageVersion },
    } as any)
      .then(inner as any)
      .then(createEventedStep({ id: 'charge', inputSchema: schema, outputSchema: schema, execute: charge }))
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflow.id]: workflow, [inner.id]: inner },
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: order });
      expect(result.status).toBe('success');
      expect(charge).toHaveBeenCalledTimes(1);
      expect(charge.mock.calls[0]![0].inputData).toEqual(order);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
