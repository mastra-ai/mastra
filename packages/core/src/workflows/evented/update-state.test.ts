import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

// Evented `setState` merges without validating, as it always has. `updateState` merges and
// validates the merged state on both storage versions.

async function run(workflow: { createRun: () => Promise<any> }, initialState: Record<string, unknown>) {
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { workflow: workflow as any },
    pubsub: new EventEmitterPubSub(),
  });
  await mastra.startWorkers();
  try {
    const result = await (await workflow.createRun()).start({ inputData: {}, initialState });
    // A storage v2 result's `steps` is a loader.
    return {
      ...result,
      steps: typeof result.steps === 'function' ? await result.steps() : result.steps,
    } as any;
  } finally {
    await mastra.stopWorkers();
  }
}

function readStep() {
  return createStep({
    id: 'read',
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async ({ getState }) => ({ ...(await getState()) }),
  });
}

describe.each([1, 2] as const)('evented step state writers on storage v%i', storageVersion => {
  it('merges the keys updateState is given', async () => {
    const stateSchema = z.object({ a: z.number(), b: z.number(), c: z.number() });
    const workflow = createWorkflow({
      id: `evented-updatestate-merges-v${storageVersion}`,
      inputSchema: z.object({}),
      outputSchema: z.any(),
      stateSchema,
      options: { storageVersion },
    })
      .then(
        createStep({
          id: 'write',
          inputSchema: z.object({}),
          outputSchema: z.any(),
          stateSchema,
          execute: async ({ updateState }) => {
            await updateState({ c: 9 });
            return {};
          },
        }),
      )
      .then(readStep())
      .commit();

    const result = await run(workflow, { a: 1, b: 10, c: 3 });

    expect(result.status).toBe('success');
    expect(result.steps.read.output).toStrictEqual({ a: 1, b: 10, c: 9 });
  });

  it('rejects an update whose merged state breaks the schema', async () => {
    const stateSchema = z
      .object({ a: z.number(), b: z.number() })
      .refine(state => state.a <= state.b, { message: 'a must be <= b' });
    const workflow = createWorkflow({
      id: `evented-updatestate-validates-merged-v${storageVersion}`,
      inputSchema: z.object({}),
      outputSchema: z.any(),
      stateSchema,
      options: { storageVersion },
    })
      .then(
        createStep({
          id: 'write',
          inputSchema: z.object({}),
          outputSchema: z.any(),
          stateSchema,
          execute: async ({ updateState }) => {
            await updateState({ a: 20 });
            return {};
          },
        }),
      )
      .then(readStep())
      .commit();

    const result = await run(workflow, { a: 1, b: 10 });

    expect(result.status).toBe('failed');
    expect(result.error.message).toMatch(/a must be <= b/);
  });

  it('still accepts a partial setState without validating it', async () => {
    const stateSchema = z.object({ a: z.number(), b: z.number() });
    const workflow = createWorkflow({
      id: `evented-setstate-partial-v${storageVersion}`,
      inputSchema: z.object({}),
      outputSchema: z.any(),
      stateSchema,
      options: { storageVersion },
    })
      .then(
        createStep({
          id: 'write',
          inputSchema: z.object({}),
          outputSchema: z.any(),
          stateSchema,
          execute: async ({ setState }) => {
            await setState({ a: 2 } as any);
            return {};
          },
        }),
      )
      .then(readStep())
      .commit();

    const result = await run(workflow, { a: 1, b: 10 });

    expect(result.status).toBe('success');
    expect(result.steps.read.output).toStrictEqual({ a: 2, b: 10 });
  });
});
