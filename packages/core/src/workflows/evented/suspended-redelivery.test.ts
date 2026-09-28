/**
 * Regression for the redelivery race on the evented engine's mid-step
 * pre-write (PR #24569 review finding).
 *
 * `runLeafStep` records "this step is running, with this input" BEFORE
 * executing it (the #22636 crash fix). On an at-least-once transport a
 * `workflow.step.run` event can be redelivered AFTER the step already ran and
 * suspended. Without a guard the redelivery would re-execute the step and its
 * pre-write would overwrite the stored 'suspended' record — stripping the
 * suspendPayload that later resume recovery depends on.
 *
 * This test pins the suspended-record guard: a replayed (non-resume)
 * `step.run` delivery for a suspended step is dropped — the step does not
 * re-execute, the suspended record (and its suspendPayload) survives, and the
 * run still resumes cleanly afterwards.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Event, EventCallback, SubscribeOptions } from '../../events';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const looseObject = z.looseObject({});

/** Captures delivered workflow-step events so the same broker event can be redelivered. */
class RedeliveryPubSub extends EventEmitterPubSub {
  captured: { topic: string; event: Event }[] = [];

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions) {
    await super.subscribe(
      topic,
      (event, ack, nack) => {
        if (event.type === 'workflow.step.run' || event.type === 'workflow.step.end') {
          this.captured.push({ topic, event: structuredClone(event) });
        }
        return cb(event, ack, nack);
      },
      options,
    );
  }

  redeliver(topic: string, event: Event) {
    (this as any).emitter.emit(topic, structuredClone(event));
  }
}

describe('evented suspended-record redelivery guard', () => {
  it('drops a redelivered step.run for a suspended step instead of re-executing it', async () => {
    const storage = new MockStore();
    const pubsub = new RedeliveryPubSub();

    const suspendPayload = { reason: 'needs-approval' };
    const step1Execute = vi.fn(async ({ suspend, resumeData }: any) => {
      if (!resumeData) {
        await suspend(suspendPayload);
        return {};
      }
      return { approved: resumeData.approved };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Execute,
      inputSchema: looseObject,
      outputSchema: looseObject,
    });
    const workflow = createWorkflow({
      id: 'suspended-redelivery-wf',
      inputSchema: looseObject,
      outputSchema: looseObject,
      steps: [step1],
    })
      .then(step1)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { [workflow.id]: workflow as any },
      pubsub,
    });
    await mastra.startWorkers();
    try {
      const runId = `suspended-redelivery-${Date.now()}`;
      const run = await workflow.createRun({ runId });
      const startResult = await run.start({ inputData: { value: 'go' } });
      expect(startResult.status).toBe('suspended');
      expect(step1Execute).toHaveBeenCalledTimes(1);

      const workflowsStore = (await storage.getStore('workflows'))!;
      const suspendedSnapshot = await workflowsStore.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
      });
      const suspendedRecord = (suspendedSnapshot!.context as any)?.step1;
      expect(suspendedRecord?.status).toBe('suspended');
      expect(suspendedRecord?.suspendPayload).toMatchObject(suspendPayload);

      // Replay the ORIGINAL (non-resume) step.run delivery, exactly as an
      // at-least-once transport would after a missed ack.
      const original = pubsub.captured.find(
        ({ event }) => (event.data as any)?.runId === runId && !((event.data as any)?.resumeSteps?.length > 0),
      );
      expect(original).toBeTruthy();

      pubsub.redeliver(original!.topic, original!.event);
      await new Promise(resolve => setTimeout(resolve, 50));

      // The step did not re-execute and the suspended record survived.
      expect(step1Execute).toHaveBeenCalledTimes(1);
      const afterSnapshot = await workflowsStore.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
      });
      const afterRecord = (afterSnapshot!.context as any)?.step1;
      expect(afterRecord?.status).toBe('suspended');
      expect(afterRecord?.suspendPayload).toMatchObject(suspendPayload);

      // The preserved suspendPayload still resumes cleanly.
      const resumeResult = await run.resume({ step: 'step1', resumeData: { approved: true } });
      expect(resumeResult.status).toBe('success');
      expect((resumeResult as any).result).toEqual({ approved: true });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('drops a redelivered step.run for a completed step instead of re-executing it', async () => {
    const storage = new MockStore();
    const pubsub = new RedeliveryPubSub();
    const step1Execute = vi.fn(async () => ({ value: 'once' }));

    const step1 = createStep({
      id: 'step1',
      execute: step1Execute,
      inputSchema: looseObject,
      outputSchema: looseObject,
    });
    const workflow = createWorkflow({
      id: 'completed-redelivery-wf',
      inputSchema: looseObject,
      outputSchema: looseObject,
      steps: [step1],
    })
      .then(step1)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { [workflow.id]: workflow as any },
      pubsub,
    });
    await mastra.startWorkers();
    try {
      const runId = `completed-redelivery-${Date.now()}`;
      const run = await workflow.createRun({ runId });
      const result = await run.start({ inputData: { value: 'go' } });
      expect(result.status).toBe('success');
      expect(step1Execute).toHaveBeenCalledTimes(1);

      const original = pubsub.captured.find(
        ({ event }) => event.type === 'workflow.step.run' && (event.data as any)?.runId === runId,
      );
      expect(original).toBeTruthy();

      const workflowsStore = (await storage.getStore('workflows'))!;
      pubsub.redeliver(original!.topic, original!.event);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(step1Execute).toHaveBeenCalledTimes(1);
      const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId });
      expect((snapshot!.context as any)?.step1?.status).toBe('success');
      expect((snapshot!.context as any)?.step1?.output).toEqual({ value: 'once' });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('drops a successor step.run republished by a redelivered step.end', async () => {
    const storage = new MockStore();
    const pubsub = new RedeliveryPubSub();
    const step1Execute = vi.fn(async () => ({ value: 'first' }));
    const step2Execute = vi.fn(async () => ({ value: 'second' }));
    const step1 = createStep({
      id: 'step1',
      execute: step1Execute,
      inputSchema: looseObject,
      outputSchema: looseObject,
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Execute,
      inputSchema: looseObject,
      outputSchema: looseObject,
    });
    const workflow = createWorkflow({
      id: 'step-end-redelivery-wf',
      inputSchema: looseObject,
      outputSchema: looseObject,
      steps: [step1, step2],
    })
      .then(step1)
      .then(step2)
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { [workflow.id]: workflow as any },
      pubsub,
    });

    await mastra.startWorkers();
    try {
      const runId = `step-end-redelivery-${Date.now()}`;
      const run = await workflow.createRun({ runId });
      expect((await run.start({ inputData: { value: 'go' } })).status).toBe('success');
      expect(step1Execute).toHaveBeenCalledTimes(1);
      expect(step2Execute).toHaveBeenCalledTimes(1);

      const step1End = pubsub.captured.find(
        ({ event }) =>
          event.type === 'workflow.step.end' &&
          (event.data as any)?.runId === runId &&
          (event.data as any)?.executionPath?.[0] === 0,
      );
      expect(step1End).toBeTruthy();

      pubsub.redeliver(step1End!.topic, step1End!.event);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(step1Execute).toHaveBeenCalledTimes(1);
      expect(step2Execute).toHaveBeenCalledTimes(1);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
