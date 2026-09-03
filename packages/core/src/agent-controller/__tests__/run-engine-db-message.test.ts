import { describe, expect, it, vi } from 'vitest';

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
      throw new Error('subscribeToThread is not used by these stream-folding tests');
    },
    buildStreamOptions: async () => ({}),
    buildSharedRunOptions: () => ({}),
    buildToolsets: async () => ({}),
    buildRequestContext: async requestContext => requestContext ?? new RequestContext(),
    persistTokenUsage: vi.fn(async () => {}),
    generateId: () => `msg-${++idCounter}`,
    resolveTransitionModeId: () => undefined,
    saveSystemReminder: vi.fn(async () => null),
  };

  return { engine: new SessionRunEngine(session, machinery), events };
}

function chunk(value: StreamChunk): StreamChunk {
  return value;
}

function assistantStarts(events: AgentControllerEvent[]) {
  return events.filter(
    (event): event is Extract<AgentControllerEvent, { type: 'message_start' }> =>
      event.type === 'message_start' && event.message.role === 'assistant',
  );
}

describe('SessionRunEngine compact message lifecycle', () => {
  it('emits one start, ordered text deltas, and one end when assistant text completes', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'Hello' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: ' world' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-end', payload: { id: 't1' } }), context);

    const [started] = assistantStarts(events);
    expect(started).toMatchObject({
      type: 'message_start',
      message: { id: 'msg-1', content: { format: 2, parts: [{ type: 'text', text: '' }] } },
    });
    expect(events.filter(event => event.type === 'message_update')).toEqual([
      { type: 'message_update', id: 'msg-1', event: { type: 'text-delta', delta: 'Hello' } },
      { type: 'message_update', id: 'msg-1', event: { type: 'text-delta', delta: ' world' } },
    ]);
    expect(events.some(event => event.type === 'message_end')).toBe(false);

    await engine.processStreamChunk(state, chunk({ type: 'data-user-message', data: { id: 'user-1' } }), context);

    expect(events.filter(event => event.type === 'message_end')).toEqual([
      { type: 'message_end', id: 'msg-1' },
      { type: 'message_end', id: 'user-1' },
    ]);
  });

  it('emits one lifecycle for multiple text parts in one assistant message', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'first' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-end', payload: { id: 't1' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't2' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't2', text: ' second' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'data-user-message', data: { id: 'user-1' } }), context);

    expect(assistantStarts(events)).toHaveLength(1);
    expect(events.filter(event => event.type === 'message_update')).toEqual([
      { type: 'message_update', id: 'msg-1', event: { type: 'text-delta', delta: 'first' } },
      { type: 'message_update', id: 'msg-1', event: { type: 'text-delta', delta: ' second' } },
    ]);
    expect(events.filter(event => event.type === 'message_end')).toContainEqual({ type: 'message_end', id: 'msg-1' });
  });

  it('ends the active assistant before rotating to a new response id', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-1' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'first' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-2' } }), context);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't2' } }), context);

    expect(events.filter(event => event.type === 'message_start').map(event => event.message.id)).toEqual([
      'response-1',
      'response-2',
    ]);
    expect(events.filter(event => event.type === 'message_end')).toEqual([{ type: 'message_end', id: 'response-1' }]);
  });

  it('emits immediate compact start/end pairs for signal messages', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();
    const payload = { id: 'signal-1', message: 'hello', createdAt: '2026-01-02T03:04:05.000Z' };

    await engine.processStreamChunk(state, chunk({ type: 'data-signal', data: payload }), context);

    expect(events.filter(event => event.type === 'message_start' || event.type === 'message_end')).toEqual([
      {
        type: 'message_start',
        message: expect.objectContaining({
          id: 'signal-1',
          role: 'signal',
          content: { format: 2, parts: [{ type: 'data-signal', data: payload }], metadata: { signal: payload } },
        }),
      },
      { type: 'message_end', id: 'signal-1' },
    ]);
  });

  it('starts tool-only assistant messages without creating invalid message updates', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const context = new RequestContext();

    await engine.processStreamChunk(
      state,
      chunk({ type: 'tool-call', payload: { toolCallId: 'tool-1', toolName: 'read', args: { path: 'a.ts' } } }),
      context,
    );
    await engine.processStreamChunk(
      state,
      chunk({ type: 'tool-result', payload: { toolCallId: 'tool-1', toolName: 'read', result: 'ok' } }),
      context,
    );
    await engine.processStreamChunk(state, chunk({ type: 'data-user-message', data: { id: 'user-1' } }), context);

    expect(assistantStarts(events)).toHaveLength(1);
    expect(events.filter(event => event.type === 'message_update')).toEqual([]);
    expect(events.filter(event => event.type === 'message_end')).toContainEqual({ type: 'message_end', id: 'msg-1' });
  });
});
