import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';

function buildAbortingStreamModel(opts: { chunks: string[]; abortAfterChunk: number }) {
  const { chunks, abortAfterChunk } = opts;
  const abortController = new AbortController();
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

  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        pull(controller) {
          if (index < allChunks.length) {
            const chunk = allChunks[index++]!;
            const textDeltasSoFar = allChunks.slice(0, index).filter(c => c.type === 'text-delta').length;
            if (chunk.type === 'text-delta' && textDeltasSoFar === abortAfterChunk) {
              abortController.abort();
            }
            controller.enqueue(chunk);
          } else {
            controller.close();
          }
        },
      }),
    }),
  });

  return { model, abortController };
}

async function waitFor(condition: () => boolean, opts: { timeout?: number; interval?: number } = {}): Promise<void> {
  const { timeout = 2000, interval = 20 } = opts;
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
    const chunks = ['hello', ' world', ' partial'];
    const { model, abortController } = buildAbortingStreamModel({ chunks, abortAfterChunk: 2 });

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
      model,
      instructions: 'Test agent',
      memory: mockMemory,
    });

    const stream = await agent.stream('Hello', {
      abortSignal: abortController.signal,
      memory: { thread: 'no-persist-thread', resource: 'no-persist-resource' },
    });

    try {
      await stream.consumeStream();
    } catch {
      // abort may reject consumeStream
    }

    await waitFor(() => savedMessages.some(m => m.role === 'assistant'), { timeout: 300 });

    expect(extractAssistantText(savedMessages)).toBe('');

    const recalled = await mockMemory.recall({
      threadId: 'no-persist-thread',
      resourceId: 'no-persist-resource',
      count: 100,
    });
    expect(extractAssistantText(recalled.messages)).toBe('');
  });

  it('persists partial output on abort when persistPartialOnAbort is true', async () => {
    const chunks = ['hello', ' world', ' partial'];
    const { model, abortController } = buildAbortingStreamModel({ chunks, abortAfterChunk: 2 });

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
      model,
      instructions: 'Test agent',
      memory: mockMemory,
    });

    const stream = await agent.stream('Hello', {
      persistPartialOnAbort: true,
      abortSignal: abortController.signal,
      memory: { thread: 'persist-abort-thread', resource: 'persist-abort-resource' },
    });

    try {
      await stream.consumeStream();
    } catch {
      // abort may reject consumeStream
    }

    await waitFor(() => extractAssistantText(savedMessages).length > 0);

    const assistantText = extractAssistantText(savedMessages);
    expect(assistantText.length).toBeGreaterThan(0);
    expect(assistantText).toContain('hello');

    const recalled = await mockMemory.recall({
      threadId: 'persist-abort-thread',
      resourceId: 'persist-abort-resource',
      count: 100,
    });
    const recalledText = extractAssistantText(recalled.messages);
    expect(recalledText).toContain('hello');
  });

  it('does not save empty text even when persistPartialOnAbort is true', async () => {
    const abortController = new AbortController();
    let pulled = 0;

    const model = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          pull(controller) {
            pulled++;
            if (pulled === 1) {
              abortController.abort();
              controller.enqueue({ type: 'stream-start', warnings: [] });
            } else {
              controller.error(new DOMException('The user aborted a request.', 'AbortError'));
            }
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
    const { model, abortController } = buildAbortingStreamModel({ chunks, abortAfterChunk: 1 });

    const agent = new Agent({
      id: 'test-persist-abort-no-memory',
      name: 'Test Persist Abort No Memory',
      model,
      instructions: 'Test agent',
    });

    const stream = await agent.stream('Hello', {
      persistPartialOnAbort: true,
      abortSignal: abortController.signal,
    });

    await expect(stream.consumeStream().catch(() => undefined)).resolves.toBeUndefined();
  });
});
