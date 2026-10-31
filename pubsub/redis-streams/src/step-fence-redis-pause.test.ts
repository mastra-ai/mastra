import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow, WorkflowEventProcessor } from '@mastra/core/workflows/evented';
import { createClient } from 'redis';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { REDIS_URL, waitFor } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

class CountedStepProcessor extends WorkflowEventProcessor {
  executions = 0;
  protected override async processWorkflowStepRun() {
    this.executions++;
    if (this.executions === 1) throw new Error('retry this delivery');
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('evented step fence with a paused Redis lease backend', () => {
  const originalTimeout = WorkflowEventProcessor.STEP_FENCE_ACQUIRE_TIMEOUT_MS;
  const inspector = createClient({ url: REDIS_URL });
  let pubsub: RedisStreamsPubSub | undefined;

  afterEach(async () => {
    WorkflowEventProcessor.STEP_FENCE_ACQUIRE_TIMEOUT_MS = originalTimeout;
    await pubsub?.close();
    if (inspector.isOpen) await inspector.quit();
  });

  it('runs unfenced during the Redis pause, releases the late grant, and executes the retry', async () => {
    await inspector.connect();
    const id = randomUUID();
    pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: `step-fence-pause-${id}` });
    const wf = createWorkflow({ id: 'wf', inputSchema: z.object({}), outputSchema: z.object({}) });
    wf.then(
      createStep({ id: 'slow', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }),
    ).commit();
    const mastra = new Mastra({ logger: false, storage: new InMemoryStore(), workflows: { wf }, pubsub });
    const processor = new CountedStepProcessor({ mastra });
    const event = {
      id: `step-${id}`,
      type: 'workflow.step.run',
      runId: `run-${id}`,
      createdAt: new Date(),
      deliveryAttempt: 1,
      data: {
        workflowId: 'wf',
        runId: `run-${id}`,
        executionPath: [0],
        stepResults: {},
        prevResult: { status: 'success', output: {} },
        activeStepsPath: {},
        resumeSteps: [],
        requestContext: {},
      },
    } as Parameters<WorkflowEventProcessor['handle']>[0];
    const fenceKey = `step-fence-pause-${id}:lease:workflow-step-run:${event.runId}:${event.id}`;

    // Establish the real writer connection before Redis stops processing commands.
    expect((await pubsub.acquireLease(`warm-${id}`, id, 1000)).acquired).toBe(true);
    WorkflowEventProcessor.STEP_FENCE_ACQUIRE_TIMEOUT_MS = 100;
    await inspector.sendCommand(['CLIENT', 'PAUSE', '1200', 'ALL']);
    const started = Date.now();
    const first = processor.handle(event);
    expect(
      await Promise.race([
        first,
        sleep(700).then(() => {
          throw new Error('the paused Redis backend blocked step execution');
        }),
      ]),
    ).toEqual({ ok: false, retry: true });
    expect(Date.now() - started).toBeLessThan(700);
    expect(processor.executions).toBe(1);

    // The queued SET NX PX executes when Redis resumes. The timed-out owner
    // must release that real fence, or the same delivery's retry gets dropped.
    await sleep(1250);
    await waitFor(async () => (await inspector.get(fenceKey)) === null, 2500);
    expect(await processor.handle({ ...event, deliveryAttempt: 2 })).toEqual({ ok: true });
    expect(processor.executions).toBe(2);
  });
});
