import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../create';
import { createStep as createDefaultStep } from '../workflow';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '.';

// Issue #29759: the evented engine stored the last step's result record as the run's
// `result` instead of the workflow output, and stored a step record on suspend too.
const engines = [
  { name: 'default', createStep: createDefaultStep, createWorkflow: createDefaultWorkflow },
  { name: 'evented', createStep: createEventedStep, createWorkflow: createEventedWorkflow },
] as const;

const schema = z.object({ x: z.number() });

describe.each(engines)('stored run result ($name engine)', ({ name, createStep, createWorkflow }) => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.stopWorkers();
    mastra = undefined;
  });

  function setup() {
    const add = (createStep as typeof createDefaultStep)({
      id: 'add',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => ({ x: inputData.x + 2 }),
    });
    const wait = (createStep as typeof createDefaultStep)({
      id: 'wait',
      inputSchema: schema,
      outputSchema: schema,
      resumeSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) return suspend({ why: 1 });
        return inputData;
      },
    });
    const done = (createWorkflow as typeof createDefaultWorkflow)({
      id: `${name}-done`,
      inputSchema: schema,
      outputSchema: schema,
    })
      .then(add)
      .commit();
    const suspending = (createWorkflow as typeof createDefaultWorkflow)({
      id: `${name}-suspending`,
      inputSchema: schema,
      outputSchema: schema,
    })
      .then(add)
      .then(wait)
      .commit();

    mastra = new Mastra({
      workflows: { [done.id]: done, [suspending.id]: suspending },
      storage: new MockStore(),
      pubsub: new EventEmitterPubSub(),
      logger: false,
    });
    return { done: mastra.getWorkflow(done.id), suspending: mastra.getWorkflow(suspending.id) };
  }

  it('stores the workflow output as the result of a successful run', async () => {
    const { done } = setup();
    await mastra!.startWorkers();

    const run = await done.createRun();
    const result = await run.start({ inputData: { x: 2 } });
    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ x: 4 });

    const stored = await done.getWorkflowRunById(run.runId);
    expect(stored?.status).toBe('success');
    expect(stored?.result).toEqual({ x: 4 });
  });

  it('stores no result for a suspended run, and the output once it is resumed', async () => {
    const { suspending } = setup();
    await mastra!.startWorkers();

    const run = await suspending.createRun();
    const result = await run.start({ inputData: { x: 2 } });
    expect(result.status).toBe('suspended');

    const suspended = await suspending.getWorkflowRunById(run.runId);
    expect(suspended?.status).toBe('suspended');
    expect(suspended?.result).toBeUndefined();

    const resumed = await run.resume({ step: 'wait', resumeData: { ok: true } });
    expect(resumed.status).toBe('success');

    const stored = await suspending.getWorkflowRunById(run.runId);
    expect(stored?.status).toBe('success');
    expect(stored?.result).toEqual({ x: 4 });
  });
});
