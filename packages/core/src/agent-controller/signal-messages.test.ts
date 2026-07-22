import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { createSignal } from '../agent/signals';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

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
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for controller events');
}

async function createController(
  storage: InMemoryStore,
  agent: Agent<any, any, any, any> = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: createTextStreamModel('Hello'),
  }),
) {
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { controller, session };
}

describe('AgentController signal messages', () => {
  it('converts sendMessage files into fenced text and preserved binary file parts', async () => {
    const { session } = await createController(new InMemoryStore());
    const createMessageInput = (
      session as unknown as {
        createMessageInput(input: {
          content: string;
          files?: Array<{ data: string; mediaType: string; filename?: string }>;
        }): unknown;
      }
    ).createMessageInput.bind(session);

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

  it('uses a longer fence than any backtick run in text attachments', async () => {
    const { session } = await createController(new InMemoryStore());
    const createMessageInput = (
      session as unknown as {
        createMessageInput(input: {
          content: string;
          files?: Array<{ data: string; mediaType: string; filename?: string }>;
        }): unknown;
      }
    ).createMessageInput.bind(session);

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

  // DB-native contract: history reads return the persisted MastraDBMessage verbatim
  // (role 'signal', nested content.parts, signal identity on content.metadata.signal).
  // Consumers read signals from this shape instead of a flattened UI union.
  it('returns persisted user-message signals as DB-native signal messages', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const thread = await session.thread.create();

    const persisted = createSignal({
      id: 'signal-user-1',
      type: 'user-message',
      contents: 'Continue with this',
      attributes: { delivery: 'while-active' },
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId });

    await storage.stores.memory!.saveMessages({ messages: [persisted] });

    await expect(session.thread.listActiveMessages()).resolves.toEqual([persisted]);
  });

  it('returns persisted system-reminder signals as DB-native signal messages', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const thread = await session.thread.create();

    const persisted = createSignal({
      id: 'signal-1',
      type: 'system-reminder',
      contents: 'Remember the repo instructions',
      attributes: { type: 'dynamic-agents-md', path: '/tmp/AGENTS.md' },
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId });

    await storage.stores.memory!.saveMessages({ messages: [persisted] });

    await expect(session.thread.listActiveMessages()).resolves.toEqual([persisted]);
  });

  it('preserves system-reminder text-part arrays in DB-native signal messages', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const thread = await session.thread.create();

    const persisted = createSignal({
      id: 'signal-array',
      type: 'system-reminder',
      contents: [
        { type: 'text', text: 'First line' },
        { type: 'text', text: 'Second line' },
      ],
      attributes: { type: 'dynamic-agents-md', path: '/tmp/AGENTS.md' },
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId });

    await storage.stores.memory!.saveMessages({ messages: [persisted] });

    await expect(session.thread.listActiveMessages()).resolves.toEqual([persisted]);
  });

  it('returns persisted generic reactive signals as DB-native signal messages', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const thread = await session.thread.create();

    const persisted = createSignal({
      id: 'reactive-signal-1',
      type: 'reactive',
      tagName: 'build-status',
      contents: 'Build is still running',
      attributes: { source: 'ci' },
      metadata: { buildId: 'build-1' },
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId });

    await storage.stores.memory!.saveMessages({ messages: [persisted] });

    await expect(session.thread.listActiveMessages()).resolves.toEqual([persisted]);
  });

  it('returns persisted notification summary signals as DB-native signal messages', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const thread = await session.thread.create();

    const persisted = createSignal({
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
    }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId });

    await storage.stores.memory!.saveMessages({ messages: [persisted] });

    await expect(session.thread.listActiveMessages()).resolves.toEqual([persisted]);
  });

  it('returns persisted full notification signals as DB-native signal messages', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const thread = await session.thread.create();

    const persisted = createSignal({
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
    }).toDBMessage({ threadId: thread.id, resourceId: thread.resourceId });

    await storage.stores.memory!.saveMessages({ messages: [persisted] });

    await expect(session.thread.listActiveMessages()).resolves.toEqual([persisted]);
  });

  it('processes sendMessage streams once through the active thread subscription', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.thread.create();
    await session.sendMessage({ content: 'hello' });
    await waitFor(() => events.some(event => event.type === 'message_end' && event.message.role === 'assistant'));

    const assistantStarts = events.filter(
      (event): event is Extract<AgentControllerEvent, { type: 'message_start' }> =>
        event.type === 'message_start' && event.message.role === 'assistant',
    );
    const assistantEnds = events.filter(
      (event): event is Extract<AgentControllerEvent, { type: 'message_end' }> =>
        event.type === 'message_end' && event.message.role === 'assistant',
    );
    expect(assistantStarts).toHaveLength(1);
    expect(assistantEnds).toHaveLength(1);
    expect(assistantEnds[0]?.message.content.parts).toEqual([{ type: 'text', text: 'Hello' }]);
    expect(session.getCurrentRunId()).toBeNull();
  });

  it('uses explicit request context when a prebuilt signal starts an idle run', async () => {
    const storage = new InMemoryStore();
    const { controller, session } = await createController(storage);
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
    const buildToolsets = vi.spyOn(controller as any, 'buildToolsets');

    const signal = session.sendSignal(
      { id: 'factory-skill-1', type: 'user', tagName: 'user', contents: 'investigate' },
      { requestContext },
    );
    await signal.accepted;

    expect(buildToolsets).toHaveBeenCalledWith(session, requestContext);
  });

  it('sends active text signals without building idle stream options', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'active-signal-agent',
      name: 'active-signal-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('Hello'),
    });
    const { controller, session } = await createController(storage, agent);
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => 'active-run-id',
    });
    const thread = await session.thread.create();

    // Simulate an active run from the controller consumer's perspective
    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'active-run-id' });

    const buildToolsets = vi.spyOn(controller as any, 'buildToolsets');
    const sendSignal = vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: Promise.resolve({ action: 'deliver', runId: 'active-run-id' }),
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = session.sendSignal({ content: 'active hello' });
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

  it('starts a new run instead of dispatching onto an aborted run when a follow-up arrives mid-abort', async () => {
    // Regression: after Ctrl+C (abort), the AbortController is cleared
    // immediately but the run id and active-run id linger until `run.reset()`
    // fires (after agent_end). Without the isRunning() guard in sendSignal,
    // the follow-up signal is dispatched onto the dying run and lost.
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'abort-followup-agent',
      name: 'abort-followup-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('World'),
    });
    const { controller, session } = await createController(storage, agent);
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => 'run-1',
    });
    const thread = await session.thread.create();

    // Simulate an active run, then abort it — exactly what Ctrl+C does.
    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'run-1' });
    session.abort();

    // After abort: isRunning() is false, but getRunId() and activeRunId()
    // still return 'run-1' (not yet reset by agent_end).
    expect(session.run.isRunning()).toBe(false);
    expect(session.run.getRunId()).toBe('run-1');
    expect(session.stream.activeRunId()).toBe('run-1');

    const buildToolsets = vi.spyOn(controller as any, 'buildToolsets');
    const sendSignal = vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: Promise.resolve({ action: 'deliver', runId: 'new-run-id' }),
      signal: createSignal({ type: 'user-message', contents: 'follow-up after abort' }),
    });

    const signal = session.sendSignal({ content: 'follow-up after abort' });
    await expect(signal.accepted).resolves.toEqual({ accepted: true, runId: undefined });

    // buildToolsets is only called in the new-run (idle) branch, proving
    // the signal did NOT dispatch onto the dying run.
    expect(buildToolsets).toHaveBeenCalledTimes(1);
    // sendSignal must include streamOptions in ifIdle (new-run branch),
    // not bare ifActive/ifIdle (active-run branch).
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'follow-up after abort' }),
      expect.objectContaining({
        resourceId: thread.resourceId,
        threadId: thread.id,
        ifIdle: expect.objectContaining({ streamOptions: expect.any(Object) }),
      }),
    );
  });

  it('waits for post-abort stream teardown before starting the follow-up run', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'abort-idle-wait-agent',
      name: 'abort-idle-wait-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('World'),
    });
    const { controller, session } = await createController(storage, agent);
    let activeRunId: string | null = 'run-1';
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => activeRunId,
    });
    const thread = await session.thread.create();

    session.run.ensureAbortController();
    session.run.setRunId({ runId: 'run-1' });
    session.abort();

    const buildToolsets = vi.spyOn(controller as any, 'buildToolsets');
    const sendSignal = vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: Promise.resolve({ action: 'deliver', runId: 'new-run-id' }),
      signal: createSignal({ type: 'user-message', contents: 'follow-up after abort' }),
    });

    const signal = session.sendSignal({ content: 'follow-up after abort' });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(buildToolsets).not.toHaveBeenCalled();
    expect(sendSignal).not.toHaveBeenCalled();

    activeRunId = null;
    session.run.reset();

    await expect(signal.accepted).resolves.toEqual({ accepted: true, runId: undefined });
    expect(buildToolsets).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'follow-up after abort' }),
      expect.objectContaining({
        resourceId: thread.resourceId,
        threadId: thread.id,
        ifIdle: expect.objectContaining({ streamOptions: expect.any(Object) }),
      }),
    );
  });

  it('tracks queued follow-ups in display state while running', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    session.run.ensureAbortController();

    await session.followUp({ content: 'queued follow-up' });

    expect(session.followUps.count()).toBe(1);
    expect(session.displayState.get().queuedFollowUps).toBe(1);
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
    const { session } = await createController(storage, agent);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => 'run-1',
    });
    const queueMessage = vi.spyOn(agent, 'queueMessage').mockReturnValue({
      accepted: Promise.resolve({ action: 'deliver', runId: 'queued-run-id' }),
      signal: createSignal({ type: 'user', contents: 'queued follow-up' }),
    });
    const sendSignal = vi.spyOn(agent, 'sendSignal');
    const thread = await session.thread.create();
    session.run.ensureAbortController();

    await session.followUp({ content: 'queued follow-up' });
    await session.drainFollowUpQueue();

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
    expect(session.followUps.count()).toBe(0);
    expect(session.displayState.get().queuedFollowUps).toBe(0);
    expect(events).toContainEqual({ type: 'follow_up_queued', count: 1 });
    expect(events).toContainEqual({ type: 'follow_up_queued', count: 0, runId: 'queued-run-id' });
  });

  it('sends idle follow-ups immediately without marking them queued', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    const sendMessage = vi.spyOn(session as any, 'sendMessage').mockResolvedValue(undefined);

    await session.followUp({ content: 'idle follow-up' });

    expect(sendMessage).toHaveBeenCalledWith({ content: 'idle follow-up', requestContext: undefined });
    expect(session.followUps.count()).toBe(0);
    expect(session.displayState.get().queuedFollowUps).toBe(0);
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
    const { session } = await createController(storage, agent);
    const abort = vi.fn();
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})(),
      unsubscribe: vi.fn(),
      abort,
      activeRunId: () => 'active-run-id',
    });
    await session.thread.create();
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: Promise.resolve({ action: 'deliver', runId: 'active-run-id' }),
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = session.sendSignal({ content: 'active hello' });
    await signal.accepted;
    session.abort();

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
    const { session } = await createController(storage, agent);
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
    await session.thread.create();
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: Promise.resolve({ action: 'deliver', runId: 'active-run-id' }),
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = session.sendSignal({ content: 'active hello' });
    await signal.accepted;
    expect(session.getCurrentRunId()).toBe('active-run-id');

    await session.thread.create();

    expect(abort).toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
    expect(session.getCurrentRunId()).toBeNull();
  });

  it('emits an error and clears run state when a subscription iterator throws', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'throwing-subscription-agent',
      name: 'throwing-subscription-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('Hello'),
    });
    const { session } = await createController(storage, agent);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
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
    await session.thread.create();

    await waitFor(() => events.some(event => event.type === 'agent_end' && event.reason === 'error'));

    expect(events.some(event => event.type === 'error' && event.error.message === 'subscription failed')).toBe(true);
    await waitFor(() => session.getCurrentRunId() === null);
    expect(session.getCurrentRunId()).toBeNull();
  });

  it('ignores trailing chunks from an aborted subscription run', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'abort-trailing-agent',
      name: 'abort-trailing-agent',
      instructions: 'You are a test agent.',
      model: createTextStreamModel('Hello'),
    });
    const { session } = await createController(storage, agent);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
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
    await session.thread.create();
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }),
      signal: createSignal({ type: 'user-message', contents: 'active hello' }),
    });

    const signal = session.sendSignal({ content: 'active hello' });
    await signal.accepted;
    await waitFor(() => events.some(event => event.type === 'agent_start'));
    session.abort();
    await waitFor(() => events.some(event => event.type === 'agent_end'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(events.filter(event => event.type === 'agent_start')).toHaveLength(1);
    expect(events.filter(event => event.type === 'agent_end')).toEqual([{ type: 'agent_end', reason: 'aborted' }]);
  });

  it('starts a new idle signal after a subscription-owned run completes', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.thread.create();
    await session.sendMessage({ content: 'hi' });

    const signal = session.sendSignal({ content: 'hows it going' });
    await signal.accepted;
    await waitFor(() =>
      events.some(
        event =>
          event.type === 'message_end' &&
          event.message.id === signal.id &&
          event.message.content.parts.some(
            part => part.type === 'data-user-message' && part.data?.contents === 'hows it going',
          ),
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
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'subscription-tool-controller',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { yolo: true } as any,
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
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
    const sendToolApproval = vi.spyOn(agent, 'sendToolApproval').mockResolvedValue({
      accepted: true,
      runId: 'run-1',
      toolCallId: 'tool-1',
    });
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }),
      signal: createSignal({ type: 'user-message', contents: 'run tool' }),
    });

    await session.thread.create();
    const signal = session.sendSignal({ content: 'run tool' });
    await signal.accepted;
    await waitFor(() =>
      events.some(
        event =>
          event.type === 'message_end' &&
          event.message.role === 'assistant' &&
          event.message.content.parts.some(
            part => part.type === 'text' && part.text === 'approved through subscription',
          ),
      ),
    );

    expect(sendToolApproval).toHaveBeenCalledWith(expect.objectContaining({ approved: true, toolCallId: 'tool-1' }));
  });

  it('starts idle text signals through ifIdle stream options', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.thread.create();
    const signal = session.sendSignal({ content: 'hello from signal' });
    await signal.accepted;
    await waitFor(() => events.some(event => event.type === 'message_end' && event.message.role === 'assistant'));

    const signalEnd = events.find(
      (event): event is Extract<AgentControllerEvent, { type: 'message_end' }> =>
        event.type === 'message_end' && event.message.id === signal.id,
    );
    const assistantEnd = events.find(
      (event): event is Extract<AgentControllerEvent, { type: 'message_end' }> =>
        event.type === 'message_end' && event.message.role === 'assistant',
    );

    // DB-native: the echoed user-message signal ends as a role:'signal' message
    // carrying the raw data-user-message part (id/createdAt are dynamic).
    expect(signalEnd?.message.role).toBe('signal');
    expect(signalEnd?.message.content.parts).toEqual([
      expect.objectContaining({
        type: 'data-user-message',
        data: expect.objectContaining({ type: 'user', contents: 'hello from signal' }),
      }),
    ]);
    expect(assistantEnd?.message.content.parts).toEqual([{ type: 'text', text: 'Hello' }]);
  });

  it('does not carry a stale abort reason into a later idle signal run', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.thread.create();
    session.abort();
    const signal = session.sendSignal({ content: 'hello after stale abort' });
    await signal.accepted;
    await waitFor(() => events.some(event => event.type === 'agent_end'));

    const agentEnd = events.find(
      (event): event is Extract<AgentControllerEvent, { type: 'agent_end' }> => event.type === 'agent_end',
    );
    expect(agentEnd?.reason).toBe('complete');
  });

  it('routes active interjections after repeated idle signal-started runs', async () => {
    const storage = new InMemoryStore();
    const releaseInitialCalls: Array<() => void> = [];
    const prompts: any[][] = [];
    let callCount = 0;

    const agent = new Agent({
      id: 'repeated-idle-controller-agent',
      name: 'repeated-idle-controller-agent',
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
    const { session } = await createController(storage, agent);
    await session.thread.create();

    const firstIdle = session.sendSignal({ content: 'start first idle stream' });
    await firstIdle.accepted;
    await waitFor(() => session.getCurrentRunId() !== null && releaseInitialCalls.length === 1);
    const firstInterjection = session.sendSignal({ content: 'first active interjection' });
    await firstInterjection.accepted;
    releaseInitialCalls.shift()?.();
    await waitFor(() => session.getCurrentRunId() === null);
    expect(JSON.stringify(prompts[1])).toContain('first active interjection');

    const secondIdle = session.sendSignal({ content: 'start second idle stream' });
    await secondIdle.accepted;
    await waitFor(() => session.getCurrentRunId() !== null && releaseInitialCalls.length === 1);
    const secondInterjection = session.sendSignal({ content: 'second active interjection' });
    await secondInterjection.accepted;
    releaseInitialCalls.shift()?.();
    await waitFor(() => session.getCurrentRunId() === null);
    expect(JSON.stringify(prompts[3])).toContain('second active interjection');
  });

  it('emits echoed file user-message signals as user message events', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.runEngine.processStreamChunk(
      session.runEngine.createStreamState(),
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

    // DB-native: the echoed file user-message signal preserves its raw
    // data-user-message part (including the original contents array) verbatim.
    const signalEnd = events.find(event => event.type === 'message_end' && event.message.id === 'signal-file-1');
    expect(signalEnd).toMatchObject({
      type: 'message_end',
      message: {
        id: 'signal-file-1',
        role: 'signal',
        content: {
          format: 2,
          parts: [
            {
              type: 'data-user-message',
              data: {
                id: 'signal-file-1',
                type: 'user-message',
                contents: [
                  { type: 'text', text: 'Review this' },
                  {
                    type: 'file',
                    data: 'data:text/plain;base64,aGVsbG8=',
                    mediaType: 'text/plain',
                    filename: 'note.txt',
                  },
                ],
                createdAt: '2026-05-04T00:00:00.000Z',
              },
            },
          ],
        },
      },
    });
  });

  it('emits echoed user-message signals as user message events', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.runEngine.processStreamChunk(
      session.runEngine.createStreamState(),
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
    // DB-native: the echoed user-message signal is emitted as a 'signal'-role
    // MastraDBMessage carrying the raw data-user-message part (no flattening).
    const expectedMessage = {
      id: 'signal-user-1',
      role: 'signal',
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
      content: {
        format: 2,
        parts: [
          {
            type: 'data-user-message',
            data: {
              id: 'signal-user-1',
              type: 'user-message',
              contents: 'continue with this',
              createdAt: '2026-05-04T00:00:00.000Z',
            },
          },
        ],
        metadata: {
          signal: {
            id: 'signal-user-1',
            type: 'user-message',
            contents: 'continue with this',
            createdAt: '2026-05-04T00:00:00.000Z',
          },
        },
      },
    };
    expect(signalEvents).toEqual([
      { type: 'message_start', message: expectedMessage },
      { type: 'message_end', message: expectedMessage },
    ]);
  });

  it('closes the current assistant message when a goal chunk arrives before continuation text', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    const state = session.runEngine.createStreamState();
    const requestContext = new RequestContext();

    await session.runEngine.processStreamChunk(
      state,
      { type: 'text-start', payload: { id: 'text-1' } },
      requestContext,
    );
    await session.runEngine.processStreamChunk(
      state,
      { type: 'text-delta', payload: { id: 'text-1', text: 'Fact 1' } },
      requestContext,
    );
    await session.runEngine.processStreamChunk(
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
    await session.runEngine.processStreamChunk(
      state,
      { type: 'text-start', payload: { id: 'text-2' } },
      requestContext,
    );
    await session.runEngine.processStreamChunk(
      state,
      { type: 'text-delta', payload: { id: 'text-2', text: 'Fact 2' } },
      requestContext,
    );

    const messageEndEvents = events.filter(
      (event): event is Extract<AgentControllerEvent, { type: 'message_end' }> => event.type === 'message_end',
    );
    const messageUpdateEvents = events.filter(
      (event): event is Extract<AgentControllerEvent, { type: 'message_update' }> => event.type === 'message_update',
    );

    expect(messageEndEvents).toHaveLength(1);
    expect(messageEndEvents[0].message.content.parts).toEqual([{ type: 'text', text: 'Fact 1' }]);
    expect(messageUpdateEvents.at(-1)?.message.content.parts).toEqual([{ type: 'text', text: 'Fact 2' }]);
    expect(messageUpdateEvents.at(-1)?.message.id).not.toBe(messageEndEvents[0].message.id);
  });

  it('emits generic reactive signal data parts as renderable message updates', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    const state = session.runEngine.createStreamState();

    await session.runEngine.processStreamChunk(
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

    // DB-native: a reactive data-signal chunk emits a 'signal'-role MastraDBMessage
    // carrying the raw data-signal part, not a flattened assistant content item.
    const signalData = {
      id: 'reactive-signal-1',
      type: 'reactive',
      tagName: 'build-status',
      contents: 'Build is still running',
      createdAt: '2026-05-04T00:00:00.000Z',
      attributes: { source: 'ci' },
      metadata: { buildId: 'build-1' },
    };
    expect(events).toContainEqual({
      type: 'message_start',
      message: expect.objectContaining({
        role: 'signal',
        content: expect.objectContaining({
          format: 2,
          parts: [{ type: 'data-signal', data: signalData }],
          metadata: { signal: signalData },
        }),
      }),
    });
  });

  it('emits notification summary data parts as renderable message updates', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    const state = session.runEngine.createStreamState();

    const signalData = {
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
    };
    await session.runEngine.processStreamChunk(state, { type: 'data-signal', data: signalData }, new RequestContext());

    expect(events).toContainEqual({
      type: 'message_start',
      message: expect.objectContaining({
        role: 'signal',
        content: expect.objectContaining({
          format: 2,
          parts: [{ type: 'data-signal', data: signalData }],
          metadata: { signal: signalData },
        }),
      }),
    });
  });

  it('emits full notification data parts as renderable message updates', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    const state = session.runEngine.createStreamState();

    const signalData = {
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
    };
    await session.runEngine.processStreamChunk(state, { type: 'data-signal', data: signalData }, new RequestContext());

    expect(events).toContainEqual({
      type: 'message_start',
      message: expect.objectContaining({
        role: 'signal',
        content: expect.objectContaining({
          format: 2,
          parts: [{ type: 'data-signal', data: signalData }],
          metadata: { signal: signalData },
        }),
      }),
    });
  });

  it('emits state signal data parts as renderable message updates', async () => {
    const storage = new InMemoryStore();
    const { session } = await createController(storage);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    const state = session.runEngine.createStreamState();

    const signalData = {
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
    };
    await session.runEngine.processStreamChunk(state, { type: 'data-signal', data: signalData }, new RequestContext());

    expect(events).toContainEqual({
      type: 'message_start',
      message: expect.objectContaining({
        role: 'signal',
        content: expect.objectContaining({
          format: 2,
          parts: [{ type: 'data-signal', data: signalData }],
          metadata: { signal: signalData },
        }),
      }),
    });
  });
});
