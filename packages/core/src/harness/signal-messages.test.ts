import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { createSignal } from '../agent/signals';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 20; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for harness events');
}

function createHarness(
  storage: InMemoryStore,
  agent: Agent<any, any, any, any> = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: createTextStreamModel('Hello'),
  }),
) {
  return new Harness({
    id: 'test-harness',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

describe('Harness signal messages', () => {
  it('renders persisted system-reminder signals from signal attributes', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const thread = await harness.createThread();

    await storage.stores.memory!.saveMessages({
      messages: [
        createSignal({
          id: 'signal-1',
          type: 'system-reminder',
          contents: 'Remember the repo instructions',
          attributes: { type: 'dynamic-agents-md', path: '/tmp/AGENTS.md' },
          createdAt: new Date('2026-05-04T00:00:00.000Z'),
        }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId }),
      ],
    });

    await expect(harness.listMessages()).resolves.toEqual([
      {
        id: 'signal-1',
        role: 'user',
        content: [
          {
            type: 'system_reminder',
            message: 'Remember the repo instructions',
            reminderType: 'dynamic-agents-md',
            path: '/tmp/AGENTS.md',
            precedesMessageId: undefined,
            gapText: undefined,
            gapMs: undefined,
            timestamp: undefined,
          },
        ],
        createdAt: new Date('2026-05-04T00:00:00.000Z'),
      },
    ]);
  });

  it('processes sendMessage streams once through the active thread subscription', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'hello' });
    await waitFor(() => events.some(event => event.type === 'message_end' && event.message.role === 'assistant'));

    const assistantStarts = events.filter(
      (event): event is Extract<HarnessEvent, { type: 'message_start' }> =>
        event.type === 'message_start' && event.message.role === 'assistant',
    );
    const assistantEnds = events.filter(
      (event): event is Extract<HarnessEvent, { type: 'message_end' }> =>
        event.type === 'message_end' && event.message.role === 'assistant',
    );
    expect(assistantStarts).toHaveLength(1);
    expect(assistantEnds).toHaveLength(1);
    expect(assistantEnds[0]?.message.content).toEqual([{ type: 'text', text: 'Hello' }]);
    expect(harness.getCurrentRunId()).toBeNull();
  });

  it('sends active text signals without building idle stream options', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'active-signal-agent',
      name: 'active-signal-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('Hello'),
    });
    const harness = createHarness(storage, agent);
    const thread = await harness.createThread();

    const buildToolsets = vi.spyOn(harness as any, 'buildToolsets');
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => 'active-run-id',
    });
    const sendSignal = vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'active-run-id',
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = harness.sendSignal({ content: 'active hello' });
    await expect(signal.accepted).resolves.toEqual({ accepted: true, runId: 'active-run-id' });

    expect(buildToolsets).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ id: signal.id, type: 'user-message', contents: 'active hello' }),
      {
        resourceId: thread.resourceId,
        threadId: thread.id,
      },
    );
  });

  it('aborts the current thread stream through the active subscription', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'abort-followed-agent',
      name: 'abort-followed-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('Hello'),
    });
    const harness = createHarness(storage, agent);
    const abort = vi.fn();
    await harness.createThread();
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort,
      activeRunId: () => 'active-run-id',
    });
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'active-run-id',
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = harness.sendSignal({ content: 'active hello' });
    await signal.accepted;
    harness.abort();

    expect(abort).toHaveBeenCalled();
  });

  it('starts a new idle signal after a subscription-owned run completes', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'hi' });

    const signal = harness.sendSignal({ content: 'hows it going' });
    await signal.accepted;
    await waitFor(() =>
      events.some(
        event =>
          event.type === 'message_end' &&
          event.message.id === signal.id &&
          event.message.content.some(part => part.type === 'text' && part.text === 'hows it going'),
      ),
    );

    expect(events.some(event => event.type === 'error')).toBe(false);
  });

  it('continues approved tool streams through the active thread subscription', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'subscription-tool-agent',
      name: 'subscription-tool-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('unused'),
    });
    const harness = new Harness({
      id: 'subscription-tool-harness',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { yolo: true } as any,
    });
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {
        yield { type: 'start', runId: 'run-1', payload: {} };
        yield {
          type: 'tool-call-approval',
          runId: 'run-1',
          payload: { toolCallId: 'tool-1', toolName: 'testTool', args: { ok: true } },
        };
        yield { type: 'text-start', runId: 'run-1', payload: { id: 'text-1' } };
        yield { type: 'text-delta', runId: 'run-1', payload: { id: 'text-1', text: 'approved through subscription' } };
        yield { type: 'text-end', runId: 'run-1', payload: { id: 'text-1' } };
        yield { type: 'finish', payload: { stepResult: { reason: 'stop' } } };
      })() as any,
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => 'run-1',
    });
    const directResumeStream = (async function* () {
      yield { type: 'text-start', payload: { id: 'direct-text' } };
      yield { type: 'text-delta', payload: { id: 'direct-text', text: 'direct resume should not render' } };
      yield { type: 'finish', payload: { stepResult: { reason: 'stop' } } };
    })();
    const approveToolCall = vi
      .spyOn(agent, 'approveToolCall')
      .mockResolvedValue({ fullStream: directResumeStream } as any);
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'run-1',
      signal: createSignal({ type: 'user-message', contents: 'run tool' }),
    });

    await harness.createThread();
    const signal = harness.sendSignal({ content: 'run tool' });
    await signal.accepted;
    await waitFor(() =>
      events.some(
        event =>
          event.type === 'message_end' &&
          event.message.role === 'assistant' &&
          event.message.content.some(part => part.type === 'text' && part.text === 'approved through subscription'),
      ),
    );

    expect(approveToolCall).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-1', toolCallId: 'tool-1' }));
    expect(
      events.some(
        event =>
          event.type === 'message_end' &&
          event.message.content.some(part => part.type === 'text' && part.text === 'direct resume should not render'),
      ),
    ).toBe(false);
  });

  it('starts idle text signals through ifIdle stream options', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    const signal = harness.sendSignal({ content: 'hello from signal' });
    await signal.accepted;
    await waitFor(() => events.some(event => event.type === 'message_end' && event.message.role === 'assistant'));

    const signalEnd = events.find(
      (event): event is Extract<HarnessEvent, { type: 'message_end' }> =>
        event.type === 'message_end' && event.message.id === signal.id,
    );
    const assistantEnd = events.find(
      (event): event is Extract<HarnessEvent, { type: 'message_end' }> =>
        event.type === 'message_end' && event.message.role === 'assistant',
    );

    expect(signalEnd?.message.content).toEqual([{ type: 'text', text: 'hello from signal' }]);
    expect(assistantEnd?.message.content).toEqual([{ type: 'text', text: 'Hello' }]);
  });

  it('routes active interjections after repeated idle signal-started runs', async () => {
    const storage = new InMemoryStore();
    const releaseInitialCalls: Array<() => void> = [];
    const prompts: any[][] = [];
    let callCount = 0;

    const agent = new Agent({
      id: 'repeated-idle-harness-agent',
      name: 'repeated-idle-harness-agent',
      instructions: 'You are a test agent.',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          callCount += 1;
          const callIndex = callCount;
          prompts.push(prompt);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: `id-${callIndex}`,
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: `response ${callIndex}` });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                if (callIndex === 1 || callIndex === 3) {
                  await new Promise<void>(resolve => releaseInitialCalls.push(resolve));
                }
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const harness = createHarness(storage, agent);
    await harness.createThread();

    const firstIdle = harness.sendSignal({ content: 'start first idle stream' });
    await firstIdle.accepted;
    await waitFor(() => harness.getCurrentRunId() !== null && releaseInitialCalls.length === 1);
    const firstInterjection = harness.sendSignal({ content: 'first active interjection' });
    await firstInterjection.accepted;
    releaseInitialCalls.shift()?.();
    await waitFor(() => harness.getCurrentRunId() === null);
    expect(JSON.stringify(prompts[1])).toContain('first active interjection');

    const secondIdle = harness.sendSignal({ content: 'start second idle stream' });
    await secondIdle.accepted;
    await waitFor(() => harness.getCurrentRunId() !== null && releaseInitialCalls.length === 1);
    const secondInterjection = harness.sendSignal({ content: 'second active interjection' });
    await secondInterjection.accepted;
    releaseInitialCalls.shift()?.();
    await waitFor(() => harness.getCurrentRunId() === null);
    expect(JSON.stringify(prompts[3])).toContain('second active interjection');
  });

  it('emits echoed file user-message signals as user message events', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await (harness as any).processStreamChunk(
      (harness as any).createStreamState(),
      {
        type: 'data-user-message',
        data: {
          id: 'signal-file-1',
          type: 'user-message',
          contents: {
            role: 'user',
            content: [
              { type: 'text', text: 'Review this' },
              { type: 'file', data: 'data:text/plain;base64,aGVsbG8=', mediaType: 'text/plain', filename: 'note.txt' },
            ],
          },
          createdAt: '2026-05-04T00:00:00.000Z',
        },
      },
      new RequestContext(),
    );

    const signalEnd = events.find(event => event.type === 'message_end' && event.message.id === 'signal-file-1');
    expect(signalEnd).toMatchObject({
      type: 'message_end',
      message: {
        id: 'signal-file-1',
        role: 'user',
        content: [
          { type: 'text', text: 'Review this' },
          { type: 'file', data: 'data:text/plain;base64,aGVsbG8=', mediaType: 'text/plain', filename: 'note.txt' },
        ],
      },
    });
  });

  it('emits echoed user-message signals as user message events', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await (harness as any).processStreamChunk(
      (harness as any).createStreamState(),
      {
        type: 'data-user-message',
        data: {
          id: 'signal-user-1',
          type: 'user-message',
          contents: 'continue with this',
          createdAt: '2026-05-04T00:00:00.000Z',
        },
      },
      new RequestContext(),
    );

    const signalEvents = events.filter(
      event => (event.type === 'message_start' || event.type === 'message_end') && event.message.id === 'signal-user-1',
    );
    expect(signalEvents).toEqual([
      {
        type: 'message_start',
        message: {
          id: 'signal-user-1',
          role: 'user',
          content: [{ type: 'text', text: 'continue with this' }],
          createdAt: new Date('2026-05-04T00:00:00.000Z'),
        },
      },
      {
        type: 'message_end',
        message: {
          id: 'signal-user-1',
          role: 'user',
          content: [{ type: 'text', text: 'continue with this' }],
          createdAt: new Date('2026-05-04T00:00:00.000Z'),
        },
      },
    ]);
  });
});
