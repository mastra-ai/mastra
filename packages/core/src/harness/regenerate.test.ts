import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { RegenerateTargetError } from '../processors/memory/message-history';
import { MASTRA_MEMORY_HISTORY_OVERRIDE_KEY, RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

async function* replacementStream() {
  yield {
    type: 'text-start',
    runId: 'run-regenerate',
    from: 'AGENT',
    payload: { id: 'text-1' },
  };
  yield {
    type: 'text-delta',
    runId: 'run-regenerate',
    from: 'AGENT',
    payload: { id: 'text-1', text: 'Replacement answer' },
  };
  yield {
    type: 'finish',
    runId: 'run-regenerate',
    from: 'AGENT',
    payload: {
      stepResult: { reason: 'stop' },
      output: { usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } },
      metadata: {},
    },
  };
}

function createReplacementModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Replacement answer' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        },
      ]),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });
}

function createHarness({ model = { provider: 'openai', name: 'gpt-4o' } as any } = {}) {
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'regenerate-agent',
    name: 'Regenerate Agent',
    instructions: 'Answer.',
    model,
  });
  const harness = new Harness({
    id: 'regenerate-harness',
    storage,
    memory: new MockMemory({ storage }),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });

  return { agent, harness, storage };
}

async function saveMessage(args: {
  storage: InMemoryStore;
  threadId: string;
  resourceId?: string;
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt?: Date;
}) {
  const memoryStorage = await args.storage.getStore('memory');
  await memoryStorage.saveMessages({
    messages: [
      {
        id: args.id,
        role: args.role,
        threadId: args.threadId,
        resourceId: args.resourceId,
        content: { format: 2, parts: [{ type: 'text', text: args.text }] },
        createdAt: args.createdAt ?? new Date(),
      },
    ],
  });
}

