import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list/state/types';
import { RequestContext } from '../../request-context';
import { Workspace } from '../../workspace';
import { LocalFilesystem } from '../../workspace/filesystem/local-filesystem';
import type { SessionMachinery } from '../session';
import { Session } from '../session';
import { SessionRunEngine } from '../session-run-engine';
import type { AgentControllerEvent } from '../types';

/**
 * BDD spec for the DB-native message contract of the run engine.
 *
 * Given a streamed run, the engine must build and emit `MastraDBMessage`s:
 * `content.format === 2` with nested `content.parts` accumulating
 * `text` / `reasoning` / `tool-invocation` parts in stream order — NOT the
 * legacy flat `AgentControllerMessageContent` union.
 */

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
    getAgent: () => {
      throw new Error('getAgent is not used by these stream-folding tests');
    },
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

  const engine = new SessionRunEngine(session, machinery);
  return { engine, events, session };
}

function isMastraDBMessage(value: unknown): value is MastraDBMessage {
  return typeof value === 'object' && value !== null && 'content' in value && 'role' in value;
}

function lastMessageEvent(events: AgentControllerEvent[]): MastraDBMessage {
  for (const event of [...events].reverse()) {
    if ('message' in event && isMastraDBMessage(event.message)) {
      return event.message;
    }
  }
  throw new Error('no message event emitted');
}

function requestContext(): RequestContext {
  return new RequestContext();
}

function chunk(value: StreamChunk): StreamChunk {
  return value;
}

describe('SessionRunEngine — MastraDBMessage contract', () => {
  it('Given a text stream, When chunks arrive, Then it emits a MastraDBMessage with a text part', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'Hello' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: ' world' } }), ctx);

    const message = lastMessageEvent(events);
    expect(message.content.format).toBe(2);
    expect(message.content.parts).toEqual([{ type: 'text', text: 'Hello world' }]);
    expect(message.role).toBe('assistant');
  });

  it('Given a reasoning stream, When chunks arrive, Then it emits a reasoning part', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'reasoning-start', payload: { id: 'r1' } }), ctx);
    await engine.processStreamChunk(
      state,
      chunk({ type: 'reasoning-delta', payload: { id: 'r1', text: 'thinking…' } }),
      ctx,
    );

    const message = lastMessageEvent(events);
    const reasoningPart = message.content.parts.find(part => part.type === 'reasoning');
    expect(reasoningPart).toMatchObject({ type: 'reasoning', reasoning: 'thinking…' });
  });

  it('Given a tool call + result, When chunks arrive, Then it emits a tool-invocation part', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(
      state,
      chunk({ type: 'tool-call', payload: { toolCallId: 'tc1', toolName: 'read', args: { path: 'a.ts' } } }),
      ctx,
    );
    await engine.processStreamChunk(
      state,
      chunk({
        type: 'tool-result',
        payload: { toolCallId: 'tc1', toolName: 'read', result: 'ok', isError: true },
      }),
      ctx,
    );

    const message = lastMessageEvent(events);
    const toolPart = message.content.parts.find(part => part.type === 'tool-invocation');
    if (!toolPart || toolPart.type !== 'tool-invocation') throw new Error('no tool invocation part emitted');
    expect(toolPart.toolInvocation.toolCallId).toBe('tc1');
    expect(toolPart.toolInvocation.toolName).toBe('read');
    expect(toolPart.toolInvocation.state).toBe('result');
    expect(toolPart.toolInvocation.result).toBe('ok');
    expect((toolPart.toolInvocation as { isError?: boolean }).isError).toBe(true);
  });

  it('Given a signal data chunk, When it arrives, Then it emits a DB-native signal message', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();
    const payload = { signalId: 'sig-1', message: 'hello' };

    await engine.processStreamChunk(state, chunk({ type: 'data-signal', data: payload }), ctx);

    const message = lastMessageEvent(events);
    const [part] = message.content.parts;
    expect(message.role).toBe('signal');
    expect(message.content.format).toBe(2);
    expect(part).toEqual({ type: 'data-signal', data: payload });
    expect(message.content.metadata?.signal).toEqual(payload);
  });

  it('Given a user-message signal after assistant text, When it arrives, Then it ends the assistant and emits a separate signal message', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();
    const payload = { id: 'user-signal-1', message: 'next input', createdAt: '2026-01-02T03:04:05.000Z' };

    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    await engine.processStreamChunk(
      state,
      chunk({ type: 'text-delta', payload: { id: 't1', text: 'assistant text' } }),
      ctx,
    );
    await engine.processStreamChunk(state, chunk({ type: 'data-user-message', data: payload }), ctx);

    const messageEnds = events.filter(event => event.type === 'message_end');
    expect(messageEnds).toHaveLength(2);
    expect(messageEnds[0].message.role).toBe('assistant');
    expect(messageEnds[0].message.content).toMatchObject({
      format: 2,
      parts: [{ type: 'text', text: 'assistant text' }],
      metadata: { stopReason: 'complete' },
    });
    expect(messageEnds[1].message).toMatchObject({
      id: 'user-signal-1',
      role: 'signal',
      content: {
        format: 2,
        parts: [{ type: 'data-user-message', data: payload }],
        metadata: { signal: payload },
      },
    });
    expect(messageEnds[1].message.createdAt.toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });

  it('Given an emitted snapshot, When later chunks mutate the message in place, Then the snapshot is unchanged', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'Hello' } }), ctx);
    const textSnapshot = lastMessageEvent(events);

    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: ' world' } }), ctx);
    expect(textSnapshot.content.parts).toEqual([{ type: 'text', text: 'Hello' }]);

    await engine.processStreamChunk(
      state,
      chunk({ type: 'tool-call', payload: { toolCallId: 'tc1', toolName: 'read', args: { path: 'a.ts' } } }),
      ctx,
    );
    const callSnapshot = lastMessageEvent(events);

    await engine.processStreamChunk(
      state,
      chunk({ type: 'tool-result', payload: { toolCallId: 'tc1', toolName: 'read', result: 'ok' } }),
      ctx,
    );

    const callPart = callSnapshot.content.parts.find(part => part.type === 'tool-invocation');
    if (!callPart || callPart.type !== 'tool-invocation') throw new Error('no tool invocation part in snapshot');
    expect(callPart.toolInvocation.state).toBe('call');
    expect(callPart.toolInvocation).not.toHaveProperty('result');
  });

  it('Given a non-success finish reason, When the stream finishes, Then terminal state lives on message metadata', async () => {
    const { engine, events } = createHarness();

    const result = await engine.processStream(
      {
        fullStream: (async function* () {
          yield chunk({ type: 'text-start', payload: { id: 't1' } });
          yield chunk({ type: 'text-delta', payload: { id: 't1', text: 'partial' } });
          yield chunk({ type: 'finish', payload: { stepResult: { reason: 'content-filter' } } });
        })(),
      },
      requestContext(),
    );

    expect(result?.message.content.format).toBe(2);
    expect(result?.message.content.parts).toEqual([{ type: 'text', text: 'partial' }]);
    expect(result?.message.content.metadata?.stopReason).toBe('error');
    expect(result?.message.content.metadata?.errorMessage).toEqual(expect.stringContaining('content filter'));
    const messageEnd = events.find(event => event.type === 'message_end');
    expect(messageEnd?.message.content.metadata?.stopReason).toBe('error');
    expect(events).toContainEqual({ type: 'agent_end', reason: 'error' });
  });
});
