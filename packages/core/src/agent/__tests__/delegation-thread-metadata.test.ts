import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { DelegationStartResult } from '../agent.types';

function textStream(text: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: text },
    { type: 'text-end', id: 't' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ]);
}

function toolCallStream(toolName: string, input: Record<string, unknown>) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) },
    { type: 'tool-call', toolCallId: 'call-1', toolName, input: JSON.stringify(input) },
    { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ]);
}

function makeSubAgentModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text' as const, text: 'sub response' }],
      warnings: [],
    }),
    doStream: async () => ({ rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [], stream: textStream('sub') }),
  });
}

function makeSupervisorModel() {
  let step = 0;
  const call = { toolName: 'agent-subAgent', input: { prompt: 'do the thing' } };
  return new MockLanguageModelV2({
    doGenerate: async () => {
      step++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: step === 1 ? ('tool-calls' as const) : ('stop' as const),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content:
          step === 1
            ? [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-1',
                  toolName: call.toolName,
                  input: JSON.stringify(call.input),
                },
              ]
            : [{ type: 'text' as const, text: 'Done' }],
        warnings: [],
      };
    },
    doStream: async () => {
      step++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: step === 1 ? toolCallStream(call.toolName, call.input) : textStream('Done'),
      };
    },
  });
}

function setup(result?: DelegationStartResult) {
  const memory = new MockMemory();
  const subAgent = new Agent({
    id: 'subAgent',
    name: 'subAgent',
    description: 'A sub-agent',
    instructions: 'You are a sub-agent.',
    model: makeSubAgentModel(),
  });
  const supervisor = new Agent({
    id: 'supervisor',
    name: 'supervisor',
    instructions: 'You delegate.',
    model: makeSupervisorModel(),
    agents: { subAgent },
    memory,
  });
  const options = {
    memory: { thread: 'parent-thread', resource: 'user-1' },
    delegation: { onDelegationStart: () => result },
  };
  return { memory, supervisor, options };
}

async function childThreads(memory: MockMemory) {
  const { threads } = await memory.listThreads({ perPage: false });
  return threads.filter(t => t.id !== 'parent-thread');
}

describe('delegation threadMetadata (issue #24956)', () => {
  it('applies threadMetadata to the sub-agent thread on generate', async () => {
    const { memory, supervisor, options } = setup({ threadMetadata: { tenantId: 't1' } });
    await supervisor.generate('go', options);

    const { threads } = await memory.listThreads({ perPage: false, filter: { metadata: { tenantId: 't1' } } });
    expect(threads.length).toBe(1);
    expect(threads[0]!.id).not.toBe('parent-thread');
  });

  it('applies threadMetadata to the sub-agent thread on stream', async () => {
    const { memory, supervisor, options } = setup({ threadMetadata: { tenantId: 't2' } });
    const stream = await supervisor.stream('go', options);
    await stream.consumeStream();

    const { threads } = await memory.listThreads({ perPage: false, filter: { metadata: { tenantId: 't2' } } });
    expect(threads.length).toBe(1);
    expect(threads[0]!.id).not.toBe('parent-thread');
  });

  it('applies threadMetadata when the delegation is rejected', async () => {
    const { memory, supervisor, options } = setup({
      proceed: false,
      rejectionReason: 'no',
      threadMetadata: { tenantId: 't3' },
    });
    await supervisor.generate('go', options);

    const { threads } = await memory.listThreads({ perPage: false, filter: { metadata: { tenantId: 't3' } } });
    expect(threads.length).toBe(1);
  });

  it('does not add metadata when threadMetadata is not returned', async () => {
    const { memory, supervisor, options } = setup();
    await supervisor.generate('go', options);

    const children = await childThreads(memory);
    expect(children.length).toBeGreaterThan(0);
    for (const t of children) {
      expect(t.metadata?.tenantId).toBeUndefined();
    }
  });
});

describe('delegation threadMetadata on resume (issue #24956)', () => {
  function buildApprovalSubAgent() {
    return new Agent({
      id: 'sub-agent',
      name: 'Sub Agent',
      description: 'Processes a single order.',
      instructions: 'Process the order by calling process-order.',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          const done = JSON.stringify(prompt).includes('"processed"');
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: done
              ? textStream('Processed.')
              : convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'sub', modelId: 'mock', timestamp: new Date(0) },
                  { type: 'tool-call', toolCallId: 'tc-1', toolName: 'process-order', input: '{"orderId":"o1"}' },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  },
                ]),
          };
        },
      }),
      tools: {
        processOrder: createTool({
          id: 'process-order',
          description: 'Process an order. Requires approval.',
          inputSchema: z.object({ orderId: z.string() }),
          requireApproval: true,
          execute: async ({ orderId }) => ({ orderId, processed: true }),
        }),
      },
    });
  }

  it('keeps the metadata from the first leg when the sub-agent resumes', async () => {
    const memory = new MockMemory();
    let step = 0;
    const supervisorModel = new MockLanguageModelV2({
      doStream: async () => {
        step++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream:
            step === 1
              ? convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'sup', modelId: 'mock', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallId: 'sup-tc-A',
                    toolName: 'agent-subAgent',
                    input: JSON.stringify({ prompt: 'Process order o1.', maxSteps: 3 }),
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  },
                ])
              : textStream('Done.'),
        };
      },
    });
    const sup = new Agent({
      id: 'supervisor',
      name: 'Supervisor',
      instructions: 'Delegate to the sub agent.',
      model: supervisorModel,
      agents: { subAgent: buildApprovalSubAgent() },
      memory,
    });
    const mastra = new Mastra({ agents: { supervisor: sup }, logger: false, storage: new InMemoryStore() });
    const supervisor = mastra.getAgent('supervisor');

    let delegationCalls = 0;
    const delegation = {
      onDelegationStart: (): DelegationStartResult => {
        delegationCalls++;
        return { threadMetadata: { tenantId: delegationCalls === 1 ? 'original' : 'replaced' } };
      },
    };

    const stream = await supervisor.stream('Process the order.', {
      maxSteps: 6,
      memory: { resource: 'r1', thread: 'parent-thread' },
      delegation,
    });
    const initial: any[] = [];
    for await (const c of stream.fullStream) initial.push(c);
    expect(initial.some(c => c.type === 'tool-call-approval')).toBe(true);

    const resumed = await supervisor.approveToolCall({ runId: stream.runId, toolCallId: 'sup-tc-A', delegation });
    const resumedChunks: any[] = [];
    for await (const c of resumed.fullStream) resumedChunks.push(c);
    expect(resumedChunks.filter(c => c.type === 'tool-error' || c.type === 'error')).toEqual([]);
    expect(resumedChunks.map(c => c.type)).toContain('tool-result');
    expect(delegationCalls).toBe(2);

    const children = await childThreads(memory);
    expect(children.length).toBe(1);
    expect(children[0]!.metadata?.tenantId).toBe('original');
  });
});
