/**
 * Round-trip tests for the serialize/rehydrate pipeline in `workflows/stored`:
 * live workflow → toStorableGraph → JSON → rehydrateWorkflow → run.
 *
 * Covers the storable static subset (tool/agent/mapping/parallel/foreach/
 * sleep/sleepUntil), agent step options + structuredOutput schemas, declarative
 * predicates on conditional/loop entries, nested workflow references, and the
 * persistence paths (`Mastra.addStoredWorkflow`, boot-time rehydration).
 * Closure-valued options and closure predicates must hard-fail at serialize
 * time — silent loss would ship broken workflows unnoticed.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';
import { rehydrateWorkflow, toStorableGraph } from '../stored';
import type { SerializedStepFlowEntry } from '../types';
import { createStepFromTool } from '../workflow';

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

const doubleTool = createTool({
  id: 'double-tool',
  description: 'Doubles a number',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ doubled: z.number() }),
  execute: async ({ value }) => ({ doubled: value * 2 }),
});

// Same id as doubleTool but keeps `value` as the output key so it can chain.
const timesTwoTool = createTool({
  id: 'double-tool',
  description: 'doubles',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ value }) => ({ value: value * 2 }),
});

const plusOneTool = createTool({
  id: 'plus-one',
  description: 'adds 1',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ value }) => ({ value: value + 1 }),
});

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

const shoutTool = createTool({
  id: 'shout-tool',
  description: 'shouts',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ msg: z.string() }),
  execute: async ({ value }) => ({ msg: `HIGH:${value}` }),
});

const whisperTool = createTool({
  id: 'whisper-tool',
  description: 'whispers',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ msg: z.string() }),
  execute: async ({ value }) => ({ msg: `low:${value}` }),
});

const doubleStep = createStepFromTool(timesTwoTool as any) as any;
const plusOneStep = createStepFromTool(plusOneTool as any) as any;
const shoutStep = createStepFromTool(shoutTool as any) as any;
const whisperStep = createStepFromTool(whisperTool as any) as any;

function buildOriginalWorkflow() {
  return createWorkflow({
    id: 'round-trip-wf',
    description: 'tool → map(template)',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ message: z.string() }),
  })
    .tool(doubleTool)
    .map({
      message: { template: 'Doubled value is ${stepResults.double-tool.doubled}' },
    })
    .commit();
}

/** Simple nested workflow: value → +1 → value. Reusable across tests. */
function makeInnerWorkflow(id = 'inner-wf') {
  return createWorkflow({
    id,
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ value: z.number() }),
  })
    .then(plusOneStep)
    .commit();
}

