import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MastraError } from '../../error';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/18807.
 *
 * Declaring `schedule` on a workflow promotes it to the evented execution
 * engine for *every* run, not just scheduler-fired ones. The evented engine
 * only makes progress once something consumes the `workflows` pubsub topic
 * (wired up by `mastra.startWorkers()`). On serverless deployers that never
 * call `startWorkers()`, a plain `createRun()` + `run.start()` call (e.g.
 * from a custom HTTP route) used to hang forever instead of failing.
 */
describe('EventedExecutionEngine — no event consumer', () => {
  const buildScheduledWorkflow = () => {
    const step = createStep({
      id: 'noop',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });

    return createWorkflow({
      id: 'scheduled-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      schedule: { cron: '*/15 * * * *' },
    })
      .then(step)
      .commit();
  };

  it('fails fast instead of hanging when startWorkers() was never called', async () => {
    const workflow = buildScheduledWorkflow();
    // eslint-disable-next-line no-new -- registers `workflow` with this Mastra instance as a side effect
    new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      pubsub: new EventEmitterPubSub(),
    });
    // Intentionally do NOT call `mastra.startWorkers()` — this mirrors a
    // serverless request handler (e.g. @mastra/deployer-vercel) that never
    // wires up the workflow event processor before a route calls
    // `run.start()`.

    const run = await workflow.createRun();

    await expect(run.start({ inputData: {} })).rejects.toThrow(/no event consumer is running/i);
  });

  it('throws a MastraError with the EVENTED_WORKFLOW_NO_EVENT_CONSUMER id', async () => {
    const workflow = buildScheduledWorkflow();
    // eslint-disable-next-line no-new -- registers `workflow` with this Mastra instance as a side effect
    new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      pubsub: new EventEmitterPubSub(),
    });

    const run = await workflow.createRun();

    await expect(run.start({ inputData: {} })).rejects.toMatchObject({
      id: 'EVENTED_WORKFLOW_NO_EVENT_CONSUMER',
    } satisfies Partial<MastraError>);
  });

  it('runs normally once startWorkers() has wired up a consumer', async () => {
    const workflow = buildScheduledWorkflow();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [workflow.id]: workflow },
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startWorkers();

    try {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: {} });
      expect(result.status).toBe('success');
    } finally {
      await mastra.stopWorkers();
    }
  });
});