describe('Harness.regenerate', () => {
  it('sets the regenerate memory override and streams through the normal Harness event path', async () => {
    const { agent, harness, storage } = createHarness();
    const events: HarnessEvent[] = [];
    harness.subscribe(event => events.push(event));

    await harness.init();
    const thread = await harness.createThread();
    await saveMessage({
      storage,
      threadId: thread.id,
      resourceId: 'regenerate-harness',
      id: 'assistant-1',
      role: 'assistant',
      text: 'Original answer',
    });

    const stream = vi.fn(async () => ({ fullStream: replacementStream() }));
    (agent as any).stream = stream;

    const requestContext = new RequestContext();
    requestContext.set('custom', 'value');

    await harness.regenerate({ targetMessageId: 'assistant-1', requestContext });

    expect(stream).toHaveBeenCalledTimes(1);
    const [input, options] = stream.mock.calls[0]!;
    expect(input).toEqual([]);
    expect(options.memory).toEqual({ thread: thread.id, resource: 'regenerate-harness' });
    expect(options.requestContext.get('custom')).toBe('value');
    expect(options.requestContext.get(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY)).toEqual({
      type: 'regenerate',
      targetMessageId: 'assistant-1',
    });
    expect(requestContext.has(MASTRA_MEMORY_HISTORY_OVERRIDE_KEY)).toBe(false);

    expect(events.map(event => event.type)).toEqual(
      expect.arrayContaining(['agent_start', 'message_start', 'message_update', 'message_end', 'agent_end']),
    );
    expect(events.find(event => event.type === 'agent_end')).toEqual({ type: 'agent_end', reason: 'complete' });
    expect(harness.getCurrentRunId()).toBe('run-regenerate');
  });

  it('deletes the regenerated branch after the replacement response is persisted', async () => {
    const { harness, storage } = createHarness({ model: createReplacementModel() });

    await harness.init();
    const thread = await harness.createThread();
    const resourceId = 'regenerate-harness';
    await saveMessage({
      storage,
      threadId: thread.id,
      resourceId,
      id: 'user-1',
      role: 'user',
      text: 'Original question',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await saveMessage({
      storage,
      threadId: thread.id,
      resourceId,
      id: 'assistant-1',
      role: 'assistant',
      text: 'Original answer',
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
    });
    await saveMessage({
      storage,
      threadId: thread.id,
      resourceId,
      id: 'user-2',
      role: 'user',
      text: 'Follow-up question',
      createdAt: new Date('2026-01-01T00:00:02.000Z'),
    });
    await saveMessage({
      storage,
      threadId: thread.id,
      resourceId,
      id: 'assistant-2',
      role: 'assistant',
      text: 'Follow-up answer',
      createdAt: new Date('2026-01-01T00:00:03.000Z'),
    });

    await harness.regenerate({ targetMessageId: 'assistant-1' });

    const memoryStorage = await storage.getStore('memory');
    const { messages } = await memoryStorage.listMessages({
      threadId: thread.id,
      resourceId,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    const messageIds = messages.map(message => message.id);

    expect(messageIds).toContain('user-1');
    expect(messageIds).not.toContain('assistant-1');
    expect(messageIds).not.toContain('user-2');
    expect(messageIds).not.toContain('assistant-2');
    expect(
      messages.some(
        message =>
          message.role === 'assistant' &&
          message.id !== 'assistant-1' &&
          message.content.parts?.some(part => part.type === 'text' && part.text === 'Replacement answer'),
      ),
    ).toBe(true);
  });

  it('requires a target assistant message id', async () => {
    const { harness } = createHarness();
    await harness.init();
    await harness.createThread();

    await expect(harness.regenerate({ targetMessageId: '' })).rejects.toThrow(
      'targetMessageId is required for Harness regeneration',
    );
  });

  it('requires an existing current thread', async () => {
    const { harness } = createHarness();
    await harness.init();

    await expect(harness.regenerate({ targetMessageId: 'assistant-1' })).rejects.toThrow(
      'Cannot regenerate without a current thread',
    );
  });

  it('rejects target validation errors surfaced by MessageHistory', async () => {
    const { agent, harness } = createHarness();
    await harness.init();
    await harness.createThread();
    const stream = vi
      .fn()
      .mockRejectedValueOnce(new RegenerateTargetError('missing', 'missing-assistant'))
      .mockRejectedValueOnce(new RegenerateTargetError('non-assistant', 'user-1'));
    (agent as any).stream = stream;

    await expect(harness.regenerate({ targetMessageId: 'missing-assistant' })).rejects.toThrow(
      'Cannot regenerate missing message "missing-assistant"',
    );

    await expect(harness.regenerate({ targetMessageId: 'user-1' })).rejects.toThrow(
      'Cannot regenerate non-assistant message "user-1"',
    );
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it('does not capture regenerate validation errors for a different target', async () => {
    const { agent, harness } = createHarness();
    await harness.init();
    await harness.createThread();
    (agent as any).stream = vi.fn().mockRejectedValueOnce(new Error('Cannot regenerate missing message "other"'));

    await expect(harness.regenerate({ targetMessageId: 'assistant-1' })).resolves.toBeUndefined();
  });

  it('requires storage and memory so MessageHistory can validate and clean up the regenerated branch', async () => {
    const agent = new Agent({
      id: 'regenerate-agent',
      name: 'Regenerate Agent',
      instructions: 'Answer.',
      model: { provider: 'openai', name: 'gpt-4o' },
    });
    const harnessWithoutStorage = new Harness({
      id: 'regenerate-harness',
      memory: {} as any,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    (harnessWithoutStorage as any).currentThreadId = 'thread-1';

    await expect(harnessWithoutStorage.regenerate({ targetMessageId: 'assistant-1' })).rejects.toThrow(
      'Storage is not configured on this Harness',
    );

    const harnessWithoutMemory = new Harness({
      id: 'regenerate-harness',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await harnessWithoutMemory.init();
    await harnessWithoutMemory.createThread();

    await expect(harnessWithoutMemory.regenerate({ targetMessageId: 'assistant-1' })).rejects.toThrow(
      'Memory is not configured on this Harness',
    );
  });
});
