import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

// `setState` keeps its whole-state contract on every storage version: it validates the value it is
// given and replaces the step's pending state. `updateState` merges the keys it is given into the
// state the step sees and validates the merged result.

async function run(
  workflow: ReturnType<typeof createWorkflow>,
  initialState: Record<string, unknown> = {},
): Promise<{ status: string; state: any; error?: any; steps: any }> {
  new Mastra({ logger: false, storage: new MockStore(), workflows: { workflow } });
  const started = await (
    await workflow.createRun()
  ).start({
    inputData: {},
    initialState,
    outputOptions: { includeState: true },
  });
  // A storage v2 result's `steps` is a loader.
  const steps = typeof started.steps === 'function' ? await (started.steps as () => Promise<unknown>)() : started.steps;
  return { ...started, steps } as any;
}

function oneWriteStepWorkflow({
  id,
  storageVersion,
  stateSchema,
  write,
}: {
  id: string;
  storageVersion: 1 | 2;
  stateSchema?: z.ZodTypeAny;
  write: (params: any) => Promise<unknown>;
}) {
  return createWorkflow({
    id,
    inputSchema: z.object({}),
    outputSchema: z.any(),
    ...(stateSchema ? { stateSchema } : {}),
    options: { storageVersion },
  })
    .then(
      createStep({
        id: 'write',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        ...(stateSchema ? { stateSchema } : {}),
        execute: write,
      } as any),
    )
    .commit();
}

describe.each([1, 2] as const)('step state writers on storage v%i', storageVersion => {
  it('validates only the value setState is given', async () => {
    const stateSchema = z.object({ a: z.number(), b: z.number() });
    const workflow = oneWriteStepWorkflow({
      id: `setstate-validates-given-v${storageVersion}`,
      storageVersion,
      stateSchema,
      write: async ({ setState }) => {
        await setState({ a: 2 } as any);
        return {};
      },
    });

    const result = await run(workflow, { a: 1, b: 2 });

    expect(result.status).toBe('failed');
    expect(result.error.message).toMatch(/Step state data validation failed/);
  });

  it('does not validate the state setState leaves behind', async () => {
    // Valid on its own (no `b` to compare against), invalid once merged with `b: 10`.
    const stateSchema = z
      .object({ a: z.number(), b: z.number().optional() })
      .refine(state => state.b === undefined || state.a <= state.b, { message: 'a must be <= b' });
    const workflow = oneWriteStepWorkflow({
      id: `setstate-skips-merged-v${storageVersion}`,
      storageVersion,
      stateSchema,
      write: async ({ setState }) => {
        await setState({ a: 20 } as any);
        return {};
      },
    });

    const result = await run(workflow, { a: 1, b: 10 });

    expect(result.status).toBe('success');
    expect(result.state).toEqual({ a: 20, b: 10 });
  });

  it("replaces the first setState call's pending state with the second", async () => {
    const stateSchema = z.object({ a: z.number(), b: z.number(), c: z.number().optional() });
    const workflow = oneWriteStepWorkflow({
      id: `setstate-replaces-v${storageVersion}`,
      storageVersion,
      stateSchema,
      write: async ({ setState }) => {
        await setState({ a: 2, b: 2, c: 9 } as any);
        await setState({ a: 3, b: 3 } as any);
        return {};
      },
    });

    const result = await run(workflow, { a: 1, b: 1, c: 1 });

    expect(result.status).toBe('success');
    // The second call never saw `c: 9`, so `c` keeps its initial value.
    expect(result.state).toEqual({ a: 3, b: 3, c: 1 });
  });

  it('merges the keys updateState is given and keeps the rest', async () => {
    const stateSchema = z.object({ a: z.number(), b: z.number(), c: z.number() });
    const workflow = oneWriteStepWorkflow({
      id: `updatestate-merges-v${storageVersion}`,
      storageVersion,
      stateSchema,
      write: async ({ updateState }) => {
        await updateState({ a: 5 });
        await updateState({ c: 9 });
        return {};
      },
    });

    const result = await run(workflow, { a: 1, b: 2, c: 3 });

    expect(result.status).toBe('success');
    expect(result.state).toEqual({ a: 5, b: 2, c: 9 });
  });

  it('rejects an update whose merged state breaks the schema', async () => {
    const stateSchema = z
      .object({ a: z.number(), b: z.number() })
      .refine(state => state.a <= state.b, { message: 'a must be <= b' });
    const workflow = oneWriteStepWorkflow({
      id: `updatestate-validates-merged-v${storageVersion}`,
      storageVersion,
      stateSchema,
      write: async ({ updateState }) => {
        await updateState({ a: 20 });
        return {};
      },
    });

    const result = await run(workflow, { a: 1, b: 10 });

    expect(result.status).toBe('failed');
    expect(result.error.message).toMatch(/a must be <= b/);
  });

  it('removes a key updateState is given as undefined', async () => {
    const workflow = oneWriteStepWorkflow({
      id: `updatestate-removes-v${storageVersion}`,
      storageVersion,
      write: async ({ updateState }) => {
        await updateState({ b: undefined });
        return {};
      },
    });

    const result = await run(workflow, { a: 1, b: 2 });

    expect(result.status).toBe('success');
    expect(result.state.b).toBeUndefined();
    expect(result.state).toEqual({ a: 1 });
  });
});
