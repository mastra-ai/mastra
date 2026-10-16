import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import { observeSessionThreadStamp } from './thread-session-stamp.js';

function createSession() {
  let listener: ((event: AgentControllerEvent) => void) | undefined;
  const session = {
    identity: { getId: () => 'session-1' },
    thread: { setSettingOn: vi.fn(async () => {}) },
    subscribe: vi.fn((next: (event: AgentControllerEvent) => void) => {
      listener = next;
      return () => {};
    }),
  };
  return { session, emit: (event: unknown) => listener?.(event as AgentControllerEvent) };
}

describe('observeSessionThreadStamp', () => {
  it('ties each thread the session creates to the session', () => {
    const { session, emit } = createSession();
    observeSessionThreadStamp(session);

    emit({ type: 'thread_created', thread: { id: 'thread-2' } });

    expect(session.thread.setSettingOn).toHaveBeenCalledWith({
      threadId: 'thread-2',
      key: 'factorySessionId',
      value: 'session-1',
    });
  });

  it('ignores other events', () => {
    const { session, emit } = createSession();
    observeSessionThreadStamp(session);

    emit({ type: 'thread_changed', threadId: 'thread-2' });

    expect(session.thread.setSettingOn).not.toHaveBeenCalled();
  });
});
