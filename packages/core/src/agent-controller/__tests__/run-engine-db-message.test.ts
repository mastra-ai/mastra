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
    getAgent: () => ({ id: 'agent-stub' }) as unknown as ReturnType<SessionMachinery['getAgent']>,
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

function textOf(message: MastraDBMessage): string {
  return message.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('');
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
    expect(toolPart.toolInvocation.isError).toBe(true);
  });

  it('Given a tool call whose execution throws, When the tool-error chunk arrives, Then the part reaches a terminal errored state and the message is re-emitted', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(
      state,
      chunk({ type: 'tool-call', payload: { toolCallId: 'tc1', toolName: 'read', args: { path: 'a.ts' } } }),
      ctx,
    );
    const updatesBefore = events.filter(event => event.type === 'message_update').length;
    await engine.processStreamChunk(
      state,
      chunk({ type: 'tool-error', payload: { toolCallId: 'tc1', toolName: 'read', error: 'boom' } }),
      ctx,
    );

    const message = lastMessageEvent(events);
    const toolPart = message.content.parts.find(part => part.type === 'tool-invocation');
    if (!toolPart || toolPart.type !== 'tool-invocation') throw new Error('no tool invocation part emitted');
    expect(toolPart.toolInvocation.state).toBe('result');
    expect(toolPart.toolInvocation.result).toBe('boom');
    expect(toolPart.toolInvocation.isError).toBe(true);
    expect(events).toContainEqual({ type: 'tool_end', toolCallId: 'tc1', result: 'boom', isError: true });
    expect(events.filter(event => event.type === 'message_update').length).toBe(updatesBefore + 1);
  });

  it('Given a denied tool call, When the denial chunk arrives, Then the invocation reaches output-denied state', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(
      state,
      chunk({ type: 'tool-call', payload: { toolCallId: 'tc1', toolName: 'write', args: { path: 'a.ts' } } }),
      ctx,
    );
    await engine.processStreamChunk(
      state,
      chunk({
        type: 'tool-output-denied',
        payload: {
          toolCallId: 'tc1',
          toolName: 'write',
          args: { path: 'a.ts' },
          approval: { id: 'approval-1', approved: false, reason: 'Not allowed' },
        },
      }),
      ctx,
    );

    const message = lastMessageEvent(events);
    const toolPart = message.content.parts.find(part => part.type === 'tool-invocation');
    if (!toolPart || toolPart.type !== 'tool-invocation') throw new Error('no tool invocation part emitted');
    expect(toolPart.toolInvocation).toMatchObject({
      state: 'output-denied',
      toolCallId: 'tc1',
      toolName: 'write',
      args: { path: 'a.ts' },
      approval: { id: 'approval-1', approved: false, reason: 'Not allowed' },
    });
    expect(events).toContainEqual({
      type: 'tool_end',
      toolCallId: 'tc1',
      result: 'Not allowed',
      isError: false,
      denied: true,
    });
  });

  it('Given a tool-error carrying an Error instance, When it folds, Then the failure message survives JSON serialization', async () => {
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
      chunk({ type: 'tool-error', payload: { toolCallId: 'tc1', toolName: 'read', error: new Error('boom') } }),
      ctx,
    );

    const message = lastMessageEvent(events);
    const toolPart = message.content.parts.find(part => part.type === 'tool-invocation');
    if (!toolPart || toolPart.type !== 'tool-invocation') throw new Error('no tool invocation part emitted');
    const wire = JSON.parse(JSON.stringify(toolPart));
    expect(wire.toolInvocation.result).toBe('boom');
    expect(wire.toolInvocation.isError).toBe(true);
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

  it('Given streamed message events, When later deltas arrive, Then the same live message reflects the latest state', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    const started = lastMessageEvent(events);

    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'Hello' } }), ctx);
    const firstUpdate = lastMessageEvent(events);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: ' world' } }), ctx);
    const secondUpdate = lastMessageEvent(events);
    await engine.processStreamChunk(
      state,
      chunk({
        type: 'data-user-message',
        data: { id: 'user-signal-1', message: 'next input', createdAt: '2026-01-02T03:04:05.000Z' },
      }),
      ctx,
    );
    const ended = events.find(event => event.type === 'message_end' && event.message.role === 'assistant');
    if (!ended || ended.type !== 'message_end') throw new Error('no assistant message_end event');

    expect(firstUpdate).toBe(started);
    expect(secondUpdate).toBe(started);
    expect(ended.message).toBe(started);
    expect(started.content).toEqual({
      format: 2,
      parts: [{ type: 'text', text: 'Hello world' }],
      metadata: { stopReason: 'complete' },
    });
  });

  /**
   * These three tests preserve the superseded point-in-time snapshot contract as
   * executable documentation. They are intentionally skipped—not deleted—so a
   * future change cannot quietly reintroduce per-delta copying without confronting
   * the allocation and ownership tradeoff.
   *
   * `SessionRunEngine` now emits one live accumulated message for a streamed turn.
   * Later text/reasoning/tool updates therefore mutate objects observed by earlier
   * events, and consecutive events intentionally share the same parts and tool
   * invocation identities. Each assertion below must fail under that contract.
   *
   * This is a large tradeoff, not a micro-optimization. The former deep clone copied
   * all accumulated content, including completed multi-megabyte tool results, on every
   * token. For D similarly sized deltas, copying a message that grows throughout the
   * stream makes total copied content grow quadratically with D. Nik Aiyer's PR #20314
   * significantly improved this with selective shallow snapshots, but it still creates
   * a complete message/parts shell per delta and allows delayed listeners to retain
   * every intermediate shape.
   *
   * In the dogfood profile that motivated this change, the
   * `structuredClone -> cloneMessage -> processStreamChunk` path accounted for 583.9 MiB
   * of sampled allocation, including 343.7 MiB directly in `structuredClone`; the
   * process finished near 1.9 GiB heap and 1.7 GiB old space without meaningful major-GC
   * recovery. That profile does not prove every retained byte belonged to cloning, but
   * it establishes that snapshot production was a material allocation source. The
   * retained-listener reproduction cited by #20314 was even starker: retaining roughly
   * 2,000 deltas with multi-megabyte tool results exhausted the heap under deep cloning,
   * while selective snapshots reduced growth to roughly 5 MiB. Live messages remove the
   * remaining producer-owned per-delta shells as well as the deep copies.
   *
   * Point-in-time consumers must now copy or serialize at their own async/storage
   * boundary. Do not unskip these tests by restoring producer-side snapshots; replace
   * them only if the event contract changes again with equivalent long-session proof.
   */
  it.skip('Given an emitted snapshot, When later chunks mutate the message in place, Then the snapshot is unchanged', async () => {
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

  it.skip('Given an emitted snapshot, When later chunks mutate reasoning and metadata in place, Then the snapshot is unchanged', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'reasoning-start', payload: { id: 'r1' } }), ctx);
    await engine.processStreamChunk(
      state,
      chunk({ type: 'reasoning-delta', payload: { id: 'r1', text: 'first' } }),
      ctx,
    );
    const snapshot = lastMessageEvent(events);

    await engine.processStreamChunk(
      state,
      chunk({ type: 'reasoning-delta', payload: { id: 'r1', text: ' second' } }),
      ctx,
    );
    await engine.processStreamChunk(state, chunk({ type: 'data-user-message', data: { id: 'sig-1' } }), ctx);

    expect(snapshot.content.parts).toEqual([
      { type: 'reasoning', reasoning: 'first', details: [{ type: 'text', text: 'first' }] },
    ]);
    expect(snapshot.content.metadata?.stopReason).toBeUndefined();
  });

  it.skip('Given the former shallow-snapshot contract, When emitted, Then mutable part shells are isolated', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();
    const args = { path: 'a.ts' };

    await engine.processStreamChunk(
      state,
      chunk({ type: 'tool-call', payload: { toolCallId: 'tc1', toolName: 'read', args } }),
      ctx,
    );
    const first = lastMessageEvent(events);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'hi' } }), ctx);
    const second = lastMessageEvent(events);

    const firstTool = first.content.parts.find(part => part.type === 'tool-invocation');
    const secondTool = second.content.parts.find(part => part.type === 'tool-invocation');
    if (firstTool?.type !== 'tool-invocation' || secondTool?.type !== 'tool-invocation') {
      throw new Error('missing tool invocation parts');
    }
    expect(secondTool).not.toBe(firstTool);
    expect(secondTool.toolInvocation).not.toBe(firstTool.toolInvocation);
    expect(secondTool.toolInvocation.args).toBe(firstTool.toolInvocation.args);
    expect(secondTool.toolInvocation.args).toBe(args);
  });

  it('Given a step-start carrying the response message id, When the turn streams, Then emitted messages adopt that id', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'Hello' } }), ctx);

    expect(lastMessageEvent(events).id).toBe('response-1');
  });

  it('Given a steer rotation, When the next step starts with a rotated id, Then the new message adopts it', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'first' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'data-user-message', data: { id: 'sig-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-2' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't2' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't2', text: 'second' } }), ctx);

    const assistantEnds = events.filter(event => event.type === 'message_end' && event.message.role === 'assistant');
    expect(assistantEnds[0]?.message.id).toBe('response-1');
    expect(lastMessageEvent(events).id).toBe('response-2');
  });

  it('Given a rotated response id mid-turn, When the next step starts, Then the stream splits where the loop did', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'first' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-2' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't2' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't2', text: 'second' } }), ctx);

    const assistantEnds = events.filter(event => event.type === 'message_end' && event.message.role === 'assistant');
    expect(assistantEnds.map(event => event.message.id)).toEqual(['response-1']);
    expect(textOf(assistantEnds[0]!.message)).toBe('first');
    expect(lastMessageEvent(events).id).toBe('response-2');
    expect(textOf(lastMessageEvent(events))).toBe('second');
  });

  it('Given repeated step-starts for one response id, When the turn streams, Then it stays a single message', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'first' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't2' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't2', text: ' second' } }), ctx);

    expect(events.filter(event => event.type === 'message_end')).toHaveLength(0);
    expect(lastMessageEvent(events).id).toBe('response-1');
    expect(textOf(lastMessageEvent(events))).toBe('first second');
  });

  it('Given a stream joined mid-message, When a later step-start rotates the id, Then the split still follows the loop', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'joined' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-2' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't2' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't2', text: 'next' } }), ctx);

    const assistantEnds = events.filter(event => event.type === 'message_end' && event.message.role === 'assistant');
    expect(assistantEnds.map(event => textOf(event.message))).toEqual(['joined']);
    expect(lastMessageEvent(events).id).toBe('response-2');
    expect(textOf(lastMessageEvent(events))).toBe('next');
  });

  it('Given an id already emitted or content already streamed, When step-start arrives, Then the engine keeps its own id', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx = requestContext();

    // Content before step-start: the id was already observable, must not change.
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't1' } }), ctx);
    const mintedId = lastMessageEvent(events).id;
    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-delta', payload: { id: 't1', text: 'first' } }), ctx);
    expect(lastMessageEvent(events).id).toBe(mintedId);

    // A reused id after rotation would collapse two display messages into one.
    await engine.processStreamChunk(state, chunk({ type: 'data-user-message', data: { id: 'sig-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'step-start', payload: { messageId: 'response-1' } }), ctx);
    await engine.processStreamChunk(state, chunk({ type: 'text-start', payload: { id: 't2' } }), ctx);
    expect(lastMessageEvent(events).id).not.toBe('response-1');
    expect(lastMessageEvent(events).id).not.toBe(mintedId);
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
