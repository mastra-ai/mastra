import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
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
