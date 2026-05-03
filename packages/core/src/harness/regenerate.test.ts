import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
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

function createHarness() {
  const agent = new Agent({
    id: 'regenerate-agent',
    name: 'Regenerate Agent',
    instructions: 'Answer.',
    model: { provider: 'openai', name: 'gpt-4o' },
  });
  const storage = new InMemoryStore();
  const harness = new Harness({
    id: 'regenerate-harness',
    storage,
    memory: {} as any,
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
        createdAt: new Date(),
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
      .mockRejectedValueOnce(new Error('Cannot regenerate missing message "missing-assistant"'))
      .mockRejectedValueOnce(new Error('Cannot regenerate non-assistant message "user-1"'));
    (agent as any).stream = stream;

    await expect(harness.regenerate({ targetMessageId: 'missing-assistant' })).rejects.toThrow(
      'Cannot regenerate missing message "missing-assistant"',
    );

    await expect(harness.regenerate({ targetMessageId: 'user-1' })).rejects.toThrow(
      'Cannot regenerate non-assistant message "user-1"',
    );
    expect(stream).toHaveBeenCalledTimes(2);
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
