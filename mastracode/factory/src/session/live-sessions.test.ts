import { describe, expect, it } from 'vitest';

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

function fakeSession(id: string, running: { value: boolean }): LiveSession {
  return { identity: { getId: () => id }, run: { isRunning: () => running.value } };
}

describe('LiveSessions', () => {
  it('reads the session state on every call, so a run that starts later is reported', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const running = { value: false };
    controller.create(fakeSession('session-1', running));

    expect(registry.isRunning('session-1')).toBe(false);
    running.value = true;
    expect(registry.isRunning('session-1')).toBe(true);
  });

  it('reports sessions it never saw, and torn-down ones, as not running', () => {
    const controller = fakeController();
    const registry = new LiveSessions(controller);
    const session = fakeSession('session-1', { value: true });
    controller.create(session);

    expect(registry.isRunning('unknown')).toBe(false);
    controller.delete(session);
    expect(registry.isRunning('session-1')).toBe(false);
  });
});
