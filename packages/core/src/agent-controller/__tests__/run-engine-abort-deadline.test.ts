import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../request-context';
import { Workspace } from '../../workspace';
import { LocalFilesystem } from '../../workspace/filesystem/local-filesystem';
import type { SessionMachinery } from '../session';
import { Session } from '../session';
import { SessionRunEngine } from '../session-run-engine';
import type { AgentControllerEvent } from '../types';

type StreamChunk = Parameters<SessionRunEngine['processStreamChunk']>[1];

function createHarness() {
  const events: AgentControllerEvent[] = [];
  let idCounter = 0;

  const session = new Session({
    resourceId: 'resource-1',
    id: 'session-1',
    ownerId: 'owner-1',
    workspace: new Workspace({
      id: 'workspace-1',
      filesystem: new LocalFilesystem({ basePath: '/tmp' }),
    }),
  });
  session.thread.set({ threadId: 'thread-1' });
  session.subscribe(event => {
    events.push(event);
  });

  const machinery: SessionMachinery = {
    getAgent: () => ({ id: 'agent-stub' }) as unknown as ReturnType<SessionMachinery['getAgent']>,
    getRunScope: () => undefined,
    subscribeToThread: async () => {
      throw new Error('subscribeToThread is not used by these tests');
    },
    buildStreamOptions: async () => ({}),
    buildSharedRunOptions: () => ({}),
    buildToolsets: async () => ({}),
    buildRequestContext: async requestContext => requestContext ?? new RequestContext(),
    persistTokenUsage: vi.fn(async () => {}),
    generateId: () => `msg-${++idCounter}`,
    resolveTransitionModeId: () => undefined,
    saveSystemReminder: vi.fn(async () => null),
    saveSessionError: vi.fn(async () => null),
  };

  const engine = new SessionRunEngine(session, machinery);
  return { engine, events, session };
}

function chunk(value: StreamChunk): StreamChunk {
  return value;
}

