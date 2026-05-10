/**
 * Harness v1 — Session.queue() (§4.2 / §6 / §10).
 *
 * Covers:
 *   - admission: capacity check, additionalTools rejected at compile-time,
 *     content validation, unknown-mode rejection
 *   - durable FIFO: items run head-of-line, persisted to `pendingQueue`,
 *     removed only after the turn completes
 *   - per-turn overrides: `mode` and `model` flow through to the stream call
 *   - events: `queue_item_started` on live drain, `queue_item_replayed` on
 *     hydration recovery, `agent_*` events carry `queuedItemId`
 *   - suspension mid-turn: drain parks on suspend, item stays in queue,
 *     `respondTo*` resumes and the resolver settles
 *   - drain after `message()`: queueing while a manual turn is in-flight
 *     drains as soon as the message resolves
 *   - crash replay: a hydrated record with a pending head item is drained
 *     and emits `queue_item_replayed`
 */

import { describe, expect, it } from 'vitest';

import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { MockAgent, setupHarness } from './__test-utils__';
import { HarnessQueueFullError, HarnessValidationError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

// ---------------------------------------------------------------------------
// Admission
// ---------------------------------------------------------------------------

describe('Session.queue() — admission', () => {
  it('appends the item, persists it to pendingQueue, and resolves with the AgentResult', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ finishReason: 'stop', text: 'queued reply' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const result = await session.queue({ content: 'do work' });

    expect(result.text).toBe('queued reply');
    expect(result.finishReason).toBe('stop');
    expect(session.getRecord().pendingQueue).toEqual([]);
    // The agent saw a single stream call carrying the queued content.
    expect(agent.streamCalls).toHaveLength(1);
    expect(agent.streamCalls[0]!.messages).toBe('do work');
  });

  it('rejects when content is empty', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.queue({ content: '' })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects an unknown mode override at admission', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.queue({ content: 'hi', mode: 'nope' })).rejects.toThrow(/unknown mode/);
  });

  it('throws HarnessQueueFullError once pendingQueue reaches sessions.maxQueueDepth', async () => {
    // Build a harness with a tiny cap so we can hit it.
    const agent = new MockAgent({ id: 'default' });
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage, maxQueueDepth: 1 },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    // Stage one suspending run so the first queued item parks the drain
    // and stays in pendingQueue. A second `queue()` then trips the cap.
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'r1',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    void session.queue({ content: 'first' });
    // Yield so the drain has a chance to start the first item.
    await new Promise(resolve => setImmediate(resolve));

    await expect(session.queue({ content: 'second' })).rejects.toBeInstanceOf(HarnessQueueFullError);
  });
});

// ---------------------------------------------------------------------------
// FIFO & overrides
// ---------------------------------------------------------------------------

