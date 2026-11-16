import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { EventEmitterPubSub } from '@mastra/core/events';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { feedTopic } from '../feed-events.js';
import type { LiveSession } from './live-sessions.js';
import { LiveSessions, liveSessionsTouchingTheFeed } from './live-sessions.js';

function fakeController() {
  const created: ((session: LiveSession) => void)[] = [];
  const deleted: ((session: LiveSession) => void)[] = [];
  return {
    onSessionCreated: (listener: (session: LiveSession) => void) => {
      created.push(listener);
      return () => {};
    },
    onSessionDeleted: (listener: (session: LiveSession) => void) => {
      deleted.push(listener);
      return () => {};
    },
    create: (session: LiveSession) => created.forEach(listener => listener(session)),
    delete: (session: LiveSession) => deleted.forEach(listener => listener(session)),
  };
}

function fakeSession(
  id: string,
  running: { value: boolean } = { value: false },
  factoryProjectId: string | null = 'project-1',
) {
  const listeners = new Set<(event: AgentControllerEvent) => void>();
  const pendingSuspensions = new Map<string, { toolName: string }>();
  const session: LiveSession = {
    identity: { getId: () => id },
    run: { isRunning: () => running.value },
    state: { get: () => ({ factoryOrgId: 'org-1', ...(factoryProjectId ? { factoryProjectId } : {}) }) },
    displayState: { get: () => ({ pendingSuspensions }) },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const emit = (event: AgentControllerEvent) => listeners.forEach(listener => listener(event));
  return {
    session,
    park: (toolCallId: string, toolName: string) => {
      pendingSuspensions.set(toolCallId, { toolName });
      emit({ type: 'tool_suspended', toolCallId, toolName, args: {}, suspendPayload: {} });
    },
    answer: (toolCallId: string) => {
      pendingSuspensions.delete(toolCallId);
      emit({ type: 'tool_suspension_cancelled', toolCallId, toolName: 'ask_user', reason: 'answered' });
    },
    start: () => emit({ type: 'agent_start' }),
    end: (reason: 'complete' | 'suspended') => {
      if (reason !== 'suspended') pendingSuspensions.clear();
      emit({ type: 'agent_end', reason });
    },
  };
}

describe('LiveSessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('reads the session state on every call, so a run that starts later is reported', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const running = { value: false };
    controller.create(fakeSession('session-1', running).session);

    expect(registry.isRunning('session-1')).toBe(false);
    running.value = true;
    expect(registry.isRunning('session-1')).toBe(true);
  });

  it('reports sessions it never saw, and torn-down ones, as not running', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const { session } = fakeSession('session-1', { value: true });
    controller.create(session);

    expect(registry.isRunning('unknown')).toBe(false);
    controller.delete(session);
    expect(registry.isRunning('session-1')).toBe(false);
  });

  it('reports the tool a session has waited on longest, dated when it parked', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const fake = fakeSession('session-1');
    controller.create(fake.session);

    expect(registry.parked('session-1')).toBeUndefined();
    fake.park('call-1', 'ask_user');
    vi.advanceTimersByTime(1_000);
    fake.park('call-2', 'submit_plan');
    fake.end('suspended');
    expect(registry.parked('session-1')).toEqual({
      toolName: 'ask_user',
      suspendedAt: new Date('2030-01-01T00:00:00Z').getTime(),
    });

    fake.answer('call-1');
    expect(registry.parked('session-1')).toEqual({
      toolName: 'submit_plan',
      suspendedAt: new Date('2030-01-01T00:00:01Z').getTime(),
    });
    fake.end('complete');
    expect(registry.parked('session-1')).toBeUndefined();
  });

  it('dates two parks in the same millisecond apart, so a receipt cannot carry over to the next wait', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const fake = fakeSession('session-1');
    controller.create(fake.session);

    fake.park('call-1', 'ask_user');
    fake.park('call-2', 'submit_plan');
    const first = registry.parked('session-1');
    fake.answer('call-1');
    const second = registry.parked('session-1');

    expect(first?.suspendedAt).toBe(new Date('2030-01-01T00:00:00Z').getTime());
    expect(second?.suspendedAt).toBe(first!.suspendedAt + 1);
  });

  it('lists the parked sessions of one project only', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const parked = fakeSession('session-1');
    const idle = fakeSession('session-2');
    const elsewhere = fakeSession('session-3', { value: false }, 'project-2');
    for (const fake of [parked, idle, elsewhere]) controller.create(fake.session);
    parked.park('call-1', 'ask_user');
    elsewhere.park('call-2', 'submit_plan');

    expect(registry.parkedIn('project-1')).toEqual([
      {
        sessionId: 'session-1',
        run: { toolName: 'ask_user', suspendedAt: new Date('2030-01-01T00:00:00Z').getTime() },
      },
    ]);
  });

  it('announces every run start, park, answer and finished turn, and stops once the session is gone', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const fake = fakeSession('session-1');
    controller.create(fake.session);
    const changed = vi.fn();
    registry.onRunChanged(changed);

    fake.start();
    fake.park('call-1', 'ask_user');
    fake.end('suspended');
    fake.answer('call-1');
    fake.start();
    fake.end('complete');
    expect(changed).toHaveBeenCalledTimes(5);
    expect(changed).toHaveBeenLastCalledWith(fake.session);

    controller.delete(fake.session);
    expect(changed).toHaveBeenCalledTimes(6);
    fake.park('call-2', 'ask_user');
    expect(changed).toHaveBeenCalledTimes(6);
  });

  it('announces a parked session going away, so the inbox drops its item', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const fake = fakeSession('session-1');
    controller.create(fake.session);
    const changed = vi.fn();
    registry.onRunChanged(changed);

    fake.park('call-1', 'ask_user');
    controller.delete(fake.session);

    expect(registry.parkedIn('project-1')).toEqual([]);
  });
});

