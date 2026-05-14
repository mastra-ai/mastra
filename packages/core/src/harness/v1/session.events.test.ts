/**
 * Harness v1 — event surface (§10).
 *
 * Covers Session.subscribe() + Harness.subscribe() lifecycle:
 *   - subscribers receive events emitted after subscribe() returns
 *   - unsubscribe stops delivery
 *   - mode_changed / model_changed / session_closed lifecycle events
 *   - agent_start / message_* / tool_input_* / tool_start / tool_end /
 *     agent_end produced while draining a streaming agent's fullStream
 *   - suspension_required / suspension_resolved on suspend/resume round-trip
 *   - throwing subscriber is isolated; other subscribers still see events
 *   - harness-level subscribers see session_created and forwarded session events
 *   - event ids share a single epoch and are monotonic
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import type { HarnessEvent } from './events';
import { Harness } from './harness';

// ---------------------------------------------------------------------------
// Fake agent that drives a programmable fullStream + getFullOutput.
// ---------------------------------------------------------------------------

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
  fullOutput: any = {
    text: 'ok',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finishReason: 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };

  constructor(name: string) {
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  async stream(_messages: any, options?: any): Promise<any> {
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
      chunks: this.chunks,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }

  async generate(_messages: any, _options?: any): Promise<any> {
    return this.fullOutput;
  }

  async resumeStream(_resumeData: any, options?: any): Promise<any> {
    return this.stream(undefined, options);
  }
}

function setup() {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [
      { id: 'default', agentId: 'default' },
      { id: 'other', agentId: 'default' },
    ],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent, storage };
}

describe('Session.subscribe()', () => {
  it('delivers events emitted after subscribe()', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    const off = session.subscribe(e => {
      events.push(e);
    });

    await session.message({ content: 'hi' });

    const types = events.map(e => e.type);
    expect(types).toContain('agent_start');
    expect(types).toContain('agent_end');
    expect(events.every(e => e.sessionId === session.id)).toBe(true);
    off();
  });

  it('stops delivering after unsubscribe()', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    const off = session.subscribe(e => {
      events.push(e);
    });
    off();
    await session.message({ content: 'hi' });

    expect(events).toEqual([]);
  });

  it('isolates a throwing subscriber from other subscribers', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const ok: HarnessEvent[] = [];
    session.subscribe(() => {
      throw new Error('boom');
    });
    session.subscribe(e => {
      ok.push(e);
    });

    // Producer must not throw.
    await expect(session.message({ content: 'hi' })).resolves.toBeDefined();

    expect(ok.some(e => e.type === 'agent_start')).toBe(true);
    expect(ok.some(e => e.type === 'agent_end')).toBe(true);
  });

  it('emits mode_changed and model_changed with previous ids', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    await session.switchMode({ mode: 'other' });
    await session.models.switch({ model: 'gpt-5' });

    const mode = events.find(e => e.type === 'mode_changed');
    const model = events.find(e => e.type === 'model_changed');
    expect(mode).toMatchObject({ type: 'mode_changed', modeId: 'other', previousModeId: 'default' });
    expect(model).toMatchObject({ type: 'model_changed', modelId: 'gpt-5' });
  });

  it('skips mode_changed when the modeId is unchanged', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    await session.switchMode({ mode: 'default' });
    expect(events.find(e => e.type === 'mode_changed')).toBeUndefined();
  });

  it('produces monotonic ids that share a single epoch', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'hi' });

    expect(events.length).toBeGreaterThan(1);
    const epochs = new Set(events.map(e => e.id.split('-').slice(0, 5).join('-')));
    expect(epochs.size).toBe(1);
    const seqs = events.map(e => Number(e.id.split('-').slice(-1)[0]));
    for (let i = 1; i < seqs.length; i += 1) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]!);
    }
  });
});

describe('Session events — fullStream drain', () => {
  it('emits message_start / message_update / message_end around a text stream', async () => {
    const { harness, agent } = setup();
    agent.chunks = [
      { type: 'text-start', payload: { id: 'msg-1' }, runId: 'fake-run' },
      { type: 'text-delta', payload: { id: 'msg-1', text: 'hel' }, runId: 'fake-run' },
      { type: 'text-delta', payload: { id: 'msg-1', text: 'lo' }, runId: 'fake-run' },
      { type: 'text-end', payload: { id: 'msg-1' }, runId: 'fake-run' },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'hi' });

    const messageEvents = events.filter(
      e => e.type === 'message_start' || e.type === 'message_update' || e.type === 'message_end',
    );
    expect(messageEvents.map(e => e.type)).toEqual([
      'message_start',
      'message_update',
      'message_update',
      'message_end',
    ]);
    expect((messageEvents[0] as any).messageId).toBe('msg-1');
    expect(messageEvents.slice(1, 3).map((e: any) => e.delta)).toEqual(['hel', 'lo']);
    expect((messageEvents[3] as any).messageId).toBe('msg-1');
  });

  it('emits tool_start and tool_end around a tool-call/tool-result pair', async () => {
    const { harness, agent } = setup();
    agent.chunks = [
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'lookup', args: { q: 'mastra' } },
        runId: 'fake-run',
      },
      {
        type: 'tool-result',
        payload: { toolCallId: 'tc1', result: { hits: 3 } },
        runId: 'fake-run',
      },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'hi' });

    const start = events.find(e => e.type === 'tool_start');
    const end = events.find(e => e.type === 'tool_end');
    expect(start).toMatchObject({ type: 'tool_start', toolCallId: 'tc1', toolName: 'lookup' });
    expect(end).toMatchObject({ type: 'tool_end', toolCallId: 'tc1', isError: false });
  });

  it('bridges a data-task-updated writer chunk into a task_updated event', async () => {
    // Round-trips the taskWrite tool's emission path: tools publish via
    // `ctx.writer?.custom({ type: 'data-task-updated', data: { tasks } })`
    // and the harness translates that into a typed `task_updated` event.
    const { harness, agent } = setup();
    const tasks = [
      { content: 'A', activeForm: 'Doing A', status: 'pending' as const },
      { content: 'B', activeForm: 'Doing B', status: 'completed' as const },
    ];
    agent.chunks = [{ type: 'data-task-updated', data: { tasks }, runId: 'fake-run' }];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'do it' });

    const updated = events.find(e => e.type === 'task_updated');
    expect(updated).toBeDefined();
    expect(updated).toMatchObject({ type: 'task_updated', tasks });
    expect((updated as any).sessionId).toBe(session.id);
  });

  it('ignores a data-task-updated chunk whose payload is missing a tasks array', async () => {
    // The bridge only fires for well-formed payloads — malformed `data-*`
    // chunks pass silently rather than emitting a half-typed event.
    const { harness, agent } = setup();
    agent.chunks = [
      { type: 'data-task-updated', data: { tasks: 'not-an-array' }, runId: 'fake-run' },
      { type: 'data-task-updated', data: undefined, runId: 'fake-run' },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'hi' });

    expect(events.find(e => e.type === 'task_updated')).toBeUndefined();
  });
});

describe('Session events — suspension round-trip', () => {
  it('emits suspension_required on capture and suspension_resolved on resume', async () => {
    const { harness, agent } = setup();
    agent.fullOutput = {
      ...agent.fullOutput,
      finishReason: 'suspended',
      suspendPayload: {
        toolCallId: 'tc1',
        toolName: 'do_thing',
        args: { x: 1 },
      },
    };
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    await session.message({ content: 'do it' });
    expect(events.some(e => e.type === 'suspension_required')).toBe(true);

    // Flip the agent so the resumed run completes.
    agent.fullOutput = { ...agent.fullOutput, finishReason: 'stop', suspendPayload: undefined };

    await session.respondToToolApproval({ approved: true });
    expect(events.some(e => e.type === 'suspension_resolved')).toBe(true);
  });
});

describe('Harness.subscribe()', () => {
  it('delivers session_created when a session is opened', async () => {
    const { harness } = setup();
    const events: HarnessEvent[] = [];
    harness.subscribe(e => {
      events.push(e);
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const created = events.find(e => e.type === 'session_created');
    expect(created).toMatchObject({
      type: 'session_created',
      sessionId: session.id,
      resourceId: 'u1',
      modeId: 'default',
    });
  });

  it('forwards session-level events to harness subscribers without re-stamping', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const sessionEvents: HarnessEvent[] = [];
    const harnessEvents: HarnessEvent[] = [];
    session.subscribe(e => {
      sessionEvents.push(e);
    });
    harness.subscribe(e => {
      harnessEvents.push(e);
    });

    await session.message({ content: 'hi' });

    // Every session-level event reaches the harness subscriber too.
    const sessionStart = sessionEvents.find(e => e.type === 'agent_start');
    const harnessStart = harnessEvents.find(e => e.type === 'agent_start');
    expect(sessionStart).toBeDefined();
    expect(harnessStart).toBeDefined();
    // Forwarded events keep their original id (no double-stamping).
    expect(harnessStart!.id).toBe(sessionStart!.id);
    expect(harnessStart!.sessionId).toBe(session.id);
  });

  it('emits session_closed when a session is closed', async () => {
    const { harness } = setup();
    const events: HarnessEvent[] = [];
    harness.subscribe(e => {
      events.push(e);
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.close();

    const closed = events.find(e => e.type === 'session_closed');
    expect(closed).toMatchObject({
      type: 'session_closed',
      sessionId: session.id,
      reason: 'requested',
    });
  });

  it('emits session_evicted on shutdown', async () => {
    const { harness } = setup();
    const events: HarnessEvent[] = [];
    harness.subscribe(e => {
      events.push(e);
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await harness.shutdown();

    const evicted = events.find(e => e.type === 'session_evicted');
    expect(evicted).toMatchObject({
      type: 'session_evicted',
      sessionId: session.id,
      reason: 'shutdown',
    });
  });
});