describe('storage round-trip', () => {
  it('toStorableGraph emits a fully-JSON-safe shape (no functions, no truncation)', () => {
    const wf = buildOriginalWorkflow();
    const stored = toStorableGraph(wf.stepGraph);

    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ type: 'tool', toolId: 'double-tool' });

    const mapping = stored[1] as Extract<(typeof stored)[number], { type: 'mapping' }>;
    expect(mapping.type).toBe('mapping');
    // JSON-safe — round-trips through JSON.stringify/parse
    expect(() => JSON.parse(JSON.stringify(stored))).not.toThrow();
    // mapConfig contains the literal template (full, untruncated)
    const cfg = JSON.parse(mapping.mapConfig) as Record<string, any>;
    expect(cfg.message.template).toContain('${stepResults.double-tool.doubled}');
  });

  it('rehydrated workflow produces the same output as the original', async () => {
    // 1. Run the original on Mastra A
    const originalWorkflow = buildOriginalWorkflow();
    const mastraA = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      workflows: { 'round-trip-wf': originalWorkflow } as any,
      storage: new InMemoryStore({ id: 'a' }),
    });
    originalWorkflow.__registerMastra(mastraA);
    const originalRun = await mastraA.getWorkflow('round-trip-wf').createRun();
    const originalResult = await originalRun.start({ inputData: { value: 5 } });
    expect(originalResult.status).toBe('success');

    // 2. Serialize → JSON → rehydrate onto Mastra B (no workflow registered yet)
    const stored = toStorableGraph(buildOriginalWorkflow().stepGraph);
    const def = {
      id: 'round-trip-wf',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph: JSON.parse(JSON.stringify(stored)),
    };

    const mastraB = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      storage: new InMemoryStore({ id: 'b' }),
    });

    const { workflow: rehydrated } = await rehydrateWorkflow(def, mastraB);
    mastraB.addWorkflow(rehydrated, 'round-trip-wf');

    const rehydratedRun = await mastraB.getWorkflow('round-trip-wf').createRun();
    const rehydratedResult = await rehydratedRun.start({ inputData: { value: 5 } });

    expect(rehydratedResult.status).toBe('success');
    expect((rehydratedResult as any).result).toEqual((originalResult as any).result);
    expect((rehydratedResult as any).result.message).toBe('Doubled value is 10');
  });

  it('rehydrates mappings by local tool step id when it differs from the registered tool id', async () => {
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      storage: new InMemoryStore({ id: 'local-tool-step-mapping' }),
    });

    const { workflow } = await rehydrateWorkflow(
      {
        id: 'local-tool-step-mapping',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        outputSchema: { type: 'object', properties: { result: { type: 'number' } }, required: ['result'] },
        graph: [
          { type: 'tool', id: 'calculate', toolId: 'double-tool' },
          {
            type: 'mapping',
            id: 'output',
            mapConfig: JSON.stringify({ result: { step: 'calculate', path: 'doubled' } }),
          },
        ],
      },
      mastra,
    );
    mastra.addWorkflow(workflow, 'local-tool-step-mapping');

    const run = await mastra.getWorkflow('local-tool-step-mapping').createRun();
    const result = await run.start({ inputData: { value: 5 } });

    expect(result.status).toBe('success');
    expect((result as any).result).toEqual({ result: 10 });
  });

  it('rehydrates mappings by local agent step id when it differs from the registered agent id', async () => {
    const supportAgent = fixedResponseAgent('support-agent', 'resolved');
    const mastra = new Mastra({
      logger: false,
      agents: { supportAgent },
      storage: new InMemoryStore({ id: 'local-agent-step-mapping' }),
    });

    await expect(
      rehydrateWorkflow(
        {
          id: 'local-agent-step-mapping',
          inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
          outputSchema: { type: 'object', properties: { response: { type: 'string' } }, required: ['response'] },
          graph: [
            { type: 'agent', id: 'answer-request', agentId: 'support-agent' },
            {
              type: 'mapping',
              id: 'output',
              mapConfig: JSON.stringify({ response: { step: 'answer-request', path: 'text' } }),
            },
          ],
        },
        mastra,
      ),
    ).resolves.toBeDefined();
  });

  it('rejects nested workflow call-site ids that cannot be preserved by live rehydration', async () => {
    const inner = makeInnerWorkflow('inner-wf');
    const mastra = new Mastra({
      logger: false,
      workflows: { 'inner-wf': inner },
      storage: new InMemoryStore({ id: 'nested-call-site-identity' }),
    });

    // The rule is enforced by validation on the strict save path (rehydration
    // itself no longer re-validates).
    await expect(
      mastra.addStoredWorkflow({
        id: 'outer-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        graph: [
          {
            type: 'parallel',
            steps: [{ type: 'workflow', id: 'local-inner', workflowId: 'inner-wf' }],
          },
        ],
      }),
    ).rejects.toThrow(/id "local-inner" must match workflowId "inner-wf"/);
  });

  it('addStoredWorkflow persists + live-registers; loadStoredWorkflows brings it back on a fresh boot', async () => {
    const storage = new InMemoryStore({ id: 'fresh-store' });

    // First process: build, save via addStoredWorkflow, run.
    {
      const mastra = new Mastra({
        logger: false,
        tools: { 'double-tool': doubleTool } as any,
        storage,
      });
      const stored = toStorableGraph(buildOriginalWorkflow().stepGraph);
      await mastra.addStoredWorkflow({
        id: 'cli-built-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
        graph: JSON.parse(JSON.stringify(stored)),
      });
      // Immediately runnable — no startWorkers() call needed for the live path.
      const run = await mastra.getWorkflow('cli-built-wf').createRun();
      const result = await run.start({ inputData: { value: 7 } });
      expect(result.status).toBe('success');
      expect((result as any).result.message).toBe('Doubled value is 14');
    }

    // Second "process" (new Mastra, same storage): startWorkers() should
    // rehydrate and register the saved workflow automatically.
    {
      const mastra2 = new Mastra({
        logger: false,
        tools: { 'double-tool': doubleTool } as any,
        storage,
      });
      await mastra2.startWorkers();

      const wf = mastra2.getWorkflow('cli-built-wf');
      expect(wf).toBeDefined();

      const run = await wf.createRun();
      const result = await run.start({ inputData: { value: 9 } });
      expect(result.status).toBe('success');
      expect((result as any).result.message).toBe('Doubled value is 18');

      await mastra2.stopWorkers?.();
    }
  });
});

