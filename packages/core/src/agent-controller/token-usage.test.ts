import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

function createController(storage = new InMemoryStore()) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

/**
 * Creates a mock async iterable simulating a fullStream with a step-finish chunk
 * containing the given usage data, followed by a finish chunk.
 */
async function* mockStream(usage?: Record<string, unknown>) {
  const output = usage === undefined ? {} : { usage };
  yield {
    type: 'step-finish',
    runId: 'run-1',
    from: 'AGENT',
    payload: {
      output,
      stepResult: { reason: 'stop' },
      metadata: {},
    },
  };
  yield {
    type: 'finish',
    runId: 'run-1',
    from: 'AGENT',
    payload: {
      stepResult: { reason: 'stop' },
      output,
      metadata: {},
    },
  };
}

async function* mockMultiStepStream(usages: Array<Record<string, unknown> | undefined>) {
  for (const [index, usage] of usages.entries()) {
    yield {
      type: 'step-finish',
      runId: 'run-1',
      from: 'AGENT',
      payload: {
        output: usage === undefined ? {} : { usage },
        stepResult: { reason: index === usages.length - 1 ? 'stop' : 'tool-calls' },
        metadata: {},
      },
    };
  }
  yield {
    type: 'finish',
    runId: 'run-1',
    from: 'AGENT',
    payload: {
      stepResult: { reason: 'stop' },
      output: {},
      metadata: {},
    },
  };
}

