/**
 * Round-trip: a stored graph containing every entry the workflow-builder
 * sub-agent is now allowed to emit — parallel, foreach, sleep, sleepUntil —
 * survives rehydrateWorkflow and produces a runnable Workflow whose live
 * stepFlow re-serializes back to the same JSON.
 *
 * This locks in the "engine supports what the sub-agent prompt advertises"
 * invariant. If a future engine change tightens what toStorableGraph accepts,
 * or a rehydrate case regresses, this test fails.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { rehydrateWorkflow, toStorableGraph } from '../load-from-storage';
import type { SerializedStepFlowEntry } from '../types';

const echoTool = createTool({
  id: 'echo-tool',
  description: 'Echoes a string',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ echoed: z.string() }),
  execute: async ({ value }) => ({ echoed: value }),
});

const upperTool = createTool({
  id: 'upper-tool',
  description: 'Uppercases a string',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ upper: z.string() }),
  execute: async ({ value }) => ({ upper: value.toUpperCase() }),
});

describe('rehydrate static subset — parallel / foreach / sleep / sleepUntil', () => {
  it('rehydrates every emittable container-entry type and round-trips back to JSON', async () => {
    const future = new Date(Date.UTC(2099, 0, 1));
    const storedGraph: SerializedStepFlowEntry[] = [
      {
        type: 'parallel',
        steps: [
          { type: 'tool', id: 'echo-tool', toolId: 'echo-tool' },
          { type: 'tool', id: 'upper-tool', toolId: 'upper-tool' },
        ],
      },
      {
        type: 'foreach',
        step: { id: 'echo-tool', description: 'Echoes a string' } as any,
        opts: { concurrency: 3 },
      },
      { type: 'sleep', id: 'wait-a-bit', duration: 1234 },
      { type: 'sleepUntil', id: 'wait-until-y2100', date: future },
    ];

    const mastra = new Mastra({
      logger: false,
      tools: { 'echo-tool': echoTool, 'upper-tool': upperTool } as any,
      storage: new InMemoryStore({ id: 'rehydrate-static-subset' }),
    });

    const { workflow } = await rehydrateWorkflow(
      {
        id: 'static-subset-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
        outputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
        graph: JSON.parse(JSON.stringify(storedGraph)),
      },
      mastra,
    );

    // 1) rehydration produced a Workflow whose stepFlow entries match, in order.
    const liveEntryTypes = (workflow.stepGraph as Array<{ type: string }>).map(e => e.type);
    expect(liveEntryTypes).toEqual(['parallel', 'foreach', 'sleep', 'sleepUntil']);

    // 2) round-trip live → storable → JSON preserves every discriminant.
    const reserialized = toStorableGraph(workflow.stepGraph);
    expect(() => JSON.parse(JSON.stringify(reserialized))).not.toThrow();

    const [parallel, foreach, sleep, sleepUntil] = reserialized;

    expect(parallel).toMatchObject({
      type: 'parallel',
      steps: [
        { type: 'tool', toolId: 'echo-tool' },
        { type: 'tool', toolId: 'upper-tool' },
      ],
    });

    expect(foreach).toMatchObject({
      type: 'foreach',
      step: { id: 'echo-tool' },
      opts: { concurrency: 3 },
    });

    // sleep / sleepUntil re-serialize with an engine-assigned id (the builder's
    // .sleep() / .sleepUntil() APIs don't accept a custom id); the important
    // invariants are the discriminant and the literal duration / date.
    expect(sleep).toMatchObject({ type: 'sleep', duration: 1234 });

    expect((sleepUntil as any).type).toBe('sleepUntil');
    const sleepUntilDate = (sleepUntil as any).date;
    const asDate = sleepUntilDate instanceof Date ? sleepUntilDate : new Date(sleepUntilDate);
    expect(asDate.toISOString()).toBe(future.toISOString());
  });

  it('rejects conditional and loop entries at rehydrate time (not silently)', async () => {
    const mastra = new Mastra({
      logger: false,
      tools: { 'echo-tool': echoTool } as any,
      storage: new InMemoryStore({ id: 'rehydrate-rejects' }),
    });

    await expect(
      rehydrateWorkflow(
        {
          id: 'rejects-wf',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
          graph: [
            {
              type: 'conditional',
              steps: [{ type: 'tool', id: 'echo-tool', toolId: 'echo-tool' }],
              serializedConditions: [{ id: 'c1', fn: 'true' }],
            } as any,
          ],
        },
        mastra,
      ),
    ).rejects.toThrow(/predicate DSL/);

    await expect(
      rehydrateWorkflow(
        {
          id: 'rejects-wf-2',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
          graph: [
            {
              type: 'loop',
              step: { id: 'echo-tool' } as any,
              serializedCondition: { id: 'c1', fn: 'true' },
              loopType: 'dowhile',
            } as any,
          ],
        },
        mastra,
      ),
    ).rejects.toThrow(/predicate DSL/);
  });
});
