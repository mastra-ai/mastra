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
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { rehydrateWorkflow, toStorableGraph } from '../load-from-storage';
import type { SerializedStepFlowEntry } from '../types';

function fixedResponseAgent(id: string, response: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'stub',
    model: new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: response },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      }),
    }),
  });
}

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
        step: { type: 'tool', id: 'echo-tool', toolId: 'echo-tool' },
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
      step: { type: 'tool', toolId: 'echo-tool' },
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
    ).rejects.toThrow(/missing or mismatched predicates|declarative predicate/);

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
    ).rejects.toThrow(/missing declarative predicate|declarative predicate/);
  });

  it('preserves a foreach step id that differs from the underlying tool id', async () => {
    const mastra = new Mastra({
      logger: false,
      tools: { 'echo-tool': echoTool } as any,
      storage: new InMemoryStore({ id: 'rehydrate-foreach-mismatched-tool-id' }),
    });

    const storedGraph: SerializedStepFlowEntry[] = [
      {
        type: 'foreach',
        step: {
          type: 'tool',
          id: 'summarize-file',
          toolId: 'echo-tool',
          options: { retries: 2, metadata: { tag: 'per-file' } },
        },
        opts: { concurrency: 4 },
      },
    ];

    const { workflow } = await rehydrateWorkflow(
      {
        id: 'foreach-mismatched-tool-wf',
        inputSchema: { type: 'array', items: { type: 'object' } },
        outputSchema: { type: 'array', items: { type: 'object' } },
        graph: JSON.parse(JSON.stringify(storedGraph)),
      },
      mastra,
    );

    // Live entry preserves the stored step id, distinct from the tool id.
    const [foreachEntry] = workflow.stepGraph as Array<any>;
    expect(foreachEntry.type).toBe('foreach');
    expect(foreachEntry.step.id).toBe('summarize-file');

    // Re-serializing preserves the mismatched id + toolId + options.
    const [reserialized] = toStorableGraph(workflow.stepGraph) as any[];
    expect(reserialized).toMatchObject({
      type: 'foreach',
      opts: { concurrency: 4 },
      step: {
        type: 'tool',
        id: 'summarize-file',
        toolId: 'echo-tool',
        options: { retries: 2, metadata: { tag: 'per-file' } },
      },
    });
  });

  it('round-trips a foreach step whose body is an agent with a structured outputSchema', async () => {
    const agent = fixedResponseAgent('summarizer-agent', '{"summary":"ok"}');
    const mastra = new Mastra({
      logger: false,
      agents: { 'summarizer-agent': agent } as any,
      storage: new InMemoryStore({ id: 'rehydrate-foreach-agent' }),
    });

    const storedGraph: SerializedStepFlowEntry[] = [
      {
        type: 'foreach',
        step: {
          type: 'agent',
          id: 'summarize-each',
          agentId: 'summarizer-agent',
          outputSchema: {
            type: 'object',
            properties: { summary: { type: 'string' } },
            required: ['summary'],
          },
          options: { retries: 1 },
        },
        opts: { concurrency: 2 },
      },
    ];

    const { workflow } = await rehydrateWorkflow(
      {
        id: 'foreach-agent-wf',
        inputSchema: { type: 'array', items: { type: 'object' } },
        outputSchema: { type: 'array', items: { type: 'object' } },
        graph: JSON.parse(JSON.stringify(storedGraph)),
      },
      mastra,
    );

    const [foreachEntry] = workflow.stepGraph as Array<any>;
    expect(foreachEntry.type).toBe('foreach');
    expect(foreachEntry.step.id).toBe('summarize-each');

    // Re-serialize: outputSchema + agentId + options survive the round-trip.
    const [reserialized] = toStorableGraph(workflow.stepGraph) as any[];
    expect(reserialized).toMatchObject({
      type: 'foreach',
      opts: { concurrency: 2 },
      step: {
        type: 'agent',
        id: 'summarize-each',
        agentId: 'summarizer-agent',
        outputSchema: {
          type: 'object',
          properties: { summary: { type: 'string' } },
          required: ['summary'],
        },
        options: { retries: 1 },
      },
    });
  });

  it('rejects a foreach whose inner step is a mapping (mappings project, they do not execute)', async () => {
    const mastra = new Mastra({
      logger: false,
      tools: { 'echo-tool': echoTool } as any,
      storage: new InMemoryStore({ id: 'rehydrate-foreach-mapping' }),
    });

    await expect(
      rehydrateWorkflow(
        {
          id: 'foreach-mapping-wf',
          inputSchema: { type: 'array' },
          outputSchema: { type: 'array' },
          graph: [
            {
              type: 'foreach',
              step: { type: 'mapping', id: 'map-1', mapConfig: '{}' },
              opts: { concurrency: 1 },
            } as any,
          ],
        },
        mastra,
      ),
    ).rejects.toThrow(/mapping/i);
  });
});