describe('Session.queue() — FIFO + per-turn overrides', () => {
  it('runs queued items in FIFO order', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRuns([
      { finishReason: 'stop', text: 'A' },
      { finishReason: 'stop', text: 'B' },
      { finishReason: 'stop', text: 'C' },
    ]);
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const [a, b, c] = await Promise.all([
      session.queue({ content: 'a' }),
      session.queue({ content: 'b' }),
      session.queue({ content: 'c' }),
    ]);

    expect([a.text, b.text, c.text]).toEqual(['A', 'B', 'C']);
    expect(agent.streamCalls.map(c => c.messages)).toEqual(['a', 'b', 'c']);
  });

  it('threads a per-turn `mode` override into the agent.stream() options', async () => {
    const a = new MockAgent({ id: 'a' });
    const b = new MockAgent({ id: 'b' });
    const { harness } = setupHarness({
      agents: { a, b },
      modes: [
        { id: 'modeA', agentId: 'a' },
        { id: 'modeB', agentId: 'b' },
      ],
      defaultModeId: 'modeA',
    });
    a.enqueueRun({ finishReason: 'stop', text: 'A' });
    b.enqueueRun({ finishReason: 'stop', text: 'B' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const aRes = await session.queue({ content: 'first' });
    const bRes = await session.queue({ content: 'second', mode: 'modeB' });

    expect(aRes.text).toBe('A');
    expect(bRes.text).toBe('B');
    expect(a.streamCalls).toHaveLength(1);
    expect(b.streamCalls).toHaveLength(1);
  });

  it('persists per-turn overrides on the QueuedItem until the turn drains', async () => {
    const { harness, agent } = setupHarness();
    // Stage a suspending run so we can inspect the queue mid-flight.
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'r1',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'x' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    void session.queue({ content: 'go', model: 'override-model' });
    await new Promise(resolve => setImmediate(resolve));

    const head = session.getRecord().pendingQueue?.[0];
    expect(head).toBeDefined();
    expect(head!.content).toBe('go');
    expect(head!.model).toBe('override-model');
  });
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe('Session.queue() — events', () => {
  it('emits queue_item_started before agent_start and tags turn events with queuedItemId', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ finishReason: 'stop', text: 'ok' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    await session.queue({ content: 'go' });

    const types = events.map(e => e.type);
    const started = types.indexOf('queue_item_started');
    const agentStart = types.indexOf('agent_start');
    const agentEnd = types.indexOf('agent_end');
    expect(started).toBeGreaterThanOrEqual(0);
    expect(agentStart).toBeGreaterThan(started);
    expect(agentEnd).toBeGreaterThan(agentStart);

    // queuedItemId flows through agent_start / agent_end.
    const startedEvt = events[started] as Extract<HarnessEvent, { type: 'queue_item_started' }>;
    const startEvt = events[agentStart] as Extract<HarnessEvent, { type: 'agent_start' }>;
    const endEvt = events[agentEnd] as Extract<HarnessEvent, { type: 'agent_end' }>;
    expect(startEvt.queuedItemId).toBe(startedEvt.queuedItemId);
    expect(endEvt.queuedItemId).toBe(startedEvt.queuedItemId);
  });
});

// ---------------------------------------------------------------------------
// Suspension mid-turn
// ---------------------------------------------------------------------------

describe('Session.queue() — suspension', () => {
  it('parks the drain on suspend, leaves the item at the head, and resumes after respondTo*', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'r1',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'rm' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const queued = session.queue({ content: 'sensitive' });
    await new Promise(resolve => setImmediate(resolve));

    // Mid-flight: item still in the queue, suspension captured.
    expect(session.getRecord().pendingQueue?.length).toBe(1);
    expect(session.getRecord().pendingResume?.kind).toBe('tool-approval');

    // Stage the resumed run, then approve.
    agent.enqueueRun({ finishReason: 'stop', runId: 'r1', text: 'done' });
    await session.respondToToolApproval({ approved: true });

    const result = await queued;
    expect(result.text).toBe('done');
    expect(result.finishReason).toBe('stop');
    expect(session.getRecord().pendingQueue).toEqual([]);
    expect(session.getRecord().pendingResume).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Drain interaction with message()
// ---------------------------------------------------------------------------

describe('Session.queue() — drains after message()', () => {
  it('lets a queued item run after a manual message() turn finishes', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRuns([
      { finishReason: 'stop', text: 'manual' },
      { finishReason: 'stop', text: 'queued' },
    ]);
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    // Fire both: message() first, queue() second. Both should land back-to-back.
    const m = session.message({ content: 'manual call' });
    const q = session.queue({ content: 'queued call' });
    const [manual, queued] = await Promise.all([m, q]);

    expect(manual.text).toBe('manual');
    expect(queued.text).toBe('queued');
    expect(agent.streamCalls.map(c => c.messages)).toEqual(['manual call', 'queued call']);
  });
});

// ---------------------------------------------------------------------------
// Crash replay
// ---------------------------------------------------------------------------

describe('Session.queue() — crash replay', () => {
  it('emits queue_item_replayed (not _started) when a hydrated record carries a pending head item', async () => {
    // Inject a SessionRecord directly into storage so we bypass the
    // live-session map entirely and exercise the hydration path. This
    // simulates "process restarted with one item still in pendingQueue".
    const db = new InMemoryDB();
    const storage = new InMemoryHarness({ db });

    const sessionId = 'sess-replay';
    const queuedItemId = 'q-survive';
    const now = Date.now();
    db.harnessSessions.set(sessionId, {
      id: sessionId,
      resourceId: 'u',
      threadId: 't-replay',
      origin: 'top-level',
      ownsThread: false,
      modeId: 'default',
      modelId: 'default',
      subagentModelOverrides: {},
      permissionRules: { categories: {}, tools: {} },
      sessionGrants: { categories: [], tools: [] },
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      pendingQueue: [
        {
          id: queuedItemId,
          enqueuedAt: now,
          content: 'survive me',
          attachments: [],
        },
      ],
      // Crucially: no pendingResume, so the drain proceeds rather than parks.
      state: undefined,
      createdAt: now,
      lastActivityAt: now,
      version: 0,
    });

    const replayAgent = new MockAgent({ id: 'default' });
    replayAgent.enqueueRun({ finishReason: 'stop', runId: 'r1', text: 'recovered' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });

    const events: HarnessEvent[] = [];
    replayHarness.subscribe(e => {
      events.push(e);
    });

    await replayHarness.session({ sessionId });
    // Let the drain finish.
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    const replayed = events.find(e => e.type === 'queue_item_replayed');
    const started = events.find(e => e.type === 'queue_item_started');
    expect(replayed).toBeDefined();
    expect((replayed as Extract<HarnessEvent, { type: 'queue_item_replayed' }>).queuedItemId).toBe(queuedItemId);
    expect(started).toBeUndefined();
    // Item drained off the queue successfully.
    expect(replayAgent.streamCalls).toHaveLength(1);
  });
});
