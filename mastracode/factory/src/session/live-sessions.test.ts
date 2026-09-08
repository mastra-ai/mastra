import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveSession } from './live-sessions.js';
import { LiveSessions } from './live-sessions.js';

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

function fakeSession(id: string, running: { value: boolean } = { value: false }, factoryProjectId = 'project-1') {
  const listeners = new Set<(event: AgentControllerEvent) => void>();
  const pendingSuspensions = new Map<string, { toolName: string }>();
  const session: LiveSession = {
    identity: { getId: () => id },
    run: { isRunning: () => running.value },
    state: { get: () => ({ factoryOrgId: 'org-1', factoryProjectId }) },
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

  it('announces every park, answer and finished turn, and stops once the session is gone', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const fake = fakeSession('session-1');
    controller.create(fake.session);
    const changed = vi.fn();
    registry.onParkedChanged(changed);

    fake.park('call-1', 'ask_user');
    fake.end('suspended');
    fake.answer('call-1');
    fake.end('complete');
    expect(changed).toHaveBeenCalledTimes(3);
    expect(changed).toHaveBeenLastCalledWith(fake.session);

    controller.delete(fake.session);
    fake.park('call-2', 'ask_user');
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it('announces a parked session going away, so the inbox drops its item', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const fake = fakeSession('session-1');
    controller.create(fake.session);
    const changed = vi.fn();
    registry.onParkedChanged(changed);

    fake.park('call-1', 'ask_user');
    controller.delete(fake.session);

    expect(changed).toHaveBeenCalledTimes(2);
    expect(registry.parkedIn('project-1')).toEqual([]);
  });
});
