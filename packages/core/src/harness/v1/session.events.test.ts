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

import { parseHarnessEventId } from './events';
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
    const parsed = events.map(e => parseHarnessEventId(e.id));
    expect(events.every(e => e.id.startsWith('harness-v1:'))).toBe(true);
    const epochs = new Set(parsed.map(e => e.epoch));
    expect(epochs.size).toBe(1);
    const seqs = parsed.map(e => e.sequence);
    for (let i = 1; i < seqs.length; i += 1) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]!);
    }
  });

  it('resumes the durable event epoch and sequence when a session is rehydrated', async () => {
    const { harness, agent, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi' });
    await session._flushEventPersistence();
    await harness.shutdown();
    await session._flushEventPersistence();

    const state = await storage.getSessionEventReplayState({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
    });
    expect(state).not.toBeNull();

    const resumed = new Harness({
      agents: { default: agent } as any,
      modes: [
        { id: 'default', agentId: 'default' },
        { id: 'other', agentId: 'default' },
      ],
      defaultModeId: 'default',
      sessions: { storage },
    });
    try {
      const hydrated = await resumed.session({ resourceId: session.resourceId, threadId: session.threadId });
      const events: HarnessEvent[] = [];
      hydrated.subscribe(e => {
        events.push(e);
      });

      await hydrated.message({ content: 'again' });

      expect(events.length).toBeGreaterThan(0);
      const first = parseHarnessEventId(events[0]!.id);
      expect(first.epoch).toBe(state!.epoch);
      expect(first.sequence).toBeGreaterThan(state!.newestSequence);
    } finally {
      await resumed.shutdown();
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

  it('persists tool error events without poisoning event replay', async () => {
    const { harness, agent, storage } = setup();
    agent.chunks = [
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'lookup', args: { q: 'mastra' } },
        runId: 'fake-run',
      },
      {
        type: 'tool-error',
        payload: { toolCallId: 'tc1', error: new Error('lookup failed') },
        runId: 'fake-run',
      },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi' });

    await expect(session._flushEventPersistence()).resolves.toBeUndefined();
    const state = await storage.getSessionEventReplayState({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
    });
    expect(state).not.toBeNull();
    const rows = await storage.listSessionEvents({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      epoch: state!.epoch,
      afterSequence: 0,
      limit: 100,
    });
    expect(rows.map(row => row.event).find((event: any) => event.type === 'tool_end')).toMatchObject({
      type: 'tool_end',
      toolCallId: 'tc1',
      isError: true,
      result: { name: 'Error', code: 'Error', message: 'lookup failed' },
    });
  });

  it('persists repeated object references and undefined event fields without poisoning replay', async () => {
    const { harness, agent, storage } = setup();
    class Box {
      constructor(readonly value: string) {}
    }
    const shared = { ok: true };
    agent.chunks = [
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'lookup', args: { q: 'mastra' } },
        runId: 'fake-run',
      },
      {
        type: 'tool-result',
        payload: {
          toolCallId: 'tc1',
          result: {
            first: shared,
            second: shared,
            at: new Date('2026-05-19T00:00:00.000Z'),
            boxed: new Box('ok'),
            omitted: undefined,
          },
        },
        runId: 'fake-run',
      },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi' });

    await expect(session._flushEventPersistence()).resolves.toBeUndefined();
    const state = await storage.getSessionEventReplayState({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
    });
    expect(state).not.toBeNull();
    const rows = await storage.listSessionEvents({
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      epoch: state!.epoch,
      afterSequence: 0,
      limit: 100,
    });
    const toolEnd = rows.map(row => row.event).find((event: any) => event.type === 'tool_end') as any;
    expect(toolEnd).toMatchObject({
      type: 'tool_end',
      toolCallId: 'tc1',
      isError: false,
      result: {
        first: { ok: true },
        second: { ok: true },
        at: '2026-05-19T00:00:00.000Z',
        boxed: { value: 'ok' },
      },
    });
    expect(toolEnd.result).not.toHaveProperty('omitted');
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

  it('bridges a data-om-status writer chunk into an om_status event', async () => {
    const { harness, agent } = setup();
    agent.chunks = [
      {
        type: 'data-om-status',
        data: {
          windows: {
            active: {
              messages: { tokens: 41, threshold: 30000 },
              observations: { tokens: 1200, threshold: 40000 },
            },
            buffered: {
              observations: {
                status: 'running',
                chunks: 2,
                messageTokens: 500,
                projectedMessageRemoval: 400,
                observationTokens: 300,
              },
              reflection: {
                status: 'complete',
                inputObservationTokens: 900,
                observationTokens: 600,
              },
            },
          },
          recordId: 'om-record-1',
          threadId: 'thread-om',
          stepNumber: 3,
          generationCount: 4,
        },
        runId: 'fake-run',
      },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'observe it' });

    const status = events.find(e => e.type === 'om_status');
    expect(status).toMatchObject({
      type: 'om_status',
      windows: {
        active: {
          messages: { tokens: 41, threshold: 30000 },
          observations: { tokens: 1200, threshold: 40000 },
        },
        buffered: {
          observations: { status: 'running', chunks: 2 },
          reflection: { status: 'complete', observationTokens: 600 },
        },
      },
      recordId: 'om-record-1',
      threadId: 'thread-om',
      stepNumber: 3,
      generationCount: 4,
    });
  });

  it('bridges OM lifecycle writer chunks into typed OM events', async () => {
    const { harness, agent } = setup();
    agent.chunks = [
      {
        type: 'data-om-observation-start',
        data: { cycleId: 'obs-1', operationType: 'observation', tokensToObserve: 100 },
        runId: 'fake-run',
      },
      {
        type: 'data-om-observation-end',
        data: {
          cycleId: 'obs-1',
          operationType: 'observation',
          durationMs: 25,
          tokensObserved: 100,
          observationTokens: 80,
          observations: 'found facts',
          currentTask: 'ship',
          suggestedResponse: 'done',
        },
        runId: 'fake-run',
      },
      {
        type: 'data-om-observation-start',
        data: { cycleId: 'ref-1', operationType: 'reflection', tokensToObserve: 900 },
        runId: 'fake-run',
      },
      {
        type: 'data-om-observation-end',
        data: { cycleId: 'ref-1', operationType: 'reflection', durationMs: 30, observationTokens: 450 },
        runId: 'fake-run',
      },
      {
        type: 'data-om-buffering-start',
        data: { cycleId: 'buf-1', operationType: 'observation', tokensToBuffer: 200 },
        runId: 'fake-run',
      },
      {
        type: 'data-om-buffering-end',
        data: {
          cycleId: 'buf-1',
          operationType: 'observation',
          tokensBuffered: 200,
          bufferedTokens: 120,
          observations: 'buffered facts',
        },
        runId: 'fake-run',
      },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'observe lifecycle' });

    expect(events.find(e => e.type === 'om_observation_start')).toMatchObject({
      cycleId: 'obs-1',
      tokensToObserve: 100,
    });
    expect(events.find(e => e.type === 'om_observation_end')).toMatchObject({
      cycleId: 'obs-1',
      tokensObserved: 100,
      observationTokens: 80,
      observations: 'found facts',
      currentTask: 'ship',
      suggestedResponse: 'done',
    });
    expect(events.find(e => e.type === 'om_reflection_start')).toMatchObject({
      cycleId: 'ref-1',
      tokensToReflect: 900,
    });
    expect(events.find(e => e.type === 'om_reflection_end')).toMatchObject({
      cycleId: 'ref-1',
      compressedTokens: 450,
    });
    expect(events.find(e => e.type === 'om_buffering_start')).toMatchObject({
      cycleId: 'buf-1',
      tokensToBuffer: 200,
    });
    expect(events.find(e => e.type === 'om_buffering_end')).toMatchObject({
      cycleId: 'buf-1',
      tokensBuffered: 200,
      bufferedTokens: 120,
      observations: 'buffered facts',
    });
  });

  it('bridges OM writer chunks that arrive after the stream terminal before agent_end', async () => {
    const { harness, agent } = setup();
    agent.chunks = [
      { type: 'finish', runId: 'fake-run', finishReason: 'stop' },
      {
        type: 'data-om-observation-end',
        data: {
          cycleId: 'late-obs',
          operationType: 'observation',
          durationMs: 25,
          tokensObserved: 100,
          observationTokens: 80,
          observations: 'late observations',
        },
        runId: 'fake-run',
      },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'observe after terminal' });

    const eventTypes = events.map(e => e.type);
    const omIndex = eventTypes.indexOf('om_observation_end');
    const agentEndIndex = eventTypes.indexOf('agent_end');
    expect(omIndex).toBeGreaterThanOrEqual(0);
    expect(agentEndIndex).toBeGreaterThan(omIndex);
    expect(events[omIndex]).toMatchObject({
      type: 'om_observation_end',
      cycleId: 'late-obs',
      observations: 'late observations',
    });
  });

  it('bridges OM activation and thread-update writer chunks into typed OM events', async () => {
    const { harness, agent } = setup();
    agent.chunks = [
      {
        type: 'data-om-activation',
        data: {
          cycleId: 'act-1',
          operationType: 'observation',
          chunksActivated: 2,
          tokensActivated: 7300,
          observationTokens: 400,
          messagesActivated: 3,
          generationCount: 5,
          triggeredBy: 'ttl',
          lastActivityAt: 1770000000000,
          ttlExpiredMs: 120_000,
          config: { activateAfterIdle: 300_000 },
          previousModel: 'openai/gpt-4o',
          currentModel: 'anthropic/claude-sonnet-4-5',
        },
        runId: 'fake-run',
      },
      {
        type: 'data-om-thread-update',
        data: {
          cycleId: 'title-1',
          threadId: 'thread-om-title',
          oldTitle: 'Old title',
          newTitle: 'New title',
        },
        runId: 'fake-run',
      },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'activate observations' });

    expect(events.find(e => e.type === 'om_activation')).toMatchObject({
      type: 'om_activation',
      cycleId: 'act-1',
      operationType: 'observation',
      chunksActivated: 2,
      tokensActivated: 7300,
      observationTokens: 400,
      messagesActivated: 3,
      generationCount: 5,
      triggeredBy: 'ttl',
      lastActivityAt: 1770000000000,
      ttlExpiredMs: 120_000,
      activateAfterIdle: 300_000,
      previousModel: 'openai/gpt-4o',
      currentModel: 'anthropic/claude-sonnet-4-5',
    });
    expect(events.find(e => e.type === 'om_thread_title_updated')).toMatchObject({
      type: 'om_thread_title_updated',
      cycleId: 'title-1',
      threadId: 'thread-om-title',
      oldTitle: 'Old title',
      newTitle: 'New title',
    });
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