describe('LiveSessions on a real controller', () => {
  /** A Factory session whose run never finishes on its own, with the feed frames its project has received. */
  async function sessionMidRun() {
    let inFlight = false;
    const model = new MastraLanguageModelV2Mock({
      doStream: async () => ({
        stream: new ReadableStream({
          start(stream) {
            stream.enqueue({ type: 'stream-start', warnings: [] });
            inFlight = true;
            // Never finishes: only the deletion ends this run.
          },
        }),
      }),
    });
    const controller = new AgentController({
      id: 'code',
      storage: new InMemoryStore(),
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          agent: new Agent({ id: 'agent', name: 'agent', instructions: 'test', model }),
        },
      ],
    });
    await controller.init();
    const eventBus = new EventEmitterPubSub();
    const registry = liveSessionsTouchingTheFeed(controller, eventBus, { getBySessionId: async () => null });
    // What a browser reads back for each frame. Its request is served on a later turn of the server's loop.
    const frames: number[] = [];
    await eventBus.subscribe(feedTopic('org-1', 'project-1'), () => {
      setImmediate(() => frames.push(controller.listActiveThreadRuns().length));
    });
    const session = await controller.createSession({
      id: 'session-1',
      resourceId: 'resource-1',
      tags: { factoryOrgId: 'org-1', factoryProjectId: 'project-1' },
    });
    const idleThread = await session.thread.create();
    const runThread = await session.thread.create();
    await new Promise(setImmediate);
    frames.length = 0;
    void session.sendMessage({ content: 'go' }).catch(() => {});
    await vi.waitFor(() => expect(inFlight && registry.isRunning('session-1')).toBe(true));
    // The run's own start frame has landed; only what the test does next can add another.
    await vi.waitFor(() => expect(frames).toEqual([1]));
    return { controller, registry, session, frames, idleThread, runThread };
  }

  // The controller resets a session's run before it tells anyone the session is gone,
  // so by then the registry can no longer ask the session whether it was running.
  it('announces a session deleted while its run is in flight, so other boards drop its running marker', async () => {
    const { controller, registry, frames } = await sessionMidRun();

    await controller.deleteSession({ sessionId: 'session-1' });

    expect(registry.isRunning('session-1')).toBe(false);
    await vi.waitFor(() => expect(frames).toHaveLength(2));
  });

  // Leaving a thread ends the run this session started on it, and no `agent_end` reaches a session that has left.
  it.each(['moves to another thread', 'starts a new thread', 'deletes its thread'] as const)(
    'announces a session that %s mid-run, so boards drop its running marker',
    async leaves => {
      const { registry, session, frames, idleThread, runThread } = await sessionMidRun();

      if (leaves === 'moves to another thread') await session.thread.switch({ threadId: idleThread.id });
      else if (leaves === 'starts a new thread') await session.thread.create();
      else await session.thread.delete({ threadId: runThread.id });

      expect(registry.isRunning('session-1')).toBe(false);
      await vi.waitFor(() => expect(frames).toEqual([1, 0]));
    },
  );
});

describe('liveSessionsTouchingTheFeed', () => {
  it('touches the feed of a session whose state names no Factory, read from its row', async () => {
    const controller = fakeController();
    const eventBus = new EventEmitterPubSub();
    const rows = {
      getBySessionId: async (sessionId: string) =>
        sessionId === 'session-1' ? { orgId: 'org-1', factoryProjectId: 'project-1' } : null,
    };
    liveSessionsTouchingTheFeed(controller, eventBus, rows);
    const frames: unknown[] = [];
    await eventBus.subscribe(feedTopic('org-1', 'project-1'), event => frames.push(event));
    const recovered = fakeSession('session-1', { value: false }, null);
    controller.create(recovered.session);

    recovered.start();

    await vi.waitFor(() => expect(frames).toHaveLength(1));
  });
});