describe('step-finish token usage extraction', () => {
  let controller: AgentController;
  let session: Awaited<ReturnType<AgentController['createSession']>>;

  beforeEach(async () => {
    controller = createController();
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  });

  it('extracts token usage from AI SDK v5/v6 format (inputTokens/outputTokens)', async () => {
    const usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };

    await (session as any).processStream({ fullStream: mockStream(usage) });

    const tokenUsage = session.getTokenUsage();
    expect(tokenUsage.promptTokens).toBe(100);
    expect(tokenUsage.completionTokens).toBe(50);
    expect(tokenUsage.totalTokens).toBe(150);
  });

  it('extracts token usage from legacy v4 format (promptTokens/completionTokens)', async () => {
    const usage = { promptTokens: 200, completionTokens: 80, totalTokens: 280 };

    await (session as any).processStream({ fullStream: mockStream(usage) });

    const tokenUsage = session.getTokenUsage();
    expect(tokenUsage.promptTokens).toBe(200);
    expect(tokenUsage.completionTokens).toBe(80);
    expect(tokenUsage.totalTokens).toBe(280);
  });

  it('preserves provider totalTokens and richer usage fields', async () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 220,
      reasoningTokens: 70,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test-provider' },
    };
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await (session as any).processStream({ fullStream: mockStream(usage) });

    const expectedUsage = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 220,
      reasoningTokens: 70,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test-provider' },
    };
    expect(session.getTokenUsage()).toEqual(expectedUsage);
    expect(session.displayState.get().tokenUsage).toEqual(expectedUsage);
    expect(events.find(event => event.type === 'usage_update')).toEqual({
      type: 'usage_update',
      usage: expectedUsage,
    });
  });

  it('persists richer token usage in thread metadata', async () => {
    const storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create();
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 220,
      reasoningTokens: 70,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test-provider' },
    };

    await (session as any).processStream({ fullStream: mockStream(usage) });

    await expect
      .poll(async () => {
        const memory = await storage.getStore('memory');
        const savedThread = await memory?.getThreadById({ threadId: thread.id });
        return savedThread?.metadata?.tokenUsage;
      })
      .toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 220,
        reasoningTokens: 70,
        cachedInputTokens: 25,
        cacheCreationInputTokens: 5,
        raw: { provider: 'test-provider' },
      });
  });

  it('persists the usage snapshot for the thread that produced it', async () => {
    const storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const originalThreadId = session.thread.requireId();
    const memory = await storage.getStore('memory');
    const getThreadById = memory!.getThreadById.bind(memory);
    let releaseRead: () => void = () => {};
    const readGate = new Promise<void>(resolve => {
      releaseRead = resolve;
    });
    const readStarted = vi.fn();
    vi.spyOn(memory!, 'getThreadById').mockImplementationOnce(async input => {
      readStarted();
      await readGate;
      return getThreadById(input);
    });

    await (session as any).processStream({
      fullStream: mockStream({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
    });
    await vi.waitFor(() => expect(readStarted).toHaveBeenCalled());
    await session.thread.create({ title: 'Next thread' });
    releaseRead();

    await expect
      .poll(async () => {
        const thread = await getThreadById({ threadId: originalThreadId });
        return thread?.metadata?.tokenUsage;
      })
      .toMatchObject({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
  });

  it('accumulates token usage across multiple step-finish chunks', async () => {
    const usage1 = { inputTokens: 100, outputTokens: 50 };
    const usage2 = { inputTokens: 150, outputTokens: 70 };

    async function* multiStepStream() {
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: usage1 },
          stepResult: { reason: 'tool-calls' },
          metadata: {},
        },
      };
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: usage2 },
          stepResult: { reason: 'stop' },
          metadata: {},
        },
      };
      yield {
        type: 'finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: usage2 },
          metadata: {},
        },
      };
    }

    await (session as any).processStream({ fullStream: multiStepStream() });

    const tokenUsage = session.getTokenUsage();
    expect(tokenUsage.promptTokens).toBe(250);
    expect(tokenUsage.completionTokens).toBe(120);
    expect(tokenUsage.totalTokens).toBe(370);
  });

  it('accumulates richer usage fields across multiple step-finish chunks', async () => {
    const usage1 = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 180,
      reasoningTokens: 30,
      cachedInputTokens: 10,
      raw: { step: 1 },
    };
    const usage2 = {
      inputTokens: 150,
      outputTokens: 70,
      totalTokens: 260,
      reasoningTokens: 40,
      cacheCreationInputTokens: 12,
      raw: { step: 2 },
    };

    async function* multiStepStream() {
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: usage1 },
          stepResult: { reason: 'tool-calls' },
          metadata: {},
        },
      };
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: usage2 },
          stepResult: { reason: 'stop' },
          metadata: {},
        },
      };
      yield {
        type: 'finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: usage2 },
          metadata: {},
        },
      };
    }

    await (session as any).processStream({ fullStream: multiStepStream() });

    expect(session.getTokenUsage()).toEqual({
      promptTokens: 250,
      completionTokens: 120,
      totalTokens: 440,
      reasoningTokens: 70,
      cachedInputTokens: 10,
      cacheCreationInputTokens: 12,
      raw: { step: 2 },
    });
  });

  it.each([
    { name: 'missing primary counts', usage: { inputTokens: {}, outputTokens: {} } },
    { name: 'an omitted usage object', usage: undefined },
  ])('keeps $name unknown in events, tallies, and display state', async ({ usage }) => {
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await (session as any).processStream({ fullStream: mockStream(usage) });

    const usageEvent = events.find(event => event.type === 'usage_update');
    expect(usageEvent).toEqual({
      type: 'usage_update',
      usage: {
        promptTokens: undefined,
        completionTokens: undefined,
        totalTokens: undefined,
      },
    });
    expect(session.getTokenUsage()).toMatchObject({
      promptTokens: undefined,
      completionTokens: undefined,
      totalTokens: undefined,
    });
    expect(session.displayState.get().tokenUsage).toMatchObject({
      promptTokens: undefined,
      completionTokens: undefined,
      totalTokens: undefined,
    });
  });

  it.each([
    {
      name: 'known then unknown',
      usages: [
        { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        { inputTokens: {}, outputTokens: {} },
      ],
    },
    {
      name: 'unknown then known',
      usages: [
        { inputTokens: {}, outputTokens: {} },
        { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      ],
    },
  ])('keeps a mixed $name tally unknown', async ({ usages }) => {
    await (session as any).processStream({ fullStream: mockMultiStepStream(usages) });

    expect(session.getTokenUsage()).toMatchObject({
      promptTokens: undefined,
      completionTokens: undefined,
      totalTokens: undefined,
    });
  });

  it('tracks completeness independently for each primary count', async () => {
    await (session as any).processStream({
      fullStream: mockMultiStepStream([{ inputTokens: 100, outputTokens: 50, totalTokens: 150 }, { inputTokens: 20 }]),
    });

    expect(session.getTokenUsage()).toMatchObject({
      promptTokens: 120,
      completionTokens: undefined,
      totalTokens: undefined,
    });
  });

  it('keeps an explicitly measured zero distinct from unknown', async () => {
    await (session as any).processStream({
      fullStream: mockStream({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
    });

    expect(session.getTokenUsage()).toMatchObject({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
    expect(JSON.parse(JSON.stringify(session.getTokenUsage()))).toMatchObject({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it('persists and rehydrates unknown primary counts', async () => {
    const storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create();

    await (session as any).processStream({
      fullStream: mockStream({ inputTokens: {}, outputTokens: {} }),
    });

    const memory = await storage.getStore('memory');
    await expect
      .poll(async () => {
        const savedThread = await memory?.getThreadById({ threadId: thread.id });
        return savedThread?.metadata?.tokenUsage;
      })
      .toBeDefined();
    const savedThread = await memory?.getThreadById({ threadId: thread.id });
    const serializedUsage = JSON.parse(JSON.stringify(savedThread?.metadata?.tokenUsage));
    expect(serializedUsage.promptTokens).toBeUndefined();
    expect(serializedUsage.completionTokens).toBeUndefined();
    expect(serializedUsage.totalTokens).toBeUndefined();
    await memory?.saveThread({
      thread: {
        ...savedThread!,
        metadata: { ...savedThread?.metadata, tokenUsage: serializedUsage },
      },
    });

    const reopenedController = createController(storage);
    await reopenedController.init();
    const reopened = await reopenedController.createSession({
      id: 'reopened-session',
      ownerId: 'test-owner',
      threadId: thread.id,
    });
    expect(reopened.getTokenUsage()).toMatchObject({
      promptTokens: undefined,
      completionTokens: undefined,
      totalTokens: undefined,
    });
  });

  it('does not invent primary counts when saved metadata is incomplete', async () => {
    const storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create();
    const memory = await storage.getStore('memory');
    const savedThread = await memory?.getThreadById({ threadId: thread.id });
    await memory?.saveThread({
      thread: {
        ...savedThread!,
        metadata: { ...savedThread?.metadata, tokenUsage: { totalTokens: 999 } },
      },
    });

    const reopenedController = createController(storage);
    await reopenedController.init();
    const reopened = await reopenedController.createSession({
      id: 'reopened-session',
      ownerId: 'test-owner',
      threadId: thread.id,
    });
    expect(reopened.getTokenUsage()).toMatchObject({
      promptTokens: undefined,
      completionTokens: undefined,
      totalTokens: 999,
    });
  });

  it('preserves a measured tally when refreshing metadata fails', async () => {
    const storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create();
    session.setTokenUsage({ promptTokens: 500, completionTokens: 250, totalTokens: 750 });

    const memory = await storage.getStore('memory');
    vi.spyOn(memory!, 'getThreadById').mockRejectedValueOnce(new Error('temporary storage failure'));
    await session.thread.loadMetadata();

    expect(session.getTokenUsage()).toMatchObject({
      promptTokens: 500,
      completionTokens: 250,
      totalTokens: 750,
    });
  });

  it('starts an existing thread at unknown when metadata hydration fails', async () => {
    const storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create();
    const memory = await storage.getStore('memory');
    const savedThread = await memory?.getThreadById({ threadId: thread.id });

    const reopenedController = createController(storage);
    await reopenedController.init();
    vi.spyOn(memory!, 'getThreadById').mockResolvedValueOnce(savedThread).mockRejectedValueOnce(new Error('temporary'));
    const reopened = await reopenedController.createSession({
      id: 'reopened-session',
      ownerId: 'test-owner',
      threadId: thread.id,
    });

    expect(reopened.getTokenUsage().promptTokens).toBeUndefined();
    expect(reopened.getTokenUsage().completionTokens).toBeUndefined();
    expect(reopened.getTokenUsage().totalTokens).toBeUndefined();
  });

  it('defaults cache usage fields to 0 when not present in usage', async () => {
    const usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };

    await (session as any).processStream({ fullStream: mockStream(usage) });

    const tokenUsage = session.getTokenUsage();
    expect(tokenUsage.cachedInputTokens).toBe(0);
    expect(tokenUsage.cacheCreationInputTokens).toBe(0);
  });
});
