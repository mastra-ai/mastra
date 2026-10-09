import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { MastraLanguageModelV2Mock } from '../test-utils/llm-mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import { createEmptyTokenUsage } from './types';
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
async function* mockStream(usage: Record<string, unknown>) {
  yield {
    type: 'step-finish',
    runId: 'run-1',
    from: 'AGENT',
    payload: {
      output: { usage },
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
      output: { usage },
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

  it('persists richer token usage from the executing run, not from stream subscribers', async () => {
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
    const readStoredUsage = async () => {
      const memory = await storage.getStore('memory');
      return (await memory?.getThreadById({ threadId: thread.id }))?.metadata?.tokenUsage;
    };

    // A subscriber only displays usage.
    await (session as any).processStream({ fullStream: mockStream(usage) });
    expect(await readStoredUsage()).toBeUndefined();

    await session.machinery.buildSharedRunOptions().onStepFinish!({ usage });
    await expect.poll(readStoredUsage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 220,
      reasoningTokens: 70,
      cachedInputTokens: 25,
      cacheCreationInputTokens: 5,
      raw: { provider: 'test-provider' },
    });
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

  it('defaults cache usage fields to 0 when not present in usage', async () => {
    const usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };

    await (session as any).processStream({ fullStream: mockStream(usage) });

    const tokenUsage = session.getTokenUsage();
    expect(tokenUsage.cachedInputTokens).toBe(0);
    expect(tokenUsage.cacheCreationInputTokens).toBe(0);
  });

  it('does not fabricate a tally or event for an empty usage object', async () => {
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await (session as any).processStream({ fullStream: mockStream({}) });

    expect(session.getTokenUsage()).toEqual(createEmptyTokenUsage());
    expect(events.find(event => event.type === 'usage_update')).toBeUndefined();
  });

  it('does not fabricate a tally for a nested-object usage shape', async () => {
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await (session as any).processStream({ fullStream: mockStream({ inputTokens: {}, outputTokens: {} }) });

    expect(session.getTokenUsage()).toEqual(createEmptyTokenUsage());
    expect(events.find(event => event.type === 'usage_update')).toBeUndefined();
  });

  it('does not persist a false zero tally for an empty usage step', async () => {
    const storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const thread = await session.thread.create();

    await (session as any).processStream({ fullStream: mockStream({}) });

    const memory = await storage.getStore('memory');
    const savedThread = await memory?.getThreadById({ threadId: thread.id });
    expect(savedThread?.metadata?.tokenUsage).toBeUndefined();
  });

  it('preserves a measured zero (explicit numeric fields still emit and tally)', async () => {
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await (session as any).processStream({
      fullStream: mockStream({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
    });

    const usage = session.getTokenUsage();
    expect(usage.promptTokens).toBe(0);
    expect(usage.completionTokens).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(events.find(event => event.type === 'usage_update')).toBeDefined();
  });

  it('skips empty usage steps but tallies measured steps in a multi-step run', async () => {
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    async function* mixedStepStream() {
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
          stepResult: { reason: 'tool-calls' },
          metadata: {},
        },
      };
      yield {
        type: 'step-finish',
        runId: 'run-1',
        from: 'AGENT',
        payload: {
          output: { usage: {} },
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
          output: {},
          metadata: {},
        },
      };
    }

    await (session as any).processStream({ fullStream: mixedStepStream() });

    expect(session.getTokenUsage().totalTokens).toBe(150);
    expect(events.filter(event => event.type === 'usage_update')).toHaveLength(1);
  });

  it.each(['read', 'write', 'committed-write'])('retains unsaved owner usage after a %s failure', async failure => {
    const storage = new InMemoryStore();
    const owner = createController(storage);
    await owner.init();
    const source = await owner.createSession({ id: 'usage-owner', ownerId: 'usage-owner' });
    const threadId = source.thread.requireId();
    const memory = (await storage.getStore('memory'))!;
    const recorder = source.machinery.buildSharedRunOptions().onStepFinish!;
    const continuationRecorder = source.machinery.buildSharedRunOptions().onStepFinish!;
    const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2, reasoningTokens: 1 };
    await recorder({ usage });
    let injected = 0;
    const read = memory.getThreadById.bind(memory);
    const save = memory.saveThread.bind(memory);
    const spy =
      failure === 'read'
        ? vi.spyOn(memory, 'getThreadById').mockImplementationOnce(async () => {
            injected++;
            throw new Error('Injected read failure');
          })
        : vi.spyOn(memory, 'saveThread').mockImplementationOnce(async input => {
            injected++;
            if (failure === 'committed-write') await save(input);
            throw new Error('Injected write failure');
          });
    try {
      await recorder({ usage });
      expect(injected).toBe(1);
      spy.mockRestore();
      await source.thread.create({ id: 'other-usage-thread' });
      await continuationRecorder({ usage });
      expect((await read({ threadId }))?.metadata?.tokenUsage).toMatchObject({
        promptTokens: 3,
        completionTokens: 3,
        totalTokens: 6,
        reasoningTokens: 3,
      });
      expect((await read({ threadId: source.thread.requireId() }))?.metadata?.tokenUsage).toBeUndefined();
      await source.thread.switch({ threadId });
      expect(source.getTokenUsage().totalTokens).toBe(6);
    } finally {
      spy.mockRestore();
      await owner.destroy();
    }
  });

  it.each([false, true])(
    'projects replayed saved totals without adding them again (read failure: %s)',
    async failRead => {
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      await session.machinery.buildSharedRunOptions().onStepFinish!({ usage });
      await session.thread.loadMetadata();
      expect(session.getTokenUsage().totalTokens).toBe(2);
      const spy = failRead
        ? vi.spyOn(session.thread, 'getById').mockRejectedValueOnce(new Error('Injected projection read failure'))
        : undefined;
      try {
        await (session as any).processStream({ fullStream: mockStream(usage) });
        expect(session.getTokenUsage().totalTokens).toBe(2);
        await session.machinery.buildSharedRunOptions().onStepFinish!({ usage });
        await (session as any).processStream({ fullStream: mockStream(usage) });
        expect(session.getTokenUsage().totalTokens).toBe(4);
        expect(session.displayState.get().tokenUsage?.totalTokens).toBe(4);
      } finally {
        spy?.mockRestore();
      }
    },
  );

  it.each(['none', 'read', 'write'])('keeps concurrent owner recorders in one total (failure: %s)', async failure => {
    const storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'concurrent-usage', ownerId: 'concurrent-usage' });
    const memory = (await storage.getStore('memory'))!;
    const save = memory.saveThread.bind(memory);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const spy =
      failure === 'read'
        ? vi.spyOn(memory, 'getThreadById').mockImplementationOnce(async () => {
            entered.resolve();
            await release.promise;
            throw new Error('Injected concurrent read failure');
          })
        : vi.spyOn(memory, 'saveThread').mockImplementationOnce(async input => {
            entered.resolve();
            await release.promise;
            if (failure === 'write') throw new Error('Injected concurrent save failure');
            return save(input);
          });
    const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
    const first = session.machinery.buildSharedRunOptions().onStepFinish!({ usage });
    let second: Promise<void> | undefined;
    try {
      await entered.promise;
      second = session.machinery.buildSharedRunOptions().onStepFinish!({ usage });
      release.resolve();
      await Promise.all([first, second]);
      expect(
        (await memory.getThreadById({ threadId: session.thread.requireId() }))?.metadata?.tokenUsage,
      ).toMatchObject({ totalTokens: 4 });
    } finally {
      release.resolve();
      await first;
      await second;
      spy.mockRestore();
    }
  });

  it.each([false, true])(
    'does not project a stale usage read after navigation (return to source: %s)',
    async returnToSource => {
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      await session.machinery.buildSharedRunOptions().onStepFinish!({ usage });
      const threadId = session.thread.requireId();
      const saved = await session.thread.getById({ threadId });
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const spy = vi.spyOn(session.thread, 'getById').mockImplementationOnce(async () => {
        entered.resolve();
        await release.promise;
        return saved;
      });
      const replay = (session as any).processStream({ fullStream: mockStream(usage) });
      try {
        await entered.promise;
        await session.thread.create({ id: 'projection-successor' });
        if (returnToSource) {
          await session.thread.switch({ threadId });
          await session.machinery.buildSharedRunOptions().onStepFinish!({ usage });
          await session.thread.loadMetadata();
        }
        const displayBefore = session.displayState.get().tokenUsage;
        release.resolve();
        await replay;
        expect(session.getTokenUsage().totalTokens).toBe(returnToSource ? 4 : 0);
        expect(session.displayState.get().tokenUsage).toEqual(displayBefore);
      } finally {
        release.resolve();
        await replay;
        spy.mockRestore();
      }
    },
  );

  it.each([false, true])(
    'projects a real late listener without writing usage (owner write failure: %s)',
    async failWrite => {
      const storage = new InMemoryStore();
      const secondStep = Promise.withResolvers<ReadableStreamDefaultController>();
      let calls = 0;
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      const agent = new Agent({
        id: 'late-listener-usage-agent',
        name: 'Late listener usage',
        instructions: 'Call the tool, then respond.',
        memory: new MockMemory({ storage }),
        tools: {
          continue_work: createTool({
            id: 'continue_work',
            description: 'Continue work',
            inputSchema: z.object({}),
            execute: async () => 'ok',
          }),
        },
        model: new MastraLanguageModelV2Mock({
          doStream: async () => ({
            stream: new ReadableStream({
              start(output) {
                output.enqueue({ type: 'stream-start', warnings: [] });
                if (++calls === 1) {
                  output.enqueue({
                    type: 'tool-call',
                    toolCallId: 'continue-1',
                    toolName: 'continue_work',
                    input: '{}',
                  });
                  output.enqueue({ type: 'finish', finishReason: 'tool-calls', usage });
                  output.close();
                } else {
                  output.enqueue({ type: 'text-start', id: 'response-1' });
                  secondStep.resolve(output);
                }
              },
            }),
          }),
        }),
      });
      new Mastra({ agents: { agent }, storage, logger: false });
      const owner = new AgentController({
        id: 'late-listener-usage',
        agent,
        storage,
        workspace: createMockWorkspace(),
        initialState: { yolo: true },
        modes: [{ id: 'default', name: 'Default', default: true }],
      });
      await owner.init();
      const first = await owner.createSession({ id: 'first', ownerId: 'shared-usage', scope: 'first' });
      const threadId = first.thread.requireId();
      const memory = (await storage.getStore('memory'))!;
      const save = memory.saveThread.bind(memory);
      let failures = 0;
      const saveSpy = vi.spyOn(memory, 'saveThread').mockImplementation(async input => {
        if (failWrite && input.thread.metadata?.tokenUsage && failures++ === 0)
          throw new Error('Injected execution save failure');
        return save(input);
      });
      const sending = first.sendMessage({ content: 'Start' });
      const second = await owner.createSession({
        id: 'second',
        ownerId: 'shared-usage',
        scope: 'second',
        createInitialThread: false,
      });
      try {
        const output = await secondStep.promise;
        if (!failWrite) {
          await vi.waitFor(async () =>
            expect((await memory.getThreadById({ threadId }))?.metadata?.tokenUsage).toMatchObject({ totalTokens: 2 }),
          );
        }
        await second.thread.switch({ threadId });
        await vi.waitFor(() => {
          expect(second.run.getRunId()).toBe(first.run.getRunId());
          expect(second.getTokenUsage().totalTokens).toBe(2);
        });
        output.enqueue({ type: 'text-delta', id: 'response-1', delta: 'Done' });
        output.enqueue({ type: 'text-end', id: 'response-1' });
        output.enqueue({ type: 'finish', finishReason: 'stop', usage });
        output.close();
        await sending;
        await vi.waitFor(() => {
          expect(second.run.isRunning()).toBe(false);
          expect(second.getTokenUsage().totalTokens).toBe(4);
          expect(second.displayState.get().tokenUsage?.totalTokens).toBe(4);
        });
        expect(first.getTokenUsage().totalTokens).toBe(4);
        expect((await memory.getThreadById({ threadId }))?.metadata?.tokenUsage).toMatchObject({ totalTokens: 4 });
        if (failWrite) expect(failures).toBeGreaterThanOrEqual(2);
      } finally {
        saveSpy.mockRestore();
        first.abort();
        second.stream.detach();
        first.stream.detach();
        await sending.catch(() => {});
        await owner.destroy();
      }
    },
  );

  it('preserves the running tally when metadata read fails', async () => {
    const storage = new InMemoryStore();
    controller = createController(storage);
    await controller.init();
    session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create();

    session.setTokenUsage({ promptTokens: 500, completionTokens: 250, totalTokens: 750 });

    const memory = await storage.getStore('memory');
    const spy = vi.spyOn(memory as any, 'getThreadById').mockRejectedValue(new Error('transient read failure'));

    await session.thread.loadMetadata();

    expect(session.getTokenUsage().totalTokens).toBe(750);
    spy.mockRestore();
  });
});
