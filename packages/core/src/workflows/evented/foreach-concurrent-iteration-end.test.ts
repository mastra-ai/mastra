import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

// Two foreach iterations ending at the same time each load the run snapshot, merge their own
// iteration record into the foreach step result and write it back. The gate holds the first
// iteration-record write until the sibling has loaded and is writing too, so both writes are
// computed from the same snapshot. If writes are serialized the sibling never arrives while the
// first is held, so the gate falls back after a short delay; that only slows the passing case.
function gateIterationWrites(store: MockStore, workflowName: string, stepId: string) {
  let armed = false;
  let held: (() => void) | undefined;
  return {
    arm: () => {
      armed = true;
    },
    install: async () => {
      const workflows = (await store.getStore('workflows'))!;
      const update = workflows.updateWorkflowResults.bind(workflows);
      workflows.updateWorkflowResults = async args => {
        const isIterationRecord =
          args.workflowName === workflowName &&
          args.stepId === stepId &&
          (args.result as any)?.suspendPayload?.__workflow_meta?.foreachOutput;
        if (armed && isIterationRecord) {
          if (held) {
            armed = false;
            const release = held;
            held = undefined;
            release();
            await new Promise(resolve => setTimeout(resolve, 0));
            return update(args);
          }
          await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, 200);
            held = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          held = undefined;
          return update(args);
        }
        return update(args);
      };
    },
  };
}

describe('evented foreach iterations ending concurrently', () => {
  const item = z.object({ n: z.number() });

  it('fails the run once and records both failed iterations', async () => {
    const id = 'foreach-concurrent-failures';
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const gate = gateIterationWrites(storage, id, 'boom');
    await gate.install();

    const failEvents: unknown[] = [];
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic, event) => {
      if (topic === 'workflows' && event.type === 'workflow.fail') failEvents.push(event);
      await publish(topic, event);
    };

    let started = 0;
    let releaseBoth!: () => void;
    const bothStarted = new Promise<void>(resolve => (releaseBoth = resolve));
    const boom = createStep({
      id: 'boom',
      inputSchema: item,
      outputSchema: item,
      retries: 0,
      execute: async ({ inputData }) => {
        if (++started === 2) {
          gate.arm();
          releaseBoth();
        }
        await bothStarted;
        throw new Error(`failure ${inputData.n}`);
      },
    });
    const workflow = createWorkflow({ id, inputSchema: z.array(item), outputSchema: z.array(item) })
      .foreach(boom, { concurrency: 2 })
      .commit();
    const mastra = new Mastra({ workflows: { [id]: workflow }, storage, pubsub, logger: false });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result: any = await run.start({ inputData: [{ n: 1 }, { n: 2 }] });
      expect(result.status).toBe('failed');

      // Let the second iteration's handler finish too.
      await new Promise(resolve => setTimeout(resolve, 300));
      const workflows = (await storage.getStore('workflows'))!;
      const stored: any = await workflows.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      const records = stored.context.boom.suspendPayload?.__workflow_meta?.foreachOutput;
      expect
        .soft(
          records?.map((r: any) => r?.status),
          'recorded iteration results',
        )
        .toEqual(['failed', 'failed']);
      expect.soft(stored.context.boom.status).toBe('failed');
      expect.soft(stored.context.boom.error?.message).toBe(result.error?.message);
      expect.soft(failEvents, 'workflow.fail events for one failed run').toHaveLength(1);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('keeps the foreach failed when a sibling succeeds at the same time', async () => {
    const id = 'foreach-concurrent-fail-and-success';
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const gate = gateIterationWrites(storage, id, 'mixed');
    await gate.install();

    let started = 0;
    let releaseBoth!: () => void;
    const bothStarted = new Promise<void>(resolve => (releaseBoth = resolve));
    const mixed = createStep({
      id: 'mixed',
      inputSchema: item,
      outputSchema: item,
      retries: 0,
      execute: async ({ inputData }) => {
        if (++started === 2) {
          gate.arm();
          releaseBoth();
        }
        await bothStarted;
        if (inputData.n === 1) throw new Error('failure 1');
        return inputData;
      },
    });
    const workflow = createWorkflow({ id, inputSchema: z.array(item), outputSchema: z.array(item) })
      .foreach(mixed, { concurrency: 2 })
      .commit();
    const mastra = new Mastra({ workflows: { [id]: workflow }, storage, pubsub, logger: false });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result: any = await run.start({ inputData: [{ n: 1 }, { n: 2 }] });
      expect(result.status).toBe('failed');

      await new Promise(resolve => setTimeout(resolve, 300));
      const workflows = (await storage.getStore('workflows'))!;
      const stored: any = await workflows.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      expect.soft(stored.context.mixed.status).toBe('failed');
      expect.soft(stored.context.mixed.error?.message).toBe('failure 1');
      expect.soft(stored.context.mixed.output).toEqual([null, { n: 2 }]);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('resumes each suspended iteration with its own suspend payload', async () => {
    const id = 'foreach-concurrent-suspends';
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const gate = gateIterationWrites(storage, id, 'ask');
    await gate.install();

    let started = 0;
    let releaseBoth!: () => void;
    const bothStarted = new Promise<void>(resolve => (releaseBoth = resolve));
    const seenOnResume: Record<number, unknown> = {};
    const ask = createStep({
      id: 'ask',
      inputSchema: item,
      outputSchema: item,
      suspendSchema: z.object({ ticket: z.string() }),
      resumeSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, suspend, suspendData, resumeData }) => {
        if (resumeData) {
          seenOnResume[inputData.n] = suspendData;
          return inputData;
        }
        if (++started === 2) {
          gate.arm();
          releaseBoth();
        }
        await bothStarted;
        return suspend({ ticket: `ticket-${inputData.n}` });
      },
    });
    const workflow = createWorkflow({ id, inputSchema: z.array(item), outputSchema: z.array(item) })
      .foreach(ask, { concurrency: 2 })
      .commit();
    const mastra = new Mastra({ workflows: { [id]: workflow }, storage, pubsub, logger: false });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const first: any = await run.start({ inputData: [{ n: 1 }, { n: 2 }] });
      expect(first.status).toBe('suspended');
      await new Promise(resolve => setTimeout(resolve, 300));

      const workflows = (await storage.getStore('workflows'))!;
      const stored: any = await workflows.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      const records = stored.context.ask.output;
      expect(
        records?.map((r: any) => r?.status),
        'recorded iteration results',
      ).toEqual(['suspended', 'suspended']);

      await run.resume({ step: 'ask', resumeData: { ok: true }, forEachIndex: 0 });
      const final: any = await run.resume({ step: 'ask', resumeData: { ok: true }, forEachIndex: 1 });
      expect(final.status).toBe('success');
      expect(seenOnResume).toEqual({ 1: { ticket: 'ticket-1' }, 2: { ticket: 'ticket-2' } });
    } finally {
      await mastra.stopWorkers();
    }
  });
});
