/**
 * DurableAgent with `engine: 'evented'`.
 *
 * These tests run the durable agentic loop on the EventedExecutionEngine:
 * every step is dispatched through the workflows pubsub topic and executed by
 * the WorkflowEventProcessor wired up by `mastra.startWorkers()`. With the
 * in-process EventEmitterPubSub the dispatch mechanism is identical to a
 * dedicated OrchestrationWorker topology — only the process boundary differs
 * (see durable-agent-evented-two-process.test.ts for that).
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import type { DurableAgent } from '../durable-agent';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 7, outputTokens: 11, totalTokens: 18 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createToolCallThenTextModel(
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>,
  finalText: string,
) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            ...toolCalls.map((tc, i) => ({
              type: 'tool-call' as const,
              toolCallId: `call-${i + 1}`,
              toolName: tc.toolName,
              input: JSON.stringify(tc.args),
              providerExecuted: false,
            })),
            {
              type: 'finish' as const,
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

/** Always emits tool calls — used for maxSteps exhaustion. */
function createAlwaysToolCallModel(toolName: string) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call' as const,
            toolCallId: `call-${call}`,
            toolName,
            input: JSON.stringify({ n: call }),
            providerExecuted: false,
          },
          {
            type: 'finish' as const,
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

async function setupEvented({
  agent,
  maxSteps,
}: {
  agent: Agent<any, any, any>;
  maxSteps?: number;
}): Promise<{ durableAgent: DurableAgent<any, any, any>; mastra: Mastra; cleanup: () => Promise<void> }> {
  const pubsub = new EventEmitterPubSub();
  const durableAgent = createDurableAgent({ agent, engine: 'evented', maxSteps });
  const mastra = new Mastra({
    logger: process.env.DEBUG_EVENTED ? undefined : false,
    storage: new MockStore(),
    pubsub,
    agents: { [durableAgent.id]: durableAgent as any },
  });
  await mastra.startWorkers();
  return {
    durableAgent,
    mastra,
    cleanup: async () => {
      await mastra.stopWorkers();
      await pubsub.close();
    },
  };
}

describe('DurableAgent engine: evented (in-process pubsub)', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('workflow is built on the evented engine and registered as an internal workflow', async () => {
    const agent = new Agent({
      id: 'evented-engine-check',
      instructions: 'x',
      model: createTextModel('hi') as LanguageModelV2,
    });
    const setup = await setupEvented({ agent });
    cleanup = setup.cleanup;

    const wf = (setup.durableAgent as any).getWorkflow();
    expect(wf.constructor.name).toBe('EventedWorkflow');
    expect((setup.mastra as any).__hasInternalWorkflow(wf.id)).toBe(true);
  });

  it('streams a plain text turn through the evented engine', async () => {
    const agent = new Agent({
      id: 'evented-text-agent',
      instructions: 'Be brief.',
      model: createTextModel('Hello from the evented engine') as LanguageModelV2,
    });
    const setup = await setupEvented({ agent });
    cleanup = setup.cleanup;

    const { output, cleanup: streamCleanup } = await setup.durableAgent.stream('hi');
    const text = await output.text;
    const finishReason = await output.finishReason;
    streamCleanup?.();

    expect(text).toBe('Hello from the evented engine');
    expect(finishReason).toBe('stop');
  });

  it('generate() returns FullOutput with usage', async () => {
    const agent = new Agent({
      id: 'evented-generate-agent',
      instructions: 'Be brief.',
      model: createTextModel('generated') as LanguageModelV2,
    });
    const setup = await setupEvented({ agent });
    cleanup = setup.cleanup;

    const out = await setup.durableAgent.generate('hi');
    expect(out.text).toBe('generated');
    expect(out.finishReason).toBe('stop');
    expect(out.usage?.totalTokens).toBe(18);
  });

  it('executes a tool call and loops back to the LLM (dowhile + nested workflow)', async () => {
    const echoTool = createTool({
      id: 'echo',
      description: 'Echo',
      inputSchema: z.object({ message: z.string() }),
      execute: async ({ message }) => `Echo: ${message}`,
    });
    const agent = new Agent({
      id: 'evented-tool-agent',
      instructions: 'Use tools.',
      model: createToolCallThenTextModel([{ toolName: 'echo', args: { message: 'hi' } }], 'Tool done') as any,
      tools: { echo: echoTool },
    });
    const setup = await setupEvented({ agent });
    cleanup = setup.cleanup;

    const out = await setup.durableAgent.generate('use echo');
    expect(out.text).toBe('Tool done');
    expect(out.steps?.length).toBe(2);
    const toolResults = out.steps?.[0]?.toolResults as any[];
    expect(toolResults?.[0]?.payload?.result ?? toolResults?.[0]?.result).toContain('Echo: hi');
  });

  it('executes parallel tool calls via foreach with dynamic concurrency', async () => {
    const executed: string[] = [];
    const toolA = createTool({
      id: 'toolA',
      description: 'A',
      inputSchema: z.object({}),
      execute: async () => {
        executed.push('A');
        return 'A-result';
      },
    });
    const toolB = createTool({
      id: 'toolB',
      description: 'B',
      inputSchema: z.object({}),
      execute: async () => {
        executed.push('B');
        return 'B-result';
      },
    });
    const agent = new Agent({
      id: 'evented-parallel-tools-agent',
      instructions: 'Use tools.',
      model: createToolCallThenTextModel(
        [
          { toolName: 'toolA', args: {} },
          { toolName: 'toolB', args: {} },
        ],
        'Both done',
      ) as any,
      tools: { toolA, toolB },
    });
    const setup = await setupEvented({ agent });
    cleanup = setup.cleanup;

    const out = await setup.durableAgent.generate('use both tools');
    expect(out.text).toBe('Both done');
    expect(executed.sort()).toEqual(['A', 'B']);
    expect(out.steps?.[0]?.toolResults?.length).toBe(2);
  });

  it('stops at maxSteps when the model keeps requesting tools', async () => {
    const loopTool = createTool({
      id: 'loopTool',
      description: 'Loop',
      inputSchema: z.object({ n: z.number() }),
      execute: async ({ n }) => `iteration-${n}`,
    });
    const agent = new Agent({
      id: 'evented-maxsteps-agent',
      instructions: 'Loop forever.',
      model: createAlwaysToolCallModel('loopTool') as any,
      tools: { loopTool },
    });
    const setup = await setupEvented({ agent, maxSteps: 2 });
    cleanup = setup.cleanup;

    const out = await setup.durableAgent.generate('go');
    expect(out.steps?.length).toBe(2);
  });

  it('suspends on tool approval and resumes to completion', async () => {
    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search',
      inputSchema: z.object({ query: z.string() }),
      execute: async () => ({ results: ['mastra'] }),
    });
    const agent = new Agent({
      id: 'evented-approval-agent',
      instructions: 'Use search.',
      model: createToolCallThenTextModel([{ toolName: 'searchTool', args: { query: 'mastra' } }], 'Found it') as any,
      tools: { searchTool },
    });
    const setup = await setupEvented({ agent });
    cleanup = setup.cleanup;

    const first = await setup.durableAgent.generate('search', { requireToolApproval: true });
    expect(first.finishReason).toBe('suspended');

    const resumed = await setup.durableAgent.resumeGenerate(first.runId!, { approved: true });
    expect(resumed.text).toBe('Found it');
    expect(resumed.finishReason).toBe('stop');
  });
});
