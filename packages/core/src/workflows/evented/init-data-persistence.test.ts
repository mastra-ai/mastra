import { describe, it, expect, afterAll } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

/**
 * Regression tests for the `context.input` (getInitData) seed on the evented
 * engine when `shouldPersistSnapshot` opts out of persisting the `running`
 * status — the initial `running` snapshot is the only full-snapshot write that
 * records `input`, so without preservation logic every step.end that reloads
 * stepResults from storage (and every resume that rehydrates from the
 * suspended snapshot) loses it. This is exactly the persistence policy durable
 * agents use (persist `running` only when crash recovery is enabled).
 */
describe('evented engine: getInitData with shouldPersistSnapshot opting out of running', () => {
  // Never persist `running` — pending/suspended still persist (durable-agent shape).
  const shouldPersistSnapshot = ({ workflowStatus }: { workflowStatus: string }) => workflowStatus !== 'running';

  const echo = createStep({
    id: 'echo',
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async ({ inputData }) => inputData,
  });

  const approval = createStep({
    id: 'approval',
    inputSchema: z.any(),
    outputSchema: z.any(),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) {
        return suspend({});
      }
      return inputData;
    },
  });

  const pubsub = new EventEmitterPubSub();

  const inner = createWorkflow({
    id: 'inner-wf',
    inputSchema: z.any(),
    outputSchema: z.any(),
    options: { shouldPersistSnapshot, allowUnclaimedResumes: true },
  })
    .map(async ({ inputData }) => [inputData.a, inputData.b], { id: 'to-array' })
    .foreach(echo, { concurrency: () => 2 })
    .then(approval)
    .map(
      async ({ inputData, getInitData }) => {
        const init = getInitData() as any;
        return { items: inputData, initRunId: init?.runId };
      },
      { id: 'collect' },
    )
    .commit();

  const outer = createWorkflow({
    id: 'outer-wf',
    inputSchema: z.any(),
    outputSchema: z.any(),
    options: { shouldPersistSnapshot, allowUnclaimedResumes: true },
  })
    .map(async ({ inputData }) => inputData, { id: 'init' })
    .dowhile(inner, async () => false)
    .map(async ({ inputData, getInitData }) => ({ ...inputData, outerInitRunId: (getInitData() as any)?.runId }), {
      id: 'finalize',
    })
    .commit();

  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    pubsub,
    workflows: { 'outer-wf': outer as any },
  });

  afterAll(async () => {
    await mastra.stopWorkers();
    await pubsub.close();
  });

  it('preserves the input seed across steps and through suspend/resume', async () => {
    await mastra.startWorkers();
    const run = await outer.createRun({});
    const suspended = await run.start({ inputData: { runId: 'r1', a: 1, b: 2 } });
    expect(suspended.status).toBe('suspended');

    const result = await run.resume({ resumeData: { approved: true } });
    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ items: [1, 2], initRunId: 'r1', outerInitRunId: 'r1' });
  }, 20000);
});
