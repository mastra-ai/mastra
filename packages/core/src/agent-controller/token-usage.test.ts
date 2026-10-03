import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { getModelAttempt, type ModelAttempt } from '../loop/shared/model-attempt';
import { InMemoryStore } from '../storage/mock';
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

  it.each([
    {
      name: 'unknown',
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
      count: 2,
      expected: { promptTokens: 4, completionTokens: 5, totalTokens: 9 },
    },
    {
      name: 'measured zero',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0 },
      count: 3,
      expected: { promptTokens: 4, completionTokens: 5, totalTokens: 9, reasoningTokens: 0 },
    },
    {
      name: 'reported',
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5, reasoningTokens: 1 },
      count: 3,
      expected: { promptTokens: 6, completionTokens: 8, totalTokens: 14, reasoningTokens: 1 },
    },
  ])(
    'persists only reported interrupted usage ($name), preserving prior measured steps',
    async ({ usage, count, expected }) => {
      const storage = new InMemoryStore();
      const observedUsages: unknown[] = [];
      const steps: unknown[] = [];
      let interruptedAttempt: ModelAttempt | undefined;
      let calls = 0;
      let processing!: () => void;
      const entered = new Promise<void>(resolve => {
        processing = resolve;
      });
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const agent = new Agent({
        id: 'interrupted-usage',
        name: 'Interrupted usage',
        instructions: 'Test',
        defaultOptions: {
          onStepFinish: step => {
            steps.push(step);
          },
        },
        outputProcessors: [
          {
            id: 'pause-finish',
            async processOutputStream({ part }) {
              if (calls === 2 && part.type === 'finish') {
                interruptedAttempt = getModelAttempt(part);
                observedUsages.push({ ...part.payload.output.usage });
                processing();
                await gate;
              }
              return part;
            },
          },
        ],
        model: new MockLanguageModelV2({
          doStream: async () => {
            calls++;
            if (calls === 2)
              return {
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'reasoning-start', id: 'discarded' },
                  { type: 'reasoning-delta', id: 'discarded', delta: 'discarded reasoning' },
                  { type: 'finish', finishReason: 'stop', usage },
                ]),
              };
            return {
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'text-start', id: 'answer' },
                { type: 'text-delta', id: 'answer', delta: 'accepted answer' },
                { type: 'text-end', id: 'answer' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage:
                    calls === 1
                      ? { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
                      : { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
                },
              ]),
            };
          },
        }),
      });
      controller = new AgentController({
        id: 'interrupted-usage-controller',
        storage,
        workspace: createMockWorkspace(),
        modes: [{ id: 'default', name: 'Default', default: true, agent }],
      });
      await controller.init();
      session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
      const thread = await session.thread.create();
      const events: AgentControllerEvent[] = [];
      session.subscribe(event => events.push(event));
      await session.sendMessage({ content: 'prior measured run' });
      const running = session.sendMessage({ content: 'reasoning run' });
      try {
        await entered;
        expect(observedUsages[0]).toMatchObject(usage);
        await session.sendSignal({ content: 'SYNTHETIC_USAGE_SIGNAL' }, { requireDelivery: true }).accepted;
        expect(interruptedAttempt?.discarded).toBe(true);
        expect(interruptedAttempt?.usage).toMatchObject(usage);
        release();
        await running;
        expect(calls).toBe(3);
        expect(steps).toHaveLength(3);
        expect(steps[1]).toMatchObject({ content: [], text: '', reasoning: [], usage });
        expect(events.filter(event => event.type === 'usage_update')).toHaveLength(count);
        expect(session.getTokenUsage()).toMatchObject(expected);
        expect(session.displayState.get().tokenUsage).toEqual(session.getTokenUsage());
        expect(events.filter(event => event.type === 'agent_end')).toEqual([
          { type: 'agent_end', reason: 'complete' },
          { type: 'agent_end', reason: 'complete' },
        ]);
        await expect
          .poll(
            async () =>
              (await (await storage.getStore('memory'))?.getThreadById({ threadId: thread.id }))?.metadata?.tokenUsage,
          )
          .toEqual(session.getTokenUsage());
      } finally {
        release();
      }
    },
  );

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
