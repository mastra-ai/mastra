import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';

function makeStreamingModel(text: string) {
  const doStream = vi.fn().mockImplementation(async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: text },
      { type: 'text-end', id: 'text-1' },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
    ]),
  }));

  const model = new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      text,
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream,
  });

  return { model, doStream };
}

/**
 * Validates that `agent.stream([])` — called with no new user messages — re-enters
 * the agentic loop driven purely by whatever is in memory. This is the primitive
 * we'll use for Phase 2: when a background task completes and its result has
 * been injected into memory, calling `stream([])` causes the LLM to process it
 * without waiting for a user message.
 */
describe('Agent.stream([]) — continuation from memory', () => {
  it('re-enters the loop with no new user input and sees prior history from memory', async () => {
    const memory = new MockMemory();
    const { model, doStream } = makeStreamingModel('Second response');

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model,
      memory,
    });

    // First turn: normal user message — this populates memory naturally.
    const first = await agent.stream('Tell me a joke', {
      memory: { thread: 'thread-1', resource: 'user-1' },
    });
    await first.consumeStream();

    expect(doStream).toHaveBeenCalledTimes(1);

    // Now re-enter with no new user input.
    const second = await agent.stream([], {
      memory: { thread: 'thread-1', resource: 'user-1' },
    });
    await second.consumeStream();

    // Model was called again
    expect(doStream).toHaveBeenCalledTimes(2);

    // The prompt for the second call contains the prior user message from memory —
    // i.e. memory recall happened and fed the LLM.
    const continuationPrompt = (doStream.mock.calls[1]![0] as any).prompt as Array<any>;
    const serialized = JSON.stringify(continuationPrompt);
    expect(serialized).toContain('Tell me a joke');
  });

  it('does NOT add a new user message when continuing', async () => {
    const memory = new MockMemory();
    const { model } = makeStreamingModel('Done.');

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test',
      model,
      memory,
    });

    await agent.stream('hello', {
      memory: { thread: 'thread-2', resource: 'user-1' },
    }).then(r => r.consumeStream());

    const before = await memory.recall({ threadId: 'thread-2', perPage: false });
    const userBefore = before.messages.filter(m => m.role === 'user').length;

    await agent.stream([], {
      memory: { thread: 'thread-2', resource: 'user-1' },
    }).then(r => r.consumeStream());

    const after = await memory.recall({ threadId: 'thread-2', perPage: false });
    const userAfter = after.messages.filter(m => m.role === 'user').length;
    const assistantAfter = after.messages.filter(m => m.role === 'assistant').length;

    expect(userAfter).toBe(userBefore);
    expect(assistantAfter).toBeGreaterThan(0);
  });

  it('persists the continuation assistant response to memory', async () => {
    const memory = new MockMemory();
    const { model } = makeStreamingModel('Continuation response text');

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test',
      model,
      memory,
    });

    await agent.stream('first turn', {
      memory: { thread: 'thread-3', resource: 'user-1' },
    }).then(r => r.consumeStream());

    await agent.stream([], {
      memory: { thread: 'thread-3', resource: 'user-1' },
    }).then(r => r.consumeStream());

    const { messages } = await memory.recall({ threadId: 'thread-3', perPage: false });
    const assistantTexts = messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => (m.content as any).parts)
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text);

    expect(assistantTexts).toContain('Continuation response text');
  });
});
