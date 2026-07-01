import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list/state/types';
import { SessionRunEngine } from '../session-run-engine';

/**
 * BDD spec for the DB-native message contract of the run engine.
 *
 * Given a streamed run, the engine must build and emit `MastraDBMessage`s:
 * `content.format === 2` with nested `content.parts` accumulating
 * `text` / `reasoning` / `tool-invocation` parts in stream order — NOT the
 * legacy flat `AgentControllerMessageContent` union.
 */

type EmittedEvent = { type: string; message?: MastraDBMessage; [k: string]: unknown };

function createHarness() {
  const events: EmittedEvent[] = [];
  let idCounter = 0;

  const session: any = {
    emit: (event: EmittedEvent) => events.push(event),
    run: {
      nextOperation: vi.fn(),
      setRunId: vi.fn(),
      isAbortRequested: () => false,
      reset: vi.fn(),
    },
    drainFollowUpQueue: vi.fn(async () => {}),
    thread: { getId: () => 'thread-1' },
  };

  const machinery: any = {
    generateId: () => `msg-${++idCounter}`,
    buildRequestContext: async () => ({}),
  };

  const engine = new SessionRunEngine(session, machinery);
  return { engine, events, session };
}

function lastMessageEvent(events: EmittedEvent[]): MastraDBMessage {
  const evt = [...events].reverse().find(e => e.message);
  if (!evt?.message) throw new Error('no message event emitted');
  return evt.message;
}

describe('SessionRunEngine — MastraDBMessage contract', () => {
  it('Given a text stream, When chunks arrive, Then it emits a MastraDBMessage with a text part', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx: any = {};

    await engine.processStreamChunk(state, { type: 'text-start', payload: { id: 't1' } }, ctx);
    await engine.processStreamChunk(state, { type: 'text-delta', payload: { id: 't1', text: 'Hello' } }, ctx);
    await engine.processStreamChunk(state, { type: 'text-delta', payload: { id: 't1', text: ' world' } }, ctx);

    const message = lastMessageEvent(events);
    expect(message.content.format).toBe(2);
    expect(message.content.parts).toEqual([{ type: 'text', text: 'Hello world' }]);
    expect(message.role).toBe('assistant');
  });

  it('Given a reasoning stream, When chunks arrive, Then it emits a reasoning part', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx: any = {};

    await engine.processStreamChunk(state, { type: 'reasoning-start', payload: { id: 'r1' } }, ctx);
    await engine.processStreamChunk(state, { type: 'reasoning-delta', payload: { id: 'r1', text: 'thinking…' } }, ctx);

    const message = lastMessageEvent(events);
    const reasoningPart = message.content.parts.find(p => p.type === 'reasoning');
    expect(reasoningPart).toMatchObject({ type: 'reasoning', reasoning: 'thinking…' });
  });

  it('Given a tool call + result, When chunks arrive, Then it emits a tool-invocation part', async () => {
    const { engine, events } = createHarness();
    const state = engine.createStreamState();
    const ctx: any = {};

    await engine.processStreamChunk(
      state,
      { type: 'tool-call', payload: { toolCallId: 'tc1', toolName: 'read', args: { path: 'a.ts' } } },
      ctx,
    );
    await engine.processStreamChunk(
      state,
      { type: 'tool-result', payload: { toolCallId: 'tc1', toolName: 'read', result: 'ok' } },
      ctx,
    );

    const message = lastMessageEvent(events);
    const toolPart = message.content.parts.find(p => p.type === 'tool-invocation') as any;
    expect(toolPart.toolInvocation.toolCallId).toBe('tc1');
    expect(toolPart.toolInvocation.toolName).toBe('read');
    expect(toolPart.toolInvocation.state).toBe('result');
    expect(toolPart.toolInvocation.result).toBe('ok');
  });
});
