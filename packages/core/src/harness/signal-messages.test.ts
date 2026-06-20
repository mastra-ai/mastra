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
  it('converts sendMessage files into fenced text and preserved binary file parts', () => {
    const harness = createHarness(new InMemoryStore());
    const createMessageInput = (harness.session as unknown as {
        createMessageInput(input: {
          content: string;
          files?: Array<{ data: string; mediaType: string; filename?: string }>;
        }): unknown;
      }).createMessageInput.bind(harness.session);

    const input = createMessageInput({
      content: 'Review these attachments.',
      files: [
        {
          data: 'data:text/plain;base64,Y29uc29sZS5sb2coImhpIik7',
          mediaType: 'text/plain',
          filename: 'snippet.ts',
        },
        {
          data: 'data:application/octet-stream;base64,AAEC',
          mediaType: 'application/octet-stream',
          filename: 'archive.bin',
        },
      ],
    });

    expect(input).toEqual([
      { type: 'text', text: 'Review these attachments.' },
      { type: 'text', text: '[File: snippet.ts]\n```\nconsole.log("hi");\n```' },
      {
        type: 'file',
        data: 'data:application/octet-stream;base64,AAEC',
        mediaType: 'application/octet-stream',
        filename: 'archive.bin',
      },
    ]);
  });

  it('uses a longer fence than any backtick run in text attachments', () => {
    const harness = createHarness(new InMemoryStore());
    const createMessageInput = (harness.session as unknown as {
        createMessageInput(input: {
          content: string;
          files?: Array<{ data: string; mediaType: string; filename?: string }>;
        }): unknown;
      }).createMessageInput.bind(harness.session);

    const input = createMessageInput({
      content: 'Review this markdown.',
      files: [
        {
          data: 'const fence = ```nested```;',
          mediaType: 'text/markdown',
          filename: 'notes.md',
        },
      ],
    });

    expect(input).toEqual([
      { type: 'text', text: 'Review this markdown.' },
      { type: 'text', text: '[File: notes.md]\n````\nconst fence = ```nested```;\n````' },
    ]);
  });

  it('renders persisted user-message signal attributes', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const thread = await harness.session.thread.create();

    await storage.stores.memory!.saveMessages({
      messages: [
        createSignal({
          id: 'signal-user-1',
          type: 'user-message',
          contents: 'Continue with this',
          attributes: { delivery: 'while-active' },
          createdAt: new Date('2026-05-04T00:00:00.000Z'),
        }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId }),
      ],
    });

    await expect(harness.session.thread.listActiveMessages()).resolves.toEqual([
      {
        id: 'signal-user-1',
        role: 'user',
        content: [{ type: 'text', text: 'Continue with this' }],
        attributes: { delivery: 'while-active' },
        createdAt: new Date('2026-05-04T00:00:00.000Z'),
      },
    ]);
  });

  it('renders persisted system-reminder signals from signal attributes', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const thread = await harness.session.thread.create();

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

    await expect(harness.session.thread.listActiveMessages()).resolves.toEqual([
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

  it('normalizes system-reminder contents from text-part arrays', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const thread = await harness.session.thread.create();

    await storage.stores.memory!.saveMessages({
      messages: [
        createSignal({
          id: 'signal-array',
          type: 'system-reminder',
          contents: [
            { type: 'text', text: 'First line' },
            { type: 'text', text: 'Second line' },
          ],
          attributes: { type: 'dynamic-agents-md', path: '/tmp/AGENTS.md' },
          createdAt: new Date('2026-05-04T00:00:00.000Z'),
        }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId }),
      ],
    });

    await expect(harness.session.thread.listActiveMessages()).resolves.toEqual([
      {
        id: 'signal-array',
        role: 'user',
        content: [
          {
            type: 'system_reminder',
            message: 'First line\nSecond line',
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

  it('renders persisted generic reactive signals', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const thread = await harness.session.thread.create();

    await storage.stores.memory!.saveMessages({
      messages: [
        createSignal({
          id: 'reactive-signal-1',
          type: 'reactive',
          tagName: 'build-status',
          contents: 'Build is still running',
          attributes: { source: 'ci' },
          metadata: { buildId: 'build-1' },
          createdAt: new Date('2026-05-04T00:00:00.000Z'),
        }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId }),
      ],
    });

    await expect(harness.session.thread.listActiveMessages()).resolves.toEqual([
      {
        id: 'reactive-signal-1',
        role: 'user',
        content: [
          {
            type: 'reactive_signal',
            id: 'reactive-signal-1',
            tagName: 'build-status',
            message: 'Build is still running',
            attributes: { source: 'ci' },
            metadata: { buildId: 'build-1' },
          },
        ],
        createdAt: new Date('2026-05-04T00:00:00.000Z'),
      },
    ]);
  });

  it('renders persisted notification summary signals', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const thread = await harness.session.thread.create();

    await storage.stores.memory!.saveMessages({
      messages: [
        createSignal({
          id: 'summary-1',
          type: 'notification',
          tagName: 'notification-summary',
          contents: 'mastracode: 1',
          attributes: { pending: 1 },
          metadata: {
            notificationSummary: {
              threadId: thread.id,
              resourceId: thread.resourceId,
              pending: 1,
              bySource: { mastracode: 1 },
              byPriority: { low: 1 },
              notificationIds: ['notification-1'],
            },
            notificationIds: ['notification-1'],
          },
          createdAt: new Date('2026-05-04T00:00:00.000Z'),
        }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId }),
      ],
    });

    await expect(harness.session.thread.listActiveMessages()).resolves.toEqual([
      {
        id: 'summary-1',
        role: 'user',
        content: [
          {
            type: 'notification_summary',
            id: 'summary-1',
            message: 'mastracode: 1',
            pending: 1,
            bySource: { mastracode: 1 },
            byPriority: { low: 1 },
            notificationIds: ['notification-1'],
          },
        ],
        createdAt: new Date('2026-05-04T00:00:00.000Z'),
      },
    ]);
  });

  it('renders persisted full notification signals', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const thread = await harness.session.thread.create();

    await storage.stores.memory!.saveMessages({
      messages: [
        createSignal({
          id: 'notification-signal-1',
          type: 'notification',
          tagName: 'notification',
          contents: 'CI failed on main',
          attributes: {
            id: 'notification-1',
            source: 'github',
            kind: 'ci-status',
            priority: 'high',
            status: 'delivered',
          },
          metadata: {
            notification: {
              signal: 'notification',
              recordId: 'notification-1',
              source: 'github',
              kind: 'ci-status',
              priority: 'high',
              status: 'delivered',
            },
          },
          createdAt: new Date('2026-05-04T00:00:00.000Z'),
        }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId }),
      ],
    });

    await expect(harness.session.thread.listActiveMessages()).resolves.toEqual([
      {
        id: 'notification-signal-1',
        role: 'user',
        content: [
          {
            type: 'notification',
            id: 'notification-signal-1',
            notificationId: 'notification-1',
            message: 'CI failed on main',
            source: 'github',
            kind: 'ci-status',
            priority: 'high',
            status: 'delivered',
            attributes: {
              id: 'notification-1',
              source: 'github',
              kind: 'ci-status',
              priority: 'high',
              status: 'delivered',
            },
            metadata: {
              notification: {
                signal: 'notification',
                recordId: 'notification-1',
                source: 'github',
                kind: 'ci-status',
                priority: 'high',
                status: 'delivered',
              },
            },
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
    harness.session.subscribe(event => {
      events.push(event);
    });

    await harness.session.thread.create();
    await harness.session.sendMessage({ content: 'hello' });
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
    expect(harness.session.getCurrentRunId()).toBeNull();
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
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => 'active-run-id',
    });
    const thread = await harness.session.thread.create();

    // Simulate an active run from the harness consumer's perspective
    harness.session.run.setRunId({ runId: 'active-run-id' });

    const buildToolsets = vi.spyOn(harness as any, 'buildToolsets');
    const sendSignal = vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'active-run-id',
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = harness.session.sendSignal({ content: 'active hello' });
    await expect(signal.accepted).resolves.toEqual({ accepted: true, runId: 'active-run-id' });

    expect(buildToolsets).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ id: signal.id, type: 'user', tagName: 'user', contents: 'active hello' }),
      expect.objectContaining({
        resourceId: thread.resourceId,
        threadId: thread.id,
      }),
    );
  });

  it('tracks queued follow-ups in display state while running', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });

    harness.session.run.ensureAbortController();

    await harness.session.followUp({ content: 'queued follow-up' });

    expect(harness.session.followUps.count()).toBe(1);
    expect(harness.session.displayState.get().queuedFollowUps).toBe(1);
    expect(events).toContainEqual({ type: 'follow_up_queued', count: 1 });
  });

  it('uses queueMessage when draining follow-ups for a subscribed thread', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'follow-up-queue-agent',
      name: 'follow-up-queue-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('Hello'),
    });
    const harness = createHarness(storage, agent);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => 'run-1',
    });
    const queueMessage = vi.spyOn(agent, 'queueMessage').mockReturnValue({
      accepted: true,
      runId: 'queued-run-id',
      signal: createSignal({ type: 'user', contents: 'queued follow-up' }),
    });
    const sendSignal = vi.spyOn(agent, 'sendSignal');
    const thread = await harness.session.thread.create();
    harness.session.run.ensureAbortController();

    await harness.session.followUp({ content: 'queued follow-up' });
    await harness.session.drainFollowUpQueue();

    expect(queueMessage).toHaveBeenCalledWith(
      'queued follow-up',
      expect.objectContaining({
        resourceId: thread.resourceId,
        threadId: thread.id,
        ifIdle: expect.objectContaining({
          streamOptions: expect.objectContaining({
            memory: { thread: thread.id, resource: thread.resourceId },
            maxSteps: 1000,
            savePerStep: false,
            requireToolApproval: true,
          }),
        }),
      }),
    );
    expect(sendSignal).not.toHaveBeenCalled();
    expect(harness.session.followUps.count()).toBe(0);
    expect(harness.session.displayState.get().queuedFollowUps).toBe(0);
    expect(events).toContainEqual({ type: 'follow_up_queued', count: 1 });
    expect(events).toContainEqual({ type: 'follow_up_queued', count: 0, runId: 'queued-run-id' });
  });

  it('sends idle follow-ups immediately without marking them queued', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });
    const sendMessage = vi.spyOn(harness.session as any, 'sendMessage').mockResolvedValue(undefined);

    await harness.session.followUp({ content: 'idle follow-up' });

    expect(sendMessage).toHaveBeenCalledWith({ content: 'idle follow-up', requestContext: undefined });
    expect(harness.session.followUps.count()).toBe(0);
    expect(harness.session.displayState.get().queuedFollowUps).toBe(0);
    expect(events.some(event => event.type === 'follow_up_queued')).toBe(false);
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
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort,
      activeRunId: () => 'active-run-id',
    });
    await harness.session.thread.create();
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'active-run-id',
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = harness.session.sendSignal({ content: 'active hello' });
    await signal.accepted;
    harness.session.abort();

    expect(abort).toHaveBeenCalled();
  });

  it('aborts and unsubscribes the live thread stream when cleaning up the subscription', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'cleanup-subscription-agent',
      name: 'cleanup-subscription-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('Hello'),
    });
    const harness = createHarness(storage, agent);
    const abort = vi.fn(() => true);
    const unsubscribe = vi.fn();

    vi.spyOn(agent, 'subscribeToThread')
      .mockResolvedValueOnce({
        stream: (async function* () {})(),
        unsubscribe,
        abort,
        activeRunId: () => 'active-run-id',
      })
      .mockResolvedValue({
        stream: (async function* () {})(),
        unsubscribe: vi.fn(),
        abort: vi.fn(),
        activeRunId: () => null,
      });
    await harness.session.thread.create();
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'active-run-id',
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = harness.session.sendSignal({ content: 'active hello' });
    await signal.accepted;
    expect(harness.session.getCurrentRunId()).toBe('active-run-id');

    await harness.session.thread.create();

    expect(abort).toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
    expect(harness.session.getCurrentRunId()).toBeNull();
  });

  it('emits an error and clears run state when a subscription iterator throws', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'throwing-subscription-agent',
      name: 'throwing-subscription-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('Hello'),
    });
    const harness = createHarness(storage, agent);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });

    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {
        yield { type: 'start', runId: 'run-1' };
        throw new Error('subscription failed');
      })(),
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => 'run-1',
    });
    await harness.session.thread.create();

    await waitFor(() => events.some(event => event.type === 'agent_end' && event.reason === 'error'));

    expect(events.some(event => event.type === 'error' && event.error.message === 'subscription failed')).toBe(true);
    await waitFor(() => harness.session.getCurrentRunId() === null);
    expect(harness.session.getCurrentRunId()).toBeNull();
  });

  it('ignores trailing chunks from an aborted subscription run', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'abort-trailing-agent',
      name: 'abort-trailing-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('Hello'),
    });
    const harness = createHarness(storage, agent);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });

    let activeRunId: string | null = 'run-1';
    let releaseAbort!: () => void;
    const abortReleased = new Promise<void>(resolve => {
      releaseAbort = resolve;
    });
    const abort = vi.fn(() => {
      activeRunId = null;
      releaseAbort();
      return true;
    });

    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {
        yield { type: 'start', runId: 'run-1' };
        await abortReleased;
        yield { type: 'abort', runId: 'run-1' };
        yield { type: 'finish', runId: 'run-1' };
      })(),
      unsubscribe: vi.fn(),
      abort,
      activeRunId: () => activeRunId,
    });
    await harness.session.thread.create();
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'run-1',
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = harness.session.sendSignal({ content: 'active hello' });
    await signal.accepted;
    await waitFor(() => events.some(event => event.type === 'agent_start'));
    harness.session.abort();
    await waitFor(() => events.some(event => event.type === 'agent_end'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(events.filter(event => event.type === 'agent_start')).toHaveLength(1);
    expect(events.filter(event => event.type === 'agent_end')).toEqual([{ type: 'agent_end', reason: 'aborted' }]);
  });

  it('starts a new idle signal after a subscription-owned run completes', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });

    await harness.session.thread.create();
    await harness.session.sendMessage({ content: 'hi' });

    const signal = harness.session.sendSignal({ content: 'hows it going' });
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
    harness.session.subscribe(event => {
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

    await harness.session.thread.create();
    const signal = harness.session.sendSignal({ content: 'run tool' });
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
    harness.session.subscribe(event => {
      events.push(event);
    });

    await harness.session.thread.create();
    const signal = harness.session.sendSignal({ content: 'hello from signal' });
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

  it('does not carry a stale abort reason into a later idle signal run', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });

    await harness.session.thread.create();
    harness.session.abort();
    const signal = harness.session.sendSignal({ content: 'hello after stale abort' });
    await signal.accepted;
    await waitFor(() => events.some(event => event.type === 'agent_end'));

    const agentEnd = events.find(
      (event): event is Extract<HarnessEvent, { type: 'agent_end' }> => event.type === 'agent_end',
    );
    expect(agentEnd?.reason).toBe('complete');
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
    await harness.session.thread.create();

    const firstIdle = harness.session.sendSignal({ content: 'start first idle stream' });
    await firstIdle.accepted;
    await waitFor(() => harness.session.getCurrentRunId() !== null && releaseInitialCalls.length === 1);
    const firstInterjection = harness.session.sendSignal({ content: 'first active interjection' });
    await firstInterjection.accepted;
    releaseInitialCalls.shift()?.();
    await waitFor(() => harness.session.getCurrentRunId() === null);
    expect(JSON.stringify(prompts[1])).toContain('first active interjection');

    const secondIdle = harness.session.sendSignal({ content: 'start second idle stream' });
    await secondIdle.accepted;
    await waitFor(() => harness.session.getCurrentRunId() !== null && releaseInitialCalls.length === 1);
    const secondInterjection = harness.session.sendSignal({ content: 'second active interjection' });
    await secondInterjection.accepted;
    releaseInitialCalls.shift()?.();
    await waitFor(() => harness.session.getCurrentRunId() === null);
    expect(JSON.stringify(prompts[3])).toContain('second active interjection');
  });

  it('emits echoed file user-message signals as user message events', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });

    await harness.session.runEngine.processStreamChunk(
      harness.session.runEngine.createStreamState(),
      {
        type: 'data-user-message',
        data: {
          id: 'signal-file-1',
          type: 'user-message',
          contents: [
            { type: 'text', text: 'Review this' },
            { type: 'file', data: 'data:text/plain;base64,aGVsbG8=', mediaType: 'text/plain', filename: 'note.txt' },
          ],
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
    harness.session.subscribe(event => {
      events.push(event);
    });

    await harness.session.runEngine.processStreamChunk(
      harness.session.runEngine.createStreamState(),
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

  it('closes the current assistant message when a goal chunk arrives before continuation text', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });
    const state = harness.session.runEngine.createStreamState();
    const requestContext = new RequestContext();

    await harness.session.runEngine.processStreamChunk(state, { type: 'text-start', payload: { id: 'text-1' } }, requestContext);
    await harness.session.runEngine.processStreamChunk(
      state,
      { type: 'text-delta', payload: { id: 'text-1', text: 'Fact 1' } },
      requestContext,
    );
    await harness.session.runEngine.processStreamChunk(
      state,
      {
        type: 'goal',
        payload: {
          objective: 'three whale facts',
          iteration: 1,
          maxRuns: 500,
          passed: false,
          status: 'active',
          results: [],
          reason: 'continue',
          duration: 0,
          timedOut: false,
          maxRunsReached: false,
          suppressFeedback: false,
        },
      },
      requestContext,
    );
    await harness.session.runEngine.processStreamChunk(state, { type: 'text-start', payload: { id: 'text-2' } }, requestContext);
    await harness.session.runEngine.processStreamChunk(
      state,
      { type: 'text-delta', payload: { id: 'text-2', text: 'Fact 2' } },
      requestContext,
    );

    const messageEndEvents = events.filter(
      (event): event is Extract<HarnessEvent, { type: 'message_end' }> => event.type === 'message_end',
    );
    const messageUpdateEvents = events.filter(
      (event): event is Extract<HarnessEvent, { type: 'message_update' }> => event.type === 'message_update',
    );

    expect(messageEndEvents).toHaveLength(1);
    expect(messageEndEvents[0].message.content).toEqual([{ type: 'text', text: 'Fact 1' }]);
    expect(messageUpdateEvents.at(-1)?.message.content).toEqual([{ type: 'text', text: 'Fact 2' }]);
    expect(messageUpdateEvents.at(-1)?.message.id).not.toBe(messageEndEvents[0].message.id);
  });

  it('emits generic reactive signal data parts as renderable message updates', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });
    const state = harness.session.runEngine.createStreamState();

    await harness.session.runEngine.processStreamChunk(
      state,
      {
        type: 'data-signal',
        data: {
          id: 'reactive-signal-1',
          type: 'reactive',
          tagName: 'build-status',
          contents: 'Build is still running',
          createdAt: '2026-05-04T00:00:00.000Z',
          attributes: { source: 'ci' },
          metadata: { buildId: 'build-1' },
        },
      },
      new RequestContext(),
    );

    expect(events).toContainEqual({
      type: 'message_update',
      message: expect.objectContaining({
        role: 'assistant',
        content: [
          {
            type: 'reactive_signal',
            id: 'reactive-signal-1',
            tagName: 'build-status',
            message: 'Build is still running',
            attributes: { source: 'ci' },
            metadata: { buildId: 'build-1' },
          },
        ],
      }),
    });
  });

  it('emits notification summary data parts as renderable message updates', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });
    const state = harness.session.runEngine.createStreamState();

    await harness.session.runEngine.processStreamChunk(
      state,
      {
        type: 'data-signal',
        data: {
          id: 'summary-1',
          type: 'notification',
          tagName: 'notification-summary',
          contents: 'mastracode: 1',
          createdAt: '2026-05-04T00:00:00.000Z',
          metadata: {
            notificationSummary: {
              threadId: 'thread-1',
              resourceId: 'resource-1',
              pending: 1,
              bySource: { mastracode: 1 },
              byPriority: { low: 1 },
              notificationIds: ['notification-1'],
            },
            notificationIds: ['notification-1'],
          },
        },
      },
      new RequestContext(),
    );

    expect(events).toContainEqual({
      type: 'message_update',
      message: expect.objectContaining({
        role: 'assistant',
        content: [
          {
            type: 'notification_summary',
            id: 'summary-1',
            message: 'mastracode: 1',
            pending: 1,
            bySource: { mastracode: 1 },
            byPriority: { low: 1 },
            notificationIds: ['notification-1'],
          },
        ],
      }),
    });
  });

  it('emits full notification data parts as renderable message updates', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });
    const state = harness.session.runEngine.createStreamState();

    await harness.session.runEngine.processStreamChunk(
      state,
      {
        type: 'data-signal',
        data: {
          id: 'notification-signal-1',
          type: 'notification',
          tagName: 'notification',
          contents: 'CI failed on main',
          createdAt: '2026-05-04T00:00:00.000Z',
          attributes: {
            id: 'notification-1',
            source: 'github',
            kind: 'ci-status',
            priority: 'high',
            status: 'delivered',
          },
          metadata: {
            notification: {
              signal: 'notification',
              recordId: 'notification-1',
              source: 'github',
              kind: 'ci-status',
              priority: 'high',
              status: 'delivered',
            },
          },
        },
      },
      new RequestContext(),
    );

    expect(events).toContainEqual({
      type: 'message_update',
      message: expect.objectContaining({
        role: 'assistant',
        content: [
          {
            type: 'notification',
            id: 'notification-signal-1',
            notificationId: 'notification-1',
            message: 'CI failed on main',
            source: 'github',
            kind: 'ci-status',
            priority: 'high',
            status: 'delivered',
            attributes: {
              id: 'notification-1',
              source: 'github',
              kind: 'ci-status',
              priority: 'high',
              status: 'delivered',
            },
            metadata: {
              notification: {
                signal: 'notification',
                recordId: 'notification-1',
                source: 'github',
                kind: 'ci-status',
                priority: 'high',
                status: 'delivered',
              },
            },
          },
        ],
      }),
    });
  });

  it('emits state signal data parts as renderable message updates', async () => {
    const storage = new InMemoryStore();
    const harness = createHarness(storage);
    const events: HarnessEvent[] = [];
    harness.session.subscribe(event => {
      events.push(event);
    });
    const state = harness.session.runEngine.createStreamState();

    await harness.session.runEngine.processStreamChunk(
      state,
      {
        type: 'data-signal',
        data: {
          id: 'state-signal-1',
          type: 'state',
          tagName: 'state',
          contents: 'changed: active tab URL changed to https://example.com',
          createdAt: '2026-05-04T00:00:00.000Z',
          metadata: {
            state: {
              id: 'browser',
              mode: 'delta',
              cacheKey: 'browser:https://example.com',
              version: 2,
            },
          },
        },
      },
      new RequestContext(),
    );

    expect(events).toContainEqual({
      type: 'message_update',
      message: expect.objectContaining({
        role: 'assistant',
        content: [
          {
            type: 'state_signal',
            id: 'state-signal-1',
            stateId: 'browser',
            mode: 'delta',
            cacheKey: 'browser:https://example.com',
            version: 2,
            message: 'changed: active tab URL changed to https://example.com',
          },
        ],
      }),
    });
  });
});
