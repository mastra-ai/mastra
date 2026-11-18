import { describe, expect, it } from 'vitest';
import { Session } from './session';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

function newSession() {
  return new Session({ resourceId: 'r1', id: 's1', ownerId: 'o1', workspace: createMockWorkspace() });
}

function omStatus(threadId: string, pendingTokens: number): Extract<AgentControllerEvent, { type: 'om_status' }> {
  return {
    type: 'om_status',
    threadId,
    recordId: `record-${threadId}`,
    stepNumber: 1,
    generationCount: 0,
    windows: {
      active: {
        messages: { tokens: pendingTokens, threshold: 30_000 },
        observations: { tokens: 1_000, threshold: 40_000 },
      },
      buffered: {
        observations: {
          status: 'running',
          chunks: 1,
          messageTokens: 500,
          projectedMessageRemoval: 400,
          observationTokens: 100,
        },
        reflection: { status: 'idle', inputObservationTokens: 0, observationTokens: 0 },
      },
    },
  };
}

const assistantMessage = {
  id: 'assistant-1',
  role: 'assistant',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  content: { format: 2, parts: [{ type: 'text', text: '' }] },
} as Extract<AgentControllerEvent, { type: 'message_start' }>['message'];

describe('Session.initialStateEvents', () => {
  it('opens a join mid-message on the text streamed so far', () => {
    const session = newSession();
    session.emit({ type: 'agent_start' });
    session.emit({ type: 'message_start', message: assistantMessage });
    session.emit({ type: 'message_update', id: 'assistant-1', event: { type: 'text-delta', delta: 'Hello, ' } });
    session.emit({ type: 'message_update', id: 'assistant-1', event: { type: 'text-delta', delta: 'world' } });

    const [start] = session.initialStateEvents();

    expect(start).toMatchObject({
      type: 'message_start',
      message: { id: 'assistant-1', content: { parts: [{ type: 'text', text: 'Hello, world' }] } },
    });
  });

  it('hands out a copy the next delta does not change', () => {
    const session = newSession();
    session.emit({ type: 'agent_start' });
    session.emit({ type: 'message_start', message: assistantMessage });
    session.emit({ type: 'message_update', id: 'assistant-1', event: { type: 'text-delta', delta: 'one' } });
    const [start] = session.initialStateEvents();

    session.emit({ type: 'message_update', id: 'assistant-1', event: { type: 'text-delta', delta: ' two' } });

    expect(start).toMatchObject({ message: { content: { parts: [{ text: 'one' }] } } });
  });

  it('has no message once the run ended', () => {
    const session = newSession();
    session.emit({ type: 'agent_start' });
    session.emit({ type: 'message_start', message: assistantMessage });
    session.emit({ type: 'message_end', message: assistantMessage });
    session.emit({ type: 'agent_end', reason: 'complete' });

    expect(session.initialStateEvents()).toEqual([]);
  });

  it('carries the latest om_status of the thread', () => {
    const session = newSession();
    session.emit(omStatus('thread-a', 100));
    session.emit(omStatus('thread-a', 250));

    expect(session.initialStateEvents()).toEqual([omStatus('thread-a', 250)]);
  });

  it('drops the om_status when the session moves to another thread', () => {
    const session = newSession();
    session.emit(omStatus('thread-a', 100));
    session.emit({ type: 'thread_changed', threadId: 'thread-b', previousThreadId: 'thread-a' });

    expect(session.initialStateEvents()).toEqual([]);
  });

  it('keeps the om_status when another thread is deleted', () => {
    const session = newSession();
    session.emit(omStatus('thread-a', 100));
    session.emit({ type: 'thread_deleted', threadId: 'thread-b' });

    expect(session.initialStateEvents()).toEqual([omStatus('thread-a', 100)]);
  });

  it('drops the om_status when its thread is deleted', () => {
    const session = newSession();
    session.emit(omStatus('thread-a', 100));
    session.emit({ type: 'thread_deleted', threadId: 'thread-a' });

    expect(session.initialStateEvents()).toEqual([]);
  });

  it('reports the token total as a usage_update with no step usage', () => {
    const session = newSession();
    session.setTokenUsage({ promptTokens: 30, completionTokens: 12, totalTokens: 42 });

    expect(session.initialStateEvents()).toEqual([
      {
        type: 'usage_update',
        usage: expect.objectContaining({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
        total: { promptTokens: 30, completionTokens: 12, totalTokens: 42 },
      },
    ]);
  });

  it('sends nothing to existing subscribers', () => {
    const session = newSession();
    session.emit({ type: 'agent_start' });
    session.emit({ type: 'message_start', message: assistantMessage });
    session.emit(omStatus('thread-a', 100));
    const received: AgentControllerEvent[] = [];
    session.subscribe(event => received.push(event));

    session.initialStateEvents();

    expect(received).toEqual([]);
  });
});