describe('SessionRunEngine — abort deadline', () => {
  it('keeps a replacement subscription attached when an old abort finishes after a terminal hook', async () => {
    const { engine, session, events } = createHarness();
    const blocked = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    session.onBeforeAgentEnd(async () => {
      entered.resolve();
      await blocked.promise;
    });
    const subscription = {
      stream: (async function* () {
        yield chunk({ type: 'abort', payload: {} });
      })(),
      activeRunId: () => 'run-1',
      abort: () => true,
      unsubscribe: vi.fn(),
    };
    session.stream.attach({ subscription, key: 'thread-1' });
    const processed = engine.processSubscribedThreadStream(subscription);
    await entered.promise;
    session.thread.set({ threadId: 'thread-2' });
    const replacement = { ...subscription, activeRunId: () => 'run-2', unsubscribe: vi.fn() };
    session.stream.attach({ subscription: replacement, key: 'thread-2' });
    session.run.nextOperation();
    session.run.setRunId({ runId: 'run-2' });
    blocked.resolve();
    await processed;
    expect(session.stream.isCurrent({ subscription: replacement })).toBe(true);
    expect(session.run.getRunId()).toBe('run-2');
    expect(events.some(event => event.type === 'agent_end')).toBe(false);
  });

  it('records a rejected old approval on its originating thread without ending the replacement run', async () => {
    const { engine, session, events } = createHarness();
    vi.spyOn(session, 'resolveToolApproval').mockReturnValue('allow');
    const failure = Promise.withResolvers<void>();
    const approve = vi.spyOn(session, 'approveToolCall').mockImplementationOnce(() => failure.promise);
    const record = vi.spyOn(session, 'recordSessionError');
    const subscription = {
      stream: (async function* () {
        yield chunk({ type: 'tool-call-approval', payload: { toolCallId: 'call-1', toolName: 'confirm', args: {} } });
      })(),
      activeRunId: () => 'run-1',
      abort: () => true,
      unsubscribe: vi.fn(),
    };
    session.stream.attach({ subscription, key: 'thread-1' });
    const processed = engine.processSubscribedThreadStream(subscription);
    await vi.waitFor(() => expect(approve).toHaveBeenCalled());
    session.thread.set({ threadId: 'thread-2' });
    const replacement = { ...subscription, activeRunId: () => 'run-2', unsubscribe: vi.fn() };
    session.stream.attach({ subscription: replacement, key: 'thread-2' });
    session.run.nextOperation();
    session.run.setRunId({ runId: 'run-2' });
    failure.reject(new Error('Approval dispatch failed'));
    await processed;
    expect(record).toHaveBeenCalledWith(
      { type: 'error', error: expect.objectContaining({ message: 'Approval dispatch failed' }) },
      { threadId: 'thread-1', resourceId: 'resource-1', runId: 'run-1' },
    );
    expect(events.some(event => event.type === 'error' || event.type === 'agent_end')).toBe(false);
    expect(session.stream.isCurrent({ subscription: replacement })).toBe(true);
    expect(session.run.getRunId()).toBe('run-2');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Given a stream hung mid-run, When the run is aborted, Then it still finalizes as aborted after the grace period', async () => {
    vi.useFakeTimers();
    const { engine, events, session } = createHarness();
    session.run.ensureAbortController();

    const processed = engine.processStream({
      fullStream: (async function* () {
        yield chunk({ type: 'text-start', payload: { id: 't1' } });
        yield chunk({ type: 'text-delta', payload: { id: 't1', text: 'partial' } });
        await new Promise(() => {});
      })(),
    });
    await vi.advanceTimersByTimeAsync(0);

    session.abortRun();
    await vi.advanceTimersByTimeAsync(5_000);

    const result = await processed;
    expect(events).toContainEqual({ type: 'agent_end', reason: 'aborted' });
    expect(session.run.isRunning()).toBe(false);
    expect(result?.message.content.parts).toEqual([{ type: 'text', text: 'partial' }]);
  });

  it('Given a stream error, When the stream is finalized, Then its occurrence identity is minted once at the run boundary', async () => {
    const { engine, events } = createHarness();

    await engine.processStream({
      fullStream: (async function* () {
        yield chunk({ type: 'error', payload: { error: new Error('stream failed') } });
      })(),
    });

    const errors = events.filter(
      (event): event is Extract<AgentControllerEvent, { type: 'error' }> => event.type === 'error',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      error: expect.objectContaining({ message: 'stream failed' }),
      occurrenceId: 'msg-2',
    });
    expect(events).toContainEqual({ type: 'agent_end', reason: 'error' });
  });

  it('Given a run that ends on a terminal chunk, Then the source stream is still cleaned up', async () => {
    const { engine } = createHarness();
    let cleanedUp = false;

    await engine.processStream({
      fullStream: (async function* () {
        try {
          yield chunk({ type: 'text-start', payload: { id: 't1' } });
          yield chunk({ type: 'finish', payload: { stepResult: { reason: 'stop' } } });
          yield chunk({ type: 'text-start', payload: { id: 't2' } });
        } finally {
          cleanedUp = true;
        }
      })(),
    });

    await new Promise(resolve => setImmediate(resolve));
    expect(cleanedUp).toBe(true);
  });

  it('Given a subscribed thread stream hung mid-run, When the run is aborted, Then it finalizes as aborted and detaches the subscription', async () => {
    vi.useFakeTimers();
    const { engine, events, session } = createHarness();

    const subscription = {
      stream: (async function* () {
        yield chunk({ type: 'text-start', payload: { id: 't1' } });
        yield chunk({ type: 'text-delta', payload: { id: 't1', text: 'partial' } });
        await new Promise(() => {});
      })(),
      activeRunId: () => 'run-1',
      abort: () => true,
      unsubscribe: vi.fn(),
    };
    session.stream.attach({ subscription, key: 'thread-1' });

    const processed = engine.processSubscribedThreadStream(subscription);
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContainEqual({ type: 'agent_start' });

    session.abortRun();
    await vi.advanceTimersByTimeAsync(5_000);

    await processed;
    expect(events).toContainEqual({ type: 'agent_end', reason: 'aborted' });
    expect(session.run.isRunning()).toBe(false);
    expect(session.stream.isOpen()).toBe(false);
  });

  it('Given an aborted subscribed run that finishes within the grace period, Then the stale deadline does not kill a follow-up run', async () => {
    vi.useFakeTimers();
    const { engine, events, session } = createHarness();

    const queue: StreamChunk[] = [];
    let notify: (() => void) | undefined;
    const push = (value: StreamChunk) => {
      queue.push(value);
      notify?.();
      notify = undefined;
    };
    const subscription = {
      stream: (async function* () {
        while (true) {
          while (queue.length > 0) yield queue.shift()!;
          await new Promise<void>(resolve => {
            notify = resolve;
          });
        }
      })(),
      activeRunId: () => 'run-1',
      abort: () => true,
      unsubscribe: vi.fn(),
    };
    session.stream.attach({ subscription, key: 'thread-1' });
    void engine.processSubscribedThreadStream(subscription);

    push(chunk({ type: 'text-start', payload: { id: 't1' } }));
    push(chunk({ type: 'text-delta', payload: { id: 't1', text: 'first run' } }));
    await vi.advanceTimersByTimeAsync(0);

    session.abortRun();
    await vi.advanceTimersByTimeAsync(1_000);
    push(chunk({ type: 'finish', payload: { stepResult: { reason: 'stop' } } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContainEqual({ type: 'agent_end', reason: 'aborted' });

    push(chunk({ type: 'text-start', payload: { id: 't2' } }));
    push(chunk({ type: 'text-delta', payload: { id: 't2', text: 'follow-up' } }));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(session.run.isRunning()).toBe(true);
    expect(session.stream.isOpen()).toBe(true);
    expect(events.filter(event => event.type === 'agent_start')).toHaveLength(2);
    expect(events.filter(event => event.type === 'agent_end')).toEqual([{ type: 'agent_end', reason: 'aborted' }]);
  });

  it('Given an abort of a later run on the same subscription, When that run hangs, Then the re-armed deadline still bails it', async () => {
    vi.useFakeTimers();
    const { engine, events, session } = createHarness();

    const queue: StreamChunk[] = [];
    let notify: (() => void) | undefined;
    const push = (value: StreamChunk) => {
      queue.push(value);
      notify?.();
      notify = undefined;
    };
    const subscription = {
      stream: (async function* () {
        while (true) {
          while (queue.length > 0) yield queue.shift()!;
          await new Promise<void>(resolve => {
            notify = resolve;
          });
        }
      })(),
      activeRunId: () => 'run-1',
      abort: () => true,
      unsubscribe: vi.fn(),
    };
    session.stream.attach({ subscription, key: 'thread-1' });
    const processed = engine.processSubscribedThreadStream(subscription);

    push(chunk({ type: 'text-start', payload: { id: 't1' } }));
    push(chunk({ type: 'finish', payload: { stepResult: { reason: 'stop' } } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContainEqual({ type: 'agent_end', reason: 'complete' });

    push(chunk({ type: 'text-start', payload: { id: 't2' } }));
    await vi.advanceTimersByTimeAsync(0);

    session.abortRun();
    await vi.advanceTimersByTimeAsync(5_000);

    await processed;
    expect(events).toContainEqual({ type: 'agent_end', reason: 'aborted' });
    expect(session.run.isRunning()).toBe(false);
    expect(session.stream.isOpen()).toBe(false);
  });

  it('Given teardown happens before the deadline observes it, Then a later abort still receives the full grace period', async () => {
    vi.useFakeTimers();
    const { engine, events, session } = createHarness();

    const queue: StreamChunk[] = [];
    let notify: (() => void) | undefined;
    const push = (value: StreamChunk) => {
      queue.push(value);
      notify?.();
      notify = undefined;
    };
    const subscription = {
      stream: (async function* () {
        while (true) {
          while (queue.length > 0) yield queue.shift()!;
          await new Promise<void>(resolve => {
            notify = resolve;
          });
        }
      })(),
      activeRunId: () => 'run-1',
      abort: () => true,
      unsubscribe: vi.fn(),
    };
    session.stream.attach({ subscription, key: 'thread-1' });
    const processed = engine.processSubscribedThreadStream(subscription);

    // First run: abort, then finish immediately so teardown resolves the
    // deadline race before its grace timer ever fires.
    push(chunk({ type: 'text-start', payload: { id: 't1' } }));
    await vi.advanceTimersByTimeAsync(0);
    session.abortRun();
    push(chunk({ type: 'finish', payload: { stepResult: { reason: 'stop' } } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContainEqual({ type: 'agent_end', reason: 'aborted' });

    // Second run on the same subscription hangs after its abort.
    push(chunk({ type: 'text-start', payload: { id: 't2' } }));
    await vi.advanceTimersByTimeAsync(0);
    session.abortRun();

    // The later abort gets a full, fresh grace period — no early bail from a
    // stale timer armed by the first abort...
    await vi.advanceTimersByTimeAsync(4_999);
    expect(session.stream.isOpen()).toBe(true);

    // ...and the re-armed deadline still bails the hung run once it elapses.
    await vi.advanceTimersByTimeAsync(1);
    await processed;
    expect(events.filter(event => event.type === 'agent_end')).toEqual([
      { type: 'agent_end', reason: 'aborted' },
      { type: 'agent_end', reason: 'aborted' },
    ]);
    expect(session.run.isRunning()).toBe(false);
    expect(session.stream.isOpen()).toBe(false);
  });

  it('Given a subscribed run whose producer loses liveness, Then it finalizes as an error and the subscription can process a follow-up run', async () => {
    const { engine, events, session } = createHarness();

    const subscription = {
      stream: (async function* () {
        yield chunk({ type: 'text-start', payload: { id: 't1' }, runId: 'run-1' });
        yield chunk({ type: 'text-delta', payload: { id: 't1', text: 'partial' }, runId: 'run-1' });
        yield chunk({
          type: 'error',
          payload: { error: new Error('Thread run run-1 lost its lease before publishing a terminal event') },
          runId: 'run-1',
        });
        yield chunk({ type: 'text-start', payload: { id: 't2' }, runId: 'run-2' });
        yield chunk({ type: 'text-delta', payload: { id: 't2', text: 'recovered' }, runId: 'run-2' });
        yield chunk({ type: 'finish', payload: { stepResult: { reason: 'stop' } }, runId: 'run-2' });
      })(),
      activeRunId: () => null,
      abort: () => true,
      unsubscribe: vi.fn(),
    };
    session.stream.attach({ subscription, key: 'thread-1' });

    await engine.processSubscribedThreadStream(subscription);

    expect(events.filter(event => event.type === 'error')).toEqual([
      expect.objectContaining({
        type: 'error',
        error: new Error('Thread run run-1 lost its lease before publishing a terminal event'),
        occurrenceId: expect.any(String),
      }),
    ]);
    expect(events.filter(event => event.type === 'agent_end')).toEqual([
      { type: 'agent_end', reason: 'error' },
      { type: 'agent_end', reason: 'complete' },
    ]);
    expect(events.filter(event => event.type === 'agent_start')).toHaveLength(2);
    expect(session.run.isRunning()).toBe(false);
  });

  it('Given a stream that reacts to the abort signal in time, Then the deadline never fires', async () => {
    const { engine, events, session } = createHarness();
    const abortController = session.run.ensureAbortController();

    const result = await engine.processStream({
      fullStream: (async function* () {
        yield chunk({ type: 'text-start', payload: { id: 't1' } });
        abortController.abort();
        session.run.requestAbort();
        yield chunk({ type: 'abort', payload: {} });
      })(),
    });

    expect(events).toContainEqual({ type: 'agent_end', reason: 'aborted' });
    expect(result?.message).toBeDefined();
  });
});
