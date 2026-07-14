/**
 * Round-trip: agent-step `structuredOutput.schema` (→ persisted as `outputSchema`)
 * and the JSON-safe subset of step options (`retries`, `metadata`) survive
 * `toStorableGraph` → JSON → `rehydrateWorkflow` and rebuild the same wiring on
 * the live workflow. Closure-valued options (`onFinish`, function `scorers`)
 * must hard-crash at serialize time — silent loss would let workflow authors
 * ship broken callbacks unnoticed.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';
import { rehydrateWorkflow, toStorableGraph } from '../load-from-storage';

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
