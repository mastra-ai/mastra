import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';

function buildStreamModel(opts: { chunks: string[]; chunkDelayMs?: number }) {
  const { chunks, chunkDelayMs = 5 } = opts;
  let index = 0;

  const allChunks = [
    { type: 'stream-start' as const, warnings: [] },
    { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'text-start' as const, id: 'text-1' },
    ...chunks.map(delta => ({ type: 'text-delta' as const, id: 'text-1', delta })),
    { type: 'text-end' as const, id: 'text-1' },
    {
      type: 'finish' as const,
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: chunks.length, totalTokens: 10 + chunks.length },
    },
  ];

  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        async pull(controller) {
          if (index < allChunks.length) {
            if (chunkDelayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, chunkDelayMs));
            }
            controller.enqueue(allChunks[index++]!);
          } else {
            controller.close();
          }
        },
      }),
    }),
  });
}

async function waitFor(condition: () => boolean, opts: { timeout?: number; interval?: number } = {}): Promise<void> {
  const { timeout = 3000, interval = 20 } = opts;
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start >= timeout) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

function extractAssistantText(messages: MastraDBMessage[]): string {
  return messages
    .filter(m => m.role === 'assistant')
    .map(m => {
      if (typeof m.content === 'string') return m.content;
      if (m.content && typeof m.content === 'object' && 'parts' in m.content && Array.isArray(m.content.parts)) {
        return m.content.parts
          .filter((p: { type?: string }) => p.type === 'text')
          .map((p: { text?: string }) => p.text ?? '')
          .join('');
      }
      return '';
    })
    .join('');
}

describe('persistPartialOnAbort', () => {
  it('does NOT persist partial output on abort by default', async () => {
    const chunks = ['hello', ' world', ' partial', ' more'];
    const abortController = new AbortController();
    let textDeltas = 0;

    const mockMemory = new MockMemory();
    const savedMessages: MastraDBMessage[] = [];
    const orig = mockMemory.saveMessages.bind(mockMemory);
    mockMemory.saveMessages = async args => {
      savedMessages.push(...args.messages);
      return orig(args);
    };

    const agent = new Agent({
      id: 'test-no-persist-default',
      name: 'Test No Persist Default',
      model: buildStreamModel({ chunks }),
      instructions: 'Test agent',
      memory: mockMemory,
    });

    const stream = await agent.stream('Hello', {
      abortSignal: abortController.signal,
      memory: { thread: 'no-persist-thread', resource: 'no-persist-resource' },
      onChunk: chunk => {
        if (chunk.type === 'text-delta') {
          textDeltas++;
          // Abort after the client has already received some streamed text.
          if (textDeltas === 2) {
            abortController.abort();
          }
        }
      },
    });

    try {
      await stream.consumeStream();
    } catch {
      // abort may reject consumeStream
    }

    await waitFor(() => savedMessages.some(m => m.role === 'assistant'), { timeout: 400 });

    expect(textDeltas).toBeGreaterThan(0);
    expect(extractAssistantText(savedMessages)).toBe('');

    const recalled = await mockMemory.recall({
      threadId: 'no-persist-thread',
      resourceId: 'no-persist-resource',
      count: 100,
    });
    expect(extractAssistantText(recalled.messages)).toBe('');
  });

  it('persists partial output on abort when persistPartialOnAbort is true', async () => {
    const chunks = ['hello', ' world', ' partial', ' more'];
    const abortController = new AbortController();
    let textDeltas = 0;
    const receivedText: string[] = [];

    const mockMemory = new MockMemory();
    const savedMessages: MastraDBMessage[] = [];
    const orig = mockMemory.saveMessages.bind(mockMemory);
    mockMemory.saveMessages = async args => {
      savedMessages.push(...args.messages);
      return orig(args);
    };

    const agent = new Agent({
      id: 'test-persist-on-abort',
      name: 'Test Persist On Abort',
      model: buildStreamModel({ chunks }),
      instructions: 'Test agent',
      memory: mockMemory,
    });

    const stream = await agent.stream('Hello', {
      persistPartialOnAbort: true,
      abortSignal: abortController.signal,
      memory: { thread: 'persist-abort-thread', resource: 'persist-abort-resource' },
      onChunk: chunk => {
        if (chunk.type === 'text-delta') {
          textDeltas++;
          receivedText.push(chunk.payload.text);
          if (textDeltas === 2) {
            abortController.abort();
          }
        }
      },
    });

    try {
      await stream.consumeStream();
    } catch {
      // abort may reject consumeStream
    }

    await waitFor(() => extractAssistantText(savedMessages).length > 0);

    expect(receivedText.join('')).toContain('hello');
    const assistantText = extractAssistantText(savedMessages);
    expect(assistantText.length).toBeGreaterThan(0);
    expect(assistantText).toContain('hello');

    const recalled = await mockMemory.recall({
      threadId: 'persist-abort-thread',
      resourceId: 'persist-abort-resource',
      count: 100,
    });
    expect(extractAssistantText(recalled.messages)).toContain('hello');
  });

  it('does not save empty text even when persistPartialOnAbort is true', async () => {
    const abortController = new AbortController();
    abortController.abort();

    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          pull(controller) {
            controller.error(new DOMException('The user aborted a request.', 'AbortError'));
          },
        }),
      }),
    });

    const mockMemory = new MockMemory();
    const savedMessages: MastraDBMessage[] = [];
    const orig = mockMemory.saveMessages.bind(mockMemory);
    mockMemory.saveMessages = async args => {
      savedMessages.push(...args.messages);
      return orig(args);
    };

    const agent = new Agent({
      id: 'test-no-save-empty',
      name: 'Test No Save Empty',
      model,
      instructions: 'Test agent',
      memory: mockMemory,
    });

    const stream = await agent.stream('Hello', {
      persistPartialOnAbort: true,
      abortSignal: abortController.signal,
      memory: { thread: 'no-save-empty-thread', resource: 'no-save-empty-resource' },
    });

    try {
      await stream.consumeStream();
    } catch {
      // abort may reject consumeStream
    }

    await waitFor(() => savedMessages.some(m => m.role === 'assistant'), { timeout: 300 });

    expect(savedMessages.filter(m => m.role === 'assistant')).toHaveLength(0);
  });

  it('streams without memory do not throw when persistPartialOnAbort is true', async () => {
    const chunks = ['hello', ' world'];
    const abortController = new AbortController();
    let textDeltas = 0;

    const agent = new Agent({
      id: 'test-persist-abort-no-memory',
      name: 'Test Persist Abort No Memory',
      model: buildStreamModel({ chunks }),
      instructions: 'Test agent',
    });

    const stream = await agent.stream('Hello', {
      persistPartialOnAbort: true,
      abortSignal: abortController.signal,
      onChunk: chunk => {
        if (chunk.type === 'text-delta') {
          textDeltas++;
          if (textDeltas === 1) {
            abortController.abort();
          }
        }
      },
    });

    await expect(stream.consumeStream().catch(() => undefined)).resolves.toBeUndefined();
  });
});