describe('rehydrate static subset — parallel / foreach / sleep / sleepUntil', () => {
  it('rehydrates every emittable container-entry type and round-trips back to JSON', async () => {
    const future = new Date(Date.UTC(2099, 0, 1));
    const storedGraph: SerializedStepFlowEntry[] = [
      {
        type: 'parallel',
        steps: [
          { type: 'tool', id: 'echo-left', toolId: 'echo-tool' },
          { type: 'tool', id: 'echo-right', toolId: 'echo-tool' },
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
        { type: 'tool', id: 'echo-left', toolId: 'echo-tool' },
        { type: 'tool', id: 'echo-right', toolId: 'echo-tool' },
      ],
    });

    expect(foreach).toMatchObject({
      type: 'foreach',
      step: { type: 'tool', toolId: 'echo-tool' },
      opts: { concurrency: 3 },
    });

    // sleep / sleepUntil keep the stored id through rehydration (they are
    // pushed directly, not re-created via .sleep()/.sleepUntil() which would
    // mint a fresh random id).
    expect(sleep).toMatchObject({ type: 'sleep', id: 'wait-a-bit', duration: 1234 });

    expect(sleepUntil).toMatchObject({ type: 'sleepUntil', id: 'wait-until-y2100' });
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

describe('rehydrate agent/tool step options', () => {
  it('round-trips agent structuredOutput.schema as JSON Schema and back to Zod', async () => {
    const agent = fixedResponseAgent('paths-agent', '[]');
    const mastra = new Mastra({
      logger: false,
      agents: { 'paths-agent': agent } as any,
      storage: new InMemoryStore({ id: 'rehydrate-agent-options-1' }),
    });

    const wf = createWorkflow({
      id: 'extract-paths-wf',
      inputSchema: z.object({ tree: z.string() }),
      outputSchema: z.array(z.string()),
    })
      .agent(agent, { structuredOutput: { schema: z.array(z.string()) } as any })
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    // JSON round-trip proves it's actually serializable.
    const jsonSafe = JSON.parse(JSON.stringify(stored));
    const [agentEntry] = jsonSafe;

    expect(agentEntry).toMatchObject({
      type: 'agent',
      agentId: 'paths-agent',
      outputSchema: { type: 'array', items: { type: 'string' } },
    });

    const { workflow } = await rehydrateWorkflow(
      {
        id: 'extract-paths-wf',
        inputSchema: { type: 'object', properties: { tree: { type: 'string' } }, required: ['tree'] },
        outputSchema: { type: 'array', items: { type: 'string' } },
        graph: jsonSafe,
      },
      mastra,
    );

    // The rehydrated step's outputSchema is the reconstructed Zod schema —
    // an array of strings, not the default `{ text: string }` object.
    const [rehydratedStep] = workflow.stepGraph as Array<{ type: string; step?: any }>;
    expect(rehydratedStep.type).toBe('agent');
    // Re-serializing yields the same JSON Schema, proving the Zod → JSON path
    // is stable across the round-trip.
    const reserialized = toStorableGraph(workflow.stepGraph);
    expect(reserialized[0]).toMatchObject({
      type: 'agent',
      outputSchema: { type: 'array', items: { type: 'string' } },
    });
  });

  it('round-trips retries and metadata on both agent and tool steps', async () => {
    const agent = fixedResponseAgent('a1', 'ok');
    const mastra = new Mastra({
      logger: false,
      agents: { a1: agent } as any,
      tools: { 'echo-tool': echoTool } as any,
      storage: new InMemoryStore({ id: 'rehydrate-agent-options-2' }),
    });

    const wf = createWorkflow({
      id: 'options-wf',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
    })
      .agent(agent, { retries: 3, metadata: { owner: 'billing' } } as any)
      .tool(echoTool, { retries: 5, metadata: { flaky: true } } as any)
      .commit();

    const stored = JSON.parse(JSON.stringify(toStorableGraph(wf.stepGraph)));
    expect(stored[0]).toMatchObject({
      type: 'agent',
      options: { retries: 3, metadata: { owner: 'billing' } },
    });
    expect(stored[1]).toMatchObject({
      type: 'tool',
      options: { retries: 5, metadata: { flaky: true } },
    });

    const { workflow } = await rehydrateWorkflow(
      {
        id: 'options-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
        outputSchema: {
          type: 'object',
          properties: { echoed: { type: 'string' } },
          required: ['echoed'],
        },
        graph: stored,
      },
      mastra,
    );

    // Re-serializing should still carry the same JSON-safe options bag.
    const reserialized = toStorableGraph(workflow.stepGraph);
    expect(reserialized[0]).toMatchObject({
      type: 'agent',
      options: { retries: 3, metadata: { owner: 'billing' } },
    });
    expect(reserialized[1]).toMatchObject({
      type: 'tool',
      options: { retries: 5, metadata: { flaky: true } },
    });
  });

  it('omits options and outputSchema when the step declares none', async () => {
    const agent = fixedResponseAgent('a2', 'ok');
    const mastra = new Mastra({
      logger: false,
      agents: { a2: agent } as any,
      storage: new InMemoryStore({ id: 'rehydrate-agent-options-3' }),
    });

    const wf = createWorkflow({
      id: 'bare-wf',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .agent(agent)
      .commit();

    const [entry] = JSON.parse(JSON.stringify(toStorableGraph(wf.stepGraph))) as any[];
    expect(entry).toMatchObject({ type: 'agent', agentId: 'a2' });
    expect(entry).not.toHaveProperty('outputSchema');
    expect(entry).not.toHaveProperty('options');

    // Rehydration doesn't crash and doesn't invent a `structuredOutput`.
    await expect(
      rehydrateWorkflow(
        {
          id: 'bare-wf',
          inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
          outputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
          graph: [entry],
        },
        mastra,
      ),
    ).resolves.toBeDefined();
  });

  it('hard-crashes when an agent step carries a closure-valued option (onFinish)', () => {
    const agent = fixedResponseAgent('a3', 'ok');
    const wf = createWorkflow({
      id: 'bad-onfinish-wf',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .agent(agent, { onFinish: () => {} } as any)
      .commit();

    expect(() => toStorableGraph(wf.stepGraph)).toThrow(/onFinish/);
  });

  it('hard-crashes when an agent step carries a function-valued scorers option', () => {
    const agent = fixedResponseAgent('a4', 'ok');
    const wf = createWorkflow({
      id: 'bad-scorers-wf',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .agent(agent, { scorers: (() => ({})) as any } as any)
      .commit();

    expect(() => toStorableGraph(wf.stepGraph)).toThrow(/scorers/);
  });

  it('hard-crashes when a tool step carries a closure-valued option (onChunk)', () => {
    const wf = createWorkflow({
      id: 'bad-tool-onchunk-wf',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
    })
      .tool(echoTool, { onChunk: () => {} } as any)
      .commit();

    expect(() => toStorableGraph(wf.stepGraph)).toThrow(/onChunk/);
  });
});

describe('predicate round-trip', () => {
  it('branch with declarative predicates round-trips and executes on rehydrated instance', async () => {
    const wf = createWorkflow({
      id: 'branch-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([
        [{ predicate: { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } } }, shoutStep],
        [{ predicate: { op: 'lte', left: { path: 'inputData.value' }, right: { literal: 10 } } }, whisperStep],
      ])
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const conditional = wire.find((e: any) => e.type === 'conditional');
    expect(conditional).toBeDefined();
    expect(conditional.predicates).toHaveLength(2);
    expect(conditional.predicates[0].op).toBe('gt');

    const mastraB = new Mastra({
      logger: false,
      tools: { 'shout-tool': shoutTool, 'whisper-tool': whisperTool } as any,
      storage: new InMemoryStore({ id: 'branch-b' }),
    });
    const { workflow } = await rehydrateWorkflow(
      {
        id: 'branch-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] } as any,
        outputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } as any,
        graph: wire,
      },
      mastraB,
    );
    mastraB.addWorkflow(workflow, 'branch-wf');

    const runHigh = await mastraB.getWorkflow('branch-wf').createRun();
    const high = await runHigh.start({ inputData: { value: 42 } });
    expect(high.status).toBe('success');

    const runLow = await mastraB.getWorkflow('branch-wf').createRun();
    const low = await runLow.start({ inputData: { value: 3 } });
    expect(low.status).toBe('success');
  });

  it('dountil with declarative predicate round-trips (serialize shape)', () => {
    const wf = createWorkflow({
      id: 'loop-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(plusOneStep)
      .dountil(plusOneStep, {
        predicate: { op: 'gte', left: { path: 'inputData.value' }, right: { literal: 5 } },
      })
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const loop = wire.find((e: any) => e.type === 'loop');
    expect(loop).toBeDefined();
    expect(loop.loopType).toBe('dountil');
    expect(loop.predicate.op).toBe('gte');
  });

  it('branch predicate reading stepResults.<id>.value routes correctly in a live run and after rehydrate', async () => {
    const wf = createWorkflow({
      id: 'stepresults-branch-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .then(plusOneStep)
      .branch([
        [{ predicate: { op: 'gt', left: { path: 'stepResults.plus-one.value' }, right: { literal: 10 } } }, shoutStep],
        [
          { predicate: { op: 'lte', left: { path: 'stepResults.plus-one.value' }, right: { literal: 10 } } },
          whisperStep,
        ],
      ])
      .commit();

    const mastraLive = new Mastra({
      logger: false,
      tools: { 'plus-one': plusOneTool, 'shout-tool': shoutTool, 'whisper-tool': whisperTool } as any,
      workflows: { 'stepresults-branch-wf': wf } as any,
      storage: new InMemoryStore({ id: 'stepresults-live' }),
    });

    // value 41 → plus-one → 42 → shout branch (predicate on stepResults.plus-one.value > 10)
    const runHigh = await mastraLive.getWorkflow('stepresults-branch-wf').createRun();
    const high = await runHigh.start({ inputData: { value: 41 } });
    expect(high.status).toBe('success');
    if (high.status === 'success') {
      // shout-tool ran, whisper-tool did not
      expect((high as any).steps['shout-tool']?.status).toBe('success');
      expect((high as any).steps['shout-tool']?.output?.msg).toBe('HIGH:42');
      expect((high as any).steps['whisper-tool']).toBeUndefined();
    }

    // value 2 → plus-one → 3 → whisper branch (predicate on stepResults.plus-one.value <= 10)
    const runLow = await mastraLive.getWorkflow('stepresults-branch-wf').createRun();
    const low = await runLow.start({ inputData: { value: 2 } });
    expect(low.status).toBe('success');
    if (low.status === 'success') {
      expect((low as any).steps['whisper-tool']?.status).toBe('success');
      expect((low as any).steps['whisper-tool']?.output?.msg).toBe('low:3');
      expect((low as any).steps['shout-tool']).toBeUndefined();
    }

    // Round-trip: serialize + rehydrate, then re-run the high branch
    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));

    const mastraRehydrated = new Mastra({
      logger: false,
      tools: { 'plus-one': plusOneTool, 'shout-tool': shoutTool, 'whisper-tool': whisperTool } as any,
      storage: new InMemoryStore({ id: 'stepresults-rehydrated' }),
    });
    const { workflow } = await rehydrateWorkflow(
      {
        id: 'stepresults-branch-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] } as any,
        outputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } as any,
        graph: wire,
      },
      mastraRehydrated,
    );
    mastraRehydrated.addWorkflow(workflow, 'stepresults-branch-wf');

    const rehRun = await mastraRehydrated.getWorkflow('stepresults-branch-wf').createRun();
    const reh = await rehRun.start({ inputData: { value: 41 } });
    expect(reh.status).toBe('success');
    if (reh.status === 'success') {
      expect((reh as any).steps['shout-tool']?.output?.msg).toBe('HIGH:42');
      expect((reh as any).steps['whisper-tool']).toBeUndefined();
    }
  });

  it('nested not(and(...)) predicate round-trips and evaluates in both directions', async () => {
    const nested = {
      op: 'not' as const,
      arg: {
        op: 'and' as const,
        args: [
          { op: 'gt' as const, left: { path: 'inputData.value' }, right: { literal: 10 } },
          { op: 'exists' as const, path: 'inputData.foo' },
        ],
      },
    };

    const wf = createWorkflow({
      id: 'nested-predicate-wf',
      inputSchema: z.object({ value: z.number(), foo: z.string().optional() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([
        [{ predicate: nested }, whisperStep],
        // The other branch: NOT(nested) — take the shout branch when the outer NOT is false
        [
          {
            predicate: {
              op: 'and',
              args: [
                { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } },
                { op: 'exists', path: 'inputData.foo' },
              ],
            },
          },
          shoutStep,
        ],
      ])
      .commit();

    // Live stepGraph carries the derived Studio label for the nested predicate
    const liveConditional = wf.serializedStepGraph.find((e: any) => e.type === 'conditional') as any;
    expect(liveConditional).toBeDefined();
    expect(liveConditional.serializedConditions[0].fn).toBeTruthy();
    expect(typeof liveConditional.serializedConditions[0].fn).toBe('string');
    expect(liveConditional.serializedConditions[0].fn.length).toBeGreaterThan(0);

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const conditional = wire.find((e: any) => e.type === 'conditional');
    expect(conditional).toBeDefined();
    // Nested shape survived JSON round-trip
    expect(conditional.predicates[0].op).toBe('not');
    expect(conditional.predicates[0].arg.op).toBe('and');
    expect(conditional.predicates[0].arg.args).toHaveLength(2);

    const mastraN = new Mastra({
      logger: false,
      tools: { 'shout-tool': shoutTool, 'whisper-tool': whisperTool } as any,
      storage: new InMemoryStore({ id: 'nested-pred' }),
    });
    const { workflow } = await rehydrateWorkflow(
      {
        id: 'nested-predicate-wf',
        inputSchema: {
          type: 'object',
          properties: { value: { type: 'number' }, foo: { type: 'string' } },
          required: ['value'],
        } as any,
        outputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } as any,
        graph: wire,
      },
      mastraN,
    );
    mastraN.addWorkflow(workflow, 'nested-predicate-wf');

    // value=42, foo present → inner and(...) is true → not(...) is false → whisper does NOT fire, shout DOES
    const runShout = await mastraN.getWorkflow('nested-predicate-wf').createRun();
    const shoutRes = await runShout.start({ inputData: { value: 42, foo: 'bar' } });
    expect(shoutRes.status).toBe('success');

    // value=3, foo missing → inner and(...) is false → not(...) is true → whisper fires
    const runWhisper = await mastraN.getWorkflow('nested-predicate-wf').createRun();
    const whisperRes = await runWhisper.start({ inputData: { value: 3 } });
    expect(whisperRes.status).toBe('success');
  });

  it('throws when branch uses a closure condition (unstorable)', () => {
    const wf = createWorkflow({
      id: 'closure-branch',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([[async ({ inputData }: { inputData: { value: number } }) => inputData.value > 10, shoutStep]])
      .commit();

    expect(() => toStorableGraph(wf.stepGraph)).toThrow(/closure predicates do not round-trip/);
  });

  it('throws when dowhile uses a closure condition (unstorable)', () => {
    const wf = createWorkflow({
      id: 'closure-loop',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(plusOneStep)
      .dowhile(plusOneStep, async ({ inputData }: { inputData: { value: number } }) => inputData.value < 5)
      .commit();

    expect(() => toStorableGraph(wf.stepGraph)).toThrow(/closure predicates do not round-trip/);
  });
});

describe('nested-workflow round-trip', () => {
  it('top-level .then(nestedWorkflow) serializes to type:"workflow" and rehydrates', async () => {
    const inner = makeInnerWorkflow();
    const outer = createWorkflow({
      id: 'outer-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(inner)
      .then(doubleStep)
      .commit();

    // Serialize to storable graph.
    const stored = toStorableGraph(outer.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));

    // The nested workflow entry must be declarative and reference by id,
    // with the nested graph inlined for Studio/API consumers.
    const nestedEntry = wire.find((e: any) => e.type === 'workflow');
    expect(nestedEntry).toBeDefined();
    expect(nestedEntry.workflowId).toBe('inner-wf');
    expect(nestedEntry.id).toBe('inner-wf');
    expect(Array.isArray(nestedEntry.serializedStepFlow)).toBe(true);
    expect(nestedEntry.serializedStepFlow.length).toBeGreaterThan(0);

    // The live wire graph (serializedStepGraph) also inlines the child flow.
    const liveNested = outer.serializedStepGraph.find((e: any) => e.type === 'workflow') as any;
    expect(liveNested?.serializedStepFlow?.length).toBeGreaterThan(0);

    // Rehydrate on a Mastra instance that already has the inner registered.
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      workflows: { 'inner-wf': inner },
      tools: { 'double-tool': timesTwoTool as any, 'plus-one': plusOneTool as any },
    });
    const { workflow: rehydrated } = await rehydrateWorkflow(
      {
        id: 'outer-wf',
        graph: wire,
        inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      } as any,
      mastra,
    );
    mastra.addWorkflow(rehydrated as any, 'outer-wf');

    const run = await (mastra as any).getWorkflow('outer-wf').createRun();
    const result = await run.start({ inputData: { value: 5 } });
    expect(result.status).toBe('success');
    // 5 → inner (+1 = 6) → double (×2 = 12).
    if (result.status === 'success') {
      expect((result.result as any).value).toBe(12);
    }
  });

  it('rehydrate throws when the referenced workflowId is not registered', async () => {
    const inner = makeInnerWorkflow('ghost-wf');
    const outer = createWorkflow({
      id: 'outer-ghost',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(inner)
      .commit();
    const stored = toStorableGraph(outer.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));

    const mastra = new Mastra({
      storage: new InMemoryStore(),
      tools: { 'plus-one': plusOneTool as any },
    });

    await expect(
      rehydrateWorkflow(
        {
          id: 'outer-ghost',
          graph: wire,
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
        } as any,
        mastra,
      ),
    ).rejects.toThrow(/ghost-wf/);
  });

  it('addStoredWorkflow rejects a nested workflow call-site id that differs from workflowId', async () => {
    const inner = makeInnerWorkflow('shared-child');
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      workflows: { 'shared-child': inner },
      tools: { 'plus-one': plusOneTool as any },
    });

    await expect(
      mastra.addStoredWorkflow({
        id: 'outer-mismatched-child',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        graph: [{ type: 'workflow', id: 'local-child', workflowId: 'shared-child' }],
      }),
    ).rejects.toThrow('Nested workflow step id "local-child" must match workflowId "shared-child"');
  });

  it('addStoredWorkflow rejects self-referencing (cycle)', async () => {
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      tools: { 'plus-one': plusOneTool as any },
    });

    await expect(
      mastra.addStoredWorkflow({
        id: 'self-cycle',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        graph: [
          // self-reference
          { type: 'workflow', id: 'self-cycle', workflowId: 'self-cycle' },
        ],
      } as any),
    ).rejects.toThrow(/refers to itself/);
  });

  it('addStoredWorkflow rejects missing nested workflow reference', async () => {
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      tools: { 'plus-one': plusOneTool as any },
    });

    await expect(
      mastra.addStoredWorkflow({
        id: 'has-missing',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        graph: [{ type: 'workflow', id: 'call-missing', workflowId: 'never-registered' }],
      } as any),
    ).rejects.toThrow(/never-registered/);
  });

  it('nested workflow inside .parallel() serializes each child as type:"workflow"', () => {
    const innerA = makeInnerWorkflow('inner-a');
    const innerB = makeInnerWorkflow('inner-b');
    const wf = createWorkflow({
      id: 'parallel-nested-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.any(),
    })
      .parallel([innerA, innerB])
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const parallelEntry = wire.find((e: any) => e.type === 'parallel');
    expect(parallelEntry).toBeDefined();
    expect(parallelEntry.steps).toHaveLength(2);
    expect(parallelEntry.steps[0]).toMatchObject({ type: 'workflow', workflowId: 'inner-a' });
    expect(parallelEntry.steps[1]).toMatchObject({ type: 'workflow', workflowId: 'inner-b' });
  });

  it('nested workflow inside .branch() (declarative predicate) serializes each branch as type:"workflow"', () => {
    const innerHigh = makeInnerWorkflow('inner-high');
    const innerLow = makeInnerWorkflow('inner-low');
    const wf = createWorkflow({
      id: 'conditional-nested-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.any(),
    })
      .branch([
        [{ predicate: { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } } }, innerHigh],
        [{ predicate: { op: 'lte', left: { path: 'inputData.value' }, right: { literal: 10 } } }, innerLow],
      ])
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const cond = wire.find((e: any) => e.type === 'conditional');
    expect(cond).toBeDefined();
    expect(cond.steps).toHaveLength(2);
    expect(cond.steps[0]).toMatchObject({ type: 'workflow', workflowId: 'inner-high' });
    expect(cond.steps[1]).toMatchObject({ type: 'workflow', workflowId: 'inner-low' });
  });

  it('nested workflow inside .foreach() serializes inner step as type:"workflow"', () => {
    const inner = createWorkflow({
      id: 'inner-foreach-body',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(plusOneStep)
      .commit();
    const wf = createWorkflow({
      id: 'foreach-nested-wf',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.any(),
    })
      .foreach(inner)
      .commit();
    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const foreach = wire.find((e: any) => e.type === 'foreach');
    expect(foreach).toBeDefined();
    expect(foreach.step).toMatchObject({ type: 'workflow', workflowId: 'inner-foreach-body' });
  });

  it('nested workflow inside .dountil() (declarative predicate) serializes inner step as type:"workflow"', () => {
    const inner = makeInnerWorkflow('inner-loop-body');
    const wf = createWorkflow({
      id: 'loop-nested-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .dountil(inner, { predicate: { op: 'gte', left: { path: 'inputData.value' }, right: { literal: 5 } } })
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const loop = wire.find((e: any) => e.type === 'loop');
    expect(loop).toBeDefined();
    expect(loop.step).toMatchObject({ type: 'workflow', workflowId: 'inner-loop-body' });
    expect(loop.loopType).toBe('dountil');
  });

  it('out-of-order boot: addStoredWorkflow accepts an already-registered nested ref after another stored def', async () => {
    // First register a stored workflow with no deps.
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      tools: { 'plus-one': plusOneTool as any, 'double-tool': timesTwoTool as any },
    });
    await mastra.addStoredWorkflow({
      id: 'leaf-stored',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      graph: [{ type: 'tool', id: 'plus', toolId: 'plus-one' }],
    } as any);
    // Then a second stored workflow referencing the first.
    await mastra.addStoredWorkflow({
      id: 'root-stored',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      graph: [
        { type: 'workflow', id: 'leaf-stored', workflowId: 'leaf-stored' },
        { type: 'tool', id: 'double', toolId: 'double-tool' },
      ],
    } as any);
    const root = (mastra as any).getWorkflow('root-stored');
    expect(root).toBeDefined();
    const run = await root.createRun();
    const result = await run.start({ inputData: { value: 4 } });
    expect(result.status).toBe('success');
    // 4 → leaf (+1 = 5) → double (×2 = 10).
    if (result.status === 'success') {
      expect((result.result as any).value).toBe(10);
    }
  });

  it('addStoredWorkflow accepts + registers a nested reference to an already-registered workflow', async () => {
    const inner = makeInnerWorkflow('inner-persist');
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      workflows: { 'inner-persist': inner },
      tools: { 'plus-one': plusOneTool as any, 'double-tool': timesTwoTool as any },
    });

    await mastra.addStoredWorkflow({
      id: 'outer-persist',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      graph: [
        { type: 'workflow', id: 'inner-persist', workflowId: 'inner-persist' },
        { type: 'tool', id: 'double', toolId: 'double-tool' },
      ],
    } as any);

    const registered = (mastra as any).getWorkflow('outer-persist');
    expect(registered).toBeDefined();
    const run = await registered.createRun();
    const result = await run.start({ inputData: { value: 3 } });
    expect(result.status).toBe('success');
    // 3 → inner (+1 = 4) → double (×2 = 8).
    if (result.status === 'success') {
      expect((result.result as any).value).toBe(8);
    }
  });
});

describe('inner-entry options + re-serialize idempotency', () => {
  const summarySchema = {
    type: 'object',
    properties: { summary: { type: 'string' } },
    required: ['summary'],
  } as const;

  it('parallel inner agent/tool entries preserve outputSchema, retries and metadata through the round-trip', async () => {
    const agent = fixedResponseAgent('par-agent', '{"summary":"ok"}');
    const mastra = new Mastra({
      logger: false,
      agents: { 'par-agent': agent } as any,
      tools: { 'echo-tool': echoTool } as any,
      storage: new InMemoryStore({ id: 'parallel-inner-options' }),
    });

    const storedGraph: SerializedStepFlowEntry[] = [
      {
        type: 'parallel',
        steps: [
          {
            type: 'agent',
            id: 'summarize',
            agentId: 'par-agent',
            outputSchema: summarySchema,
            options: { retries: 2, metadata: { owner: 'billing' } },
          },
          {
            type: 'tool',
            id: 'echo-step',
            toolId: 'echo-tool',
            options: { retries: 4, metadata: { flaky: true } },
          },
        ],
      } as any,
    ];

    const { workflow } = await rehydrateWorkflow(
      {
        id: 'parallel-options-wf',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        graph: JSON.parse(JSON.stringify(storedGraph)),
      },
      mastra,
    );

    // The live entries stay declarative — options live on the entry itself,
    // not on a hand-cloned fake Step.
    const [parallel] = workflow.stepGraph as any[];
    expect(parallel.type).toBe('parallel');
    expect(parallel.steps[0]).toMatchObject({
      type: 'agent',
      id: 'summarize',
      agentId: 'par-agent',
      options: { retries: 2, metadata: { owner: 'billing' } },
    });
    expect(parallel.steps[1]).toMatchObject({
      type: 'tool',
      id: 'echo-step',
      toolId: 'echo-tool',
      options: { retries: 4, metadata: { flaky: true } },
    });

    // Re-serialize: nothing was dropped (a prior resolver implementation lost all of this).
    const [reserialized] = JSON.parse(JSON.stringify(toStorableGraph(workflow.stepGraph)));
    expect(reserialized.steps[0]).toMatchObject({
      type: 'agent',
      id: 'summarize',
      agentId: 'par-agent',
      outputSchema: summarySchema,
      options: { retries: 2, metadata: { owner: 'billing' } },
    });
    expect(reserialized.steps[1]).toMatchObject({
      type: 'tool',
      id: 'echo-step',
      toolId: 'echo-tool',
      options: { retries: 4, metadata: { flaky: true } },
    });
  });

  it('branch inner agent/tool entries preserve options through the round-trip (with predicates intact)', async () => {
    const agent = fixedResponseAgent('branch-agent', '{"summary":"ok"}');
    const mastra = new Mastra({
      logger: false,
      agents: { 'branch-agent': agent } as any,
      tools: { 'echo-tool': echoTool } as any,
      storage: new InMemoryStore({ id: 'branch-inner-options' }),
    });

    const predicates = [
      { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } },
      { op: 'lte', left: { path: 'inputData.value' }, right: { literal: 10 } },
    ];
    const serializedConditions = [
      { id: 'hot-path-condition', fn: 'inputData.value > 10' },
      { id: 'cold-path-condition', fn: 'inputData.value <= 10' },
    ];
    const storedGraph: SerializedStepFlowEntry[] = [
      {
        type: 'conditional',
        steps: [
          {
            type: 'agent',
            id: 'hot-path',
            agentId: 'branch-agent',
            outputSchema: summarySchema,
            options: { retries: 3, metadata: { tier: 'hot' } },
          },
          { type: 'tool', id: 'cold-path', toolId: 'echo-tool', options: { retries: 1 } },
        ],
        predicates,
        serializedConditions,
      } as any,
    ];

    const { workflow } = await rehydrateWorkflow(
      {
        id: 'branch-options-wf',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        graph: JSON.parse(JSON.stringify(storedGraph)),
      },
      mastra,
    );

    const [reserialized] = JSON.parse(JSON.stringify(toStorableGraph(workflow.stepGraph)));
    expect(reserialized).toMatchObject({ type: 'conditional', predicates, serializedConditions });
    expect(reserialized.steps[0]).toMatchObject({
      type: 'agent',
      id: 'hot-path',
      agentId: 'branch-agent',
      outputSchema: summarySchema,
      options: { retries: 3, metadata: { tier: 'hot' } },
    });
    expect(reserialized.steps[1]).toMatchObject({
      type: 'tool',
      id: 'cold-path',
      toolId: 'echo-tool',
      options: { retries: 1 },
    });
  });

  it('store → rehydrate → re-store is deep-equal for a graph covering every storable entry kind', async () => {
    const inner = makeInnerWorkflow('idem-inner');
    const agent = fixedResponseAgent('idem-agent', 'ok');

    // The chained step outputs deliberately don't type-flow into each other —
    // this test only exercises the serialize/rehydrate pipeline, not execution.
    const wf = (
      createWorkflow({
        id: 'idem-wf',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      }) as any
    )
      .tool(timesTwoTool as any, { retries: 2, metadata: { team: 'infra' } })
      .agent(agent, { retries: 1, metadata: { owner: 'ops' } })
      .map({ note: { template: 'v=${inputData.value}' } } as any)
      .parallel([shoutStep, whisperStep])
      .branch([
        [{ predicate: { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } } }, shoutStep],
        [{ predicate: { op: 'lte', left: { path: 'inputData.value' }, right: { literal: 10 } } }, whisperStep],
      ])
      .dountil(plusOneStep, {
        predicate: { op: 'gte', left: { path: 'inputData.value' }, right: { literal: 5 } },
      })
      .foreach(plusOneStep, { concurrency: 2 })
      .sleep(500)
      .sleepUntil(new Date(Date.UTC(2099, 0, 1)))
      .then(inner)
      .commit();

    const stored = JSON.parse(JSON.stringify(toStorableGraph(wf.stepGraph)));

    const mastra = new Mastra({
      logger: false,
      agents: { 'idem-agent': agent } as any,
      tools: {
        'double-tool': timesTwoTool,
        'shout-tool': shoutTool,
        'whisper-tool': whisperTool,
        'plus-one': plusOneTool,
      } as any,
      workflows: { 'idem-inner': inner },
      storage: new InMemoryStore({ id: 'idem' }),
    });

    const { workflow } = await rehydrateWorkflow(
      {
        id: 'idem-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        graph: stored,
      },
      mastra,
    );

    // This is the invariant Studio depends on (save → load → save must not
    // drift), and the property the old `__agentRef` laundering existed to
    // preserve. The direct-entry path must preserve it too — exactly.
    const restored = JSON.parse(JSON.stringify(toStorableGraph(workflow.stepGraph)));
    expect(restored).toEqual(stored);
  });
});
