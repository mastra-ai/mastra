/**
 * Harness v1 — Session.queue() (§4.2 / §6 / §10).
 *
 * Covers:
 *   - admission: capacity check, additionalTools rejected at compile-time,
 *     content validation, unknown-mode rejection
 *   - durable FIFO: items run head-of-line, persisted to `pendingQueue`,
 *     removed only after the turn completes
 *   - per-turn overrides: `mode` flows through to the stream call and `model`
 *     persists on the queued item
 *   - events: `queue_item_started` on live drain, `queue_item_replayed` on
 *     hydration recovery, `agent_*` events carry `queuedItemId`
 *   - suspension mid-turn: drain parks on suspend, item stays in queue,
 *     `respondTo*` resumes and the resolver settles
 *   - drain after `message()`: queueing while a manual turn is in-flight
 *     drains as soon as the message resolves
 *   - crash replay: a hydrated record with a pending head item is drained
 *     and emits `queue_item_replayed`
 */

import { describe, expect, it, vi } from 'vitest';

import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryStore } from '../../storage/mock';

import { extractSignalContents, MockAgent, setupHarness } from './__test-utils__';
import {
  HarnessAdmissionConflictError,
  HarnessQueueFullError,
  HarnessSessionDeletedError,
  HarnessValidationError,
} from './errors';
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
    expect(extractSignalContents(agent.streamCalls[0]!.messages)).toBe('do work');
    await session.close();
  });

  it('rejects when content is empty', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.queue({ content: '' })).rejects.toBeInstanceOf(HarnessValidationError);
    await session.close();
  });

  it('rejects an unknown mode override at admission', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.queue({ content: 'hi', mode: 'nope' })).rejects.toThrow(/unknown mode/);
    await session.close();
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
    const first = session.queue({ content: 'first' });
    // Yield so the drain has a chance to start the first item.
    await new Promise(resolve => setImmediate(resolve));

    await expect(session.queue({ content: 'second' })).rejects.toBeInstanceOf(HarnessQueueFullError);
    agent.enqueueRun({ finishReason: 'stop', runId: 'r1', text: 'done' });
    await session.respondToToolApproval({ approved: true });
    await first;
    await session.close();
  });

  it('dedupes exact admissionId retries without appending another item', async () => {
    const { harness, agent } = setupHarness();
    let release!: () => void;
    const holdUntil = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'queued reply', holdUntil });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const first = session.queue({ content: 'do work', admissionId: 'queue-1' });
    await new Promise(resolve => setImmediate(resolve));
    const second = session.queue({ content: 'do work', admissionId: 'queue-1' });

    expect(session.getRecord().pendingQueue).toHaveLength(1);
    release();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.text).toBe('queued reply');
    expect(secondResult.text).toBe('queued reply');
    expect(agent.streamCalls).toHaveLength(1);
    const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(receipt).toMatchObject({
      admissionId: 'queue-1',
      modeId: 'default',
      status: 'completed',
      postRunFinalizedAt: expect.any(Number),
      result: expect.objectContaining({ text: 'queued reply' }),
      signalId: expect.any(String),
      runId: expect.any(String),
    });
    await session.close();
  });

  it('admits a queued turn and returns queued item identity before result lookup', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ finishReason: 'stop', text: 'queued reply' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const drain = vi.spyOn(session as unknown as { _maybeDrainQueue(): Promise<void> }, '_maybeDrainQueue');

    const admitted = await session.admitQueue({ content: 'do work', admissionId: 'queue-admit-1' });
    const duplicate = await session.admitQueue({ content: 'do work', admissionId: 'queue-admit-1' });

    expect(admitted).toEqual({
      accepted: true,
      queuedItemId: expect.any(String),
      duplicate: false,
    });
    expect(duplicate).toEqual({
      accepted: true,
      queuedItemId: admitted.queuedItemId,
      duplicate: true,
    });
    expect(drain).toHaveBeenCalledTimes(2);
    expect(session.getRecord().pendingQueue).toHaveLength(1);
    await session.close();
  });

  it('emits queue_item_started for fresh remote queue admissions', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ finishReason: 'stop', text: 'queued reply' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));

    const admitted = await session.admitQueue({ content: 'do work', admissionId: 'queue-admit-event' });
    await session.waitForIdle({ timeoutMs: 1000 });

    expect(events.find(e => e.type === 'queue_item_started')).toMatchObject({ queuedItemId: admitted.queuedItemId });
    expect(events.find(e => e.type === 'queue_item_replayed')).toBeUndefined();
    await session.close();
  });

  it('keeps durable duplicate queue waiters deletion-aware after close starts', async () => {
    const { harness, storage, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    const evidence = {
      admissionId: 'queue-delete-duplicate',
      admissionHash: 'stored-hash',
      queuedItemId: 'q-durable-duplicate-without-local-resolver',
      modeId: 'default',
      status: 'queued',
      attempts: 0,
      enqueuedAt: now,
      updatedAt: now,
    };
    let releaseEvidenceLoad!: () => void;
    const evidenceLoadGate = new Promise<void>(resolve => {
      releaseEvidenceLoad = resolve;
    });
    const evidenceLoadStarted = new Promise<void>(resolve => {
      const loadQueueResultEvidence = storage.loadQueueResultEvidence.bind(storage);
      storage.loadQueueResultEvidence = (async (...args: Parameters<typeof storage.loadQueueResultEvidence>) => {
        const [opts] = args;
        if (opts.queuedItemId === evidence.queuedItemId) {
          resolve();
          await evidenceLoadGate;
        }
        return loadQueueResultEvidence(...args);
      }) as typeof storage.loadQueueResultEvidence;
    });
    (session as any)._resolveQueueAdmissionDuplicate = async () => {
      const record = session.getRecord();
      (session as any)._record = {
        ...record,
        closingAt: record.closingAt ?? Date.now(),
        closeDeadlineAt: record.closeDeadlineAt ?? Date.now() + 1000,
      };
      return evidence;
    };

    const duplicate = session.queue({ content: 'do work', admissionId: 'queue-delete-duplicate' });
    const duplicateSettled = duplicate.then(
      value => ({ ok: true as const, value }),
      err => ({ ok: false as const, err }),
    );
    await evidenceLoadStarted;

    (session as any)._markDeleted();

    try {
      await expect(duplicateSettled).resolves.toMatchObject({ ok: false, err: expect.any(HarnessSessionDeletedError) });
    } finally {
      releaseEvidenceLoad();
    }
    expect(agent.streamCalls).toHaveLength(0);
  });

  it('keeps a completed admission receipt if completed signal evidence cannot be written', async () => {
    const { harness, agent, storage } = setupHarness();
    const writeMessageResultEvidence = storage.writeMessageResultEvidence.bind(storage);
    let completedEvidenceAttempts = 0;
    storage.writeMessageResultEvidence = async record => {
      if (record.status === 'completed') {
        completedEvidenceAttempts++;
        throw new Error('completed signal evidence unavailable');
      }
      return writeMessageResultEvidence(record);
    };
    agent.enqueueRun({ finishReason: 'stop', text: 'queued reply' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const result = await session.queue({ content: 'do work', admissionId: 'queue-evidence-failure' });

    expect(result.text).toBe('queued reply');
    expect(completedEvidenceAttempts).toBe(1);
    expect(session.getRecord().pendingQueue).toEqual([]);
    const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(receipt).toMatchObject({
      admissionId: 'queue-evidence-failure',
      status: 'completed',
      postRunFinalizedAt: expect.any(Number),
      result: expect.objectContaining({ text: 'queued reply' }),
    });
    expect(receipt?.error).toBeUndefined();
    await session.close();
  });

  it('retries post-run finalization without removing a completed queued item', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ finishReason: 'stop', text: 'queued reply' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const markQueuedPostRunFinalized = (session as any)._markQueuedPostRunFinalized.bind(session);
    const runGoalJudge = (session as any)._runGoalJudge.bind(session);
    let markerAttempts = 0;
    let goalJudgeAttempts = 0;
    (session as any)._markQueuedPostRunFinalized = async (...args: unknown[]) => {
      markerAttempts++;
      if (markerAttempts === 1) {
        throw new Error('post-run finalization marker unavailable');
      }
      return markQueuedPostRunFinalized(...args);
    };
    (session as any)._runGoalJudge = async (...args: unknown[]) => {
      goalJudgeAttempts++;
      return runGoalJudge(...args);
    };

    const queued = session.queue({ content: 'do work', admissionId: 'queue-finalization-retry' });
    await new Promise(resolve => setImmediate(resolve));
    expect(session.getRecord().pendingQueue).toHaveLength(1);
    const pendingReceipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(pendingReceipt).toMatchObject({
      status: 'completed',
    });
    expect(pendingReceipt?.postRunFinalizedAt).toBeUndefined();

    const duplicate = session.queue({ content: 'do work', admissionId: 'queue-finalization-retry' });
    await (session as any)._kickQueueDrain();
    const [result, duplicateResult] = await Promise.all([queued, duplicate]);

    expect(result.text).toBe('queued reply');
    expect(duplicateResult.text).toBe('queued reply');
    expect(markerAttempts).toBe(2);
    expect(goalJudgeAttempts).toBe(1);
    expect(session.getRecord().pendingQueue).toEqual([]);
    const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(receipt).toMatchObject({
      admissionId: 'queue-finalization-retry',
      status: 'completed',
      postRunFinalizedAt: expect.any(Number),
      result: expect.objectContaining({ text: 'queued reply' }),
    });
    await session.close();
  });

  it('conflicts on same admissionId with different queue payload', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ finishReason: 'stop', text: 'first reply' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.queue({ content: 'first', admissionId: 'queue-conflict' });

    await expect(session.queue({ content: 'second', admissionId: 'queue-conflict' })).rejects.toBeInstanceOf(
      HarnessAdmissionConflictError,
    );
    expect(agent.streamCalls).toHaveLength(1);
    await session.close();
  });

  it('replays a completed admissionId result from retained queue receipt', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ finishReason: 'stop', text: 'first reply' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const first = await session.queue({ content: 'first', admissionId: 'queue-completed' });
    const duplicate = await session.queue({ content: 'first', admissionId: 'queue-completed' });

    expect(first.text).toBe('first reply');
    expect(duplicate.text).toBe('first reply');
    expect(agent.streamCalls).toHaveLength(1);
    await session.close();
  });

  it('does not treat a later default mode switch as a conflicting duplicate admission', async () => {
    const defaultAgent = new MockAgent({ id: 'default' });
    const otherAgent = new MockAgent({ id: 'other' });
    const { harness } = setupHarness({
      agents: { default: defaultAgent, other: otherAgent },
      modes: [
        { id: 'default', agentId: 'default' },
        { id: 'other', agentId: 'other' },
      ],
      defaultModeId: 'default',
    });
    defaultAgent.enqueueRun({ finishReason: 'stop', text: 'first reply' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const first = await session.queue({ content: 'same', admissionId: 'queue-default-mode' });
    await session.switchMode({ mode: 'other' });
    const duplicate = await session.queue({ content: 'same', admissionId: 'queue-default-mode' });

    expect(first.text).toBe('first reply');
    expect(duplicate.text).toBe('first reply');
    expect(defaultAgent.streamCalls).toHaveLength(1);
    expect(otherAgent.streamCalls).toHaveLength(0);
    await session.close();
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
    expect(agent.streamCalls.map(c => extractSignalContents(c.messages))).toEqual(['a', 'b', 'c']);
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

    const queued = session.queue({ content: 'go', model: 'override-model' });
    void queued.catch(() => {});
    await new Promise(resolve => setImmediate(resolve));

    const head = session.getRecord().pendingQueue?.[0];
    expect(head).toBeDefined();
    expect(head!.content).toBe('go');
    expect(head!.model).toBe('override-model');
    await session.close();
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
    const { harness, agent, storage } = setupHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'r1',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'rm' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const queued = session.queue({ content: 'sensitive', model: 'queued-model' });
    await new Promise(resolve => setImmediate(resolve));

    // Mid-flight: item still in the queue, suspension captured.
    expect(session.getRecord().pendingQueue?.length).toBe(1);
    expect(session.getRecord().pendingResume?.kind).toBe('tool-approval');
    expect(session.getRecord().pendingResume?.runtimeDependencies?.modelId).toBe('queued-model');
    const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(receipt?.runtimeDependencies?.modelId).toBe('queued-model');
    expect(receipt?.signalId).toBeDefined();
    let signalEvidence = await storage.loadMessageResultEvidence({
      harnessName: 'default',
      sessionId: session.id,
      resourceId: 'u',
      threadId: session.threadId,
      signalId: receipt!.signalId!,
    });
    for (let attempt = 0; !signalEvidence && attempt < 10; attempt++) {
      await new Promise(resolve => setImmediate(resolve));
      signalEvidence = await storage.loadMessageResultEvidence({
        harnessName: 'default',
        sessionId: session.id,
        resourceId: 'u',
        threadId: session.threadId,
        signalId: receipt!.signalId!,
      });
    }
    expect(signalEvidence).toMatchObject({ status: 'pending' });

    // Stage the resumed run, then approve.
    agent.enqueueRun({ finishReason: 'stop', runId: 'r1', text: 'done' });
    await session.respondToToolApproval({ approved: true });

    const result = await queued;
    expect(result.text).toBe('done');
    expect(result.finishReason).toBe('stop');
    expect(session.getRecord().pendingQueue).toEqual([]);
    expect(session.getRecord().pendingResume).toBeUndefined();
  });

  it('keeps queued context while queued resume post-run side effects finish', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'r1',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'approve' } },
    });
    agent.enqueueRun({ finishReason: 'stop', runId: 'r1', text: 'resumed done' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const runGoalJudge = (session as any)._runGoalJudge.bind(session);
    let releaseGoalJudge!: () => void;
    const goalJudgeGate = new Promise<void>(resolve => {
      releaseGoalJudge = resolve;
    });
    let goalJudgeStarted = false;
    (session as any)._runGoalJudge = async (...args: unknown[]) => {
      goalJudgeStarted = true;
      await goalJudgeGate;
      return runGoalJudge(...args);
    };

    const first = session.queue({ content: 'first' });
    await new Promise(resolve => setImmediate(resolve));
    const queuedItemId = session.getRecord().pendingQueue[0]!.id;
    const resumed = session.respondToToolApproval({ approved: true });
    await new Promise(resolve => setImmediate(resolve));

    expect(goalJudgeStarted).toBe(true);
    expect(session.getDisplayState().currentQueuedItemId).toBe(queuedItemId);

    releaseGoalJudge();
    const [resumeResult, firstResult] = await Promise.all([resumed, first]);

    expect(resumeResult.text).toBe('resumed done');
    expect(firstResult.text).toBe('resumed done');
    expect(session.getDisplayState().currentQueuedItemId).toBeUndefined();
    await session.close();
  });

  it('resumes a suspended queued mode override through the queued mode agent', async () => {
    const agentA = new MockAgent({ id: 'agentA' });
    const agentB = new MockAgent({ id: 'agentB' });
    agentB.enqueueRun({
      finishReason: 'suspended',
      runId: 'mode-b-run',
      suspendPayload: { toolCallId: 'tc-mode-b', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const { harness } = setupHarness({
      agents: { agentA, agentB },
      modes: [
        { id: 'modeA', agentId: 'agentA' },
        { id: 'modeB', agentId: 'agentB' },
      ],
      defaultModeId: 'modeA',
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const queued = session.queue({ content: 'use mode b', mode: 'modeB', admissionId: 'queue-mode-b-suspend' });
    await new Promise(resolve => setImmediate(resolve));

    expect(session.getRecord().pendingResume).toMatchObject({
      queuedItemId: expect.any(String),
      modeId: 'modeB',
    });
    expect(agentB.streamCalls).toHaveLength(1);
    expect(agentA.streamCalls).toHaveLength(0);

    agentB.enqueueRun({ finishReason: 'stop', runId: 'mode-b-run', text: 'done from mode b' });
    await session.respondToToolApproval({ approved: true });
    const result = await queued;

    expect(result.text).toBe('done from mode b');
    expect(agentB.resumeCalls).toHaveLength(1);
    expect(agentA.resumeCalls).toHaveLength(0);
    expect(session.getRecord().pendingResume).toBeUndefined();
    await session.close();
  });

  it('resumes a hydrated queued mode override from receipt mode when pendingResume has no mode', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-hydrated-queued-resume-mode-fallback';
    const queuedItemId = 'q-hydrated-queued-resume-mode-fallback';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-hydrated-queued-resume-mode-fallback',
        origin: 'top-level',
        ownsThread: false,
        modeId: 'modeA',
        modelId: 'default',
        subagentModelOverrides: {},
        permissionRules: { categories: {}, tools: {} },
        sessionGrants: { categories: [], tools: [] },
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        pendingQueue: [
          {
            id: queuedItemId,
            admissionId: 'queue-hydrated-resume-mode-fallback',
            admissionHash: 'hash-hydrated-resume-mode-fallback',
            enqueuedAt: now,
            content: 'resume mode b',
            attachments: [],
            mode: 'modeB',
          },
        ],
        pendingResume: {
          kind: 'tool-approval',
          itemId: 'tool-approval:tc-mode-b',
          runId: 'mode-b-run',
          toolCallId: 'tc-mode-b',
          toolName: 'shell',
          source: 'parent',
          requestedAt: now,
          queuedItemId,
          payload: { input: { cmd: 'echo ok' } },
        },
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-hydrated-resume-mode-fallback',
            admissionHash: 'hash-hydrated-resume-mode-fallback',
            queuedItemId,
            modeId: 'modeB',
            status: 'accepted',
            runId: 'mode-b-run',
            signalId: 'signal-mode-b',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const agentA = new MockAgent({ id: 'agentA' });
    const agentB = new MockAgent({ id: 'agentB' });
    agentB.enqueueRun({ finishReason: 'stop', runId: 'mode-b-run', text: 'resumed on mode b' });
    const replayHarness = new Harness({
      agents: { agentA, agentB } as any,
      storage,
      modes: [
        { id: 'modeA', agentId: 'agentA' },
        { id: 'modeB', agentId: 'agentB' },
      ],
      defaultModeId: 'modeA',
    });
    const replaySession = await replayHarness.session({ sessionId });

    const result = await replaySession.respondToToolApproval({ approved: true });

    expect(result.text).toBe('resumed on mode b');
    expect(agentB.resumeCalls).toHaveLength(1);
    expect(agentA.resumeCalls).toHaveLength(0);
    expect(replaySession.getRecord().pendingResume).toBeUndefined();
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'completed',
      modeId: 'modeB',
    });
  });

  it('does not fail a queued resume as stale while the local resume call is still running', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'r1',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const queued = session.queue({ content: 'sensitive', admissionId: 'queue-long-resume' });
    await new Promise(resolve => setImmediate(resolve));

    let release!: () => void;
    const holdUntil = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ finishReason: 'stop', runId: 'r1', text: 'done', holdUntil });
    const approving = session.respondToToolApproval({ approved: true });
    await new Promise(resolve => setImmediate(resolve));

    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingResume: {
        ...prev.pendingResume,
        resumedAt: Date.now() - 60_000,
      },
    }));

    await expect(session.respondToToolApproval({ approved: true })).rejects.toBeInstanceOf(HarnessValidationError);
    const inFlightReceipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(inFlightReceipt).not.toMatchObject({
      status: 'failed',
    });

    release();
    await approving;
    const result = await queued;
    expect(result.text).toBe('done');
    expect(session.getRecord().pendingQueue).toEqual([]);
    const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(receipt).toMatchObject({
      status: 'completed',
    });
    await session.close();
  });

  it('cleans up a completed queued resume receipt on hydration before the stale timeout', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-completed-resume-before-timeout';
    const queuedItemId = 'q-completed-resume-before-timeout';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-completed-resume-before-timeout',
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
            admissionId: 'queue-completed-resume-before-timeout',
            admissionHash: 'hash-completed-resume-before-timeout',
            enqueuedAt: now,
            content: 'already resumed',
            attachments: [],
            mode: 'default',
          },
        ],
        pendingResume: {
          kind: 'tool-approval',
          itemId: 'tc-completed',
          runId: 'completed-resume-run',
          toolCallId: 'tc-completed',
          toolName: 'shell',
          source: 'parent',
          requestedAt: now,
          queuedItemId,
          modeId: 'default',
          resumedAt: now,
          payload: { toolName: 'shell', args: { cmd: 'ls' } },
        },
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-completed-resume-before-timeout',
            admissionHash: 'hash-completed-resume-before-timeout',
            queuedItemId,
            modeId: 'default',
            status: 'completed',
            runId: 'completed-resume-run',
            signalId: 'completed-resume-signal',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            completedAt: now,
            updatedAt: now,
            result: { text: 'already done', finishReason: 'stop', runId: 'completed-resume-run' },
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const replayAgent = new MockAgent({ id: 'default' });
    replayAgent.enqueueRun({ finishReason: 'stop', text: 'must not run' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    const events: HarnessEvent[] = [];
    replayHarness.subscribe(e => events.push(e));

    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(replayAgent.streamCalls).toHaveLength(0);
    expect(replayAgent.resumeCalls).toHaveLength(0);
    expect(events.find(e => e.type === 'queue_item_started')).toBeUndefined();
    expect(events.find(e => e.type === 'queue_item_replayed')).toMatchObject({ queuedItemId });
    expect(events.find(e => e.type === 'agent_end')).toMatchObject({ queuedItemId });
    expect(replaySession.getRecord().pendingResume).toBeUndefined();
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'completed',
      postRunFinalizedAt: expect.any(Number),
      result: expect.objectContaining({ text: 'already done' }),
    });
  });

  it('returns a completed queued resume result on direct duplicate respond retry', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const queuedItemId = 'q-completed-resume-direct-retry';
    const now = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        {
          id: queuedItemId,
          admissionId: 'queue-completed-resume-direct-retry',
          admissionHash: 'hash-completed-resume-direct-retry',
          enqueuedAt: now,
          content: 'already resumed',
          attachments: [],
          mode: 'default',
        },
      ],
      pendingResume: {
        kind: 'tool-approval',
        itemId: 'tc-completed-direct',
        runId: 'completed-direct-run',
        toolCallId: 'tc-completed-direct',
        toolName: 'shell',
        source: 'parent',
        requestedAt: now,
        queuedItemId,
        modeId: 'default',
        resumedAt: now,
        payload: { input: { cmd: 'ls' } },
      },
      queueAdmissionReceipts: {
        [queuedItemId]: {
          admissionId: 'queue-completed-resume-direct-retry',
          admissionHash: 'hash-completed-resume-direct-retry',
          queuedItemId,
          modeId: 'default',
          status: 'completed',
          runId: 'completed-direct-run',
          signalId: 'completed-direct-signal',
          attempts: 1,
          enqueuedAt: now,
          acceptedAt: now,
          completedAt: now,
          updatedAt: now,
          result: { text: 'already done', finishReason: 'stop', runId: 'completed-direct-run' },
        },
      },
    }));

    const result = await session.respondToToolApproval({ approved: true });

    expect(result.text).toBe('already done');
    expect(agent.resumeCalls).toHaveLength(0);
    expect(session.getRecord().pendingResume).toBeUndefined();
    expect(session.getRecord().pendingQueue).toEqual([]);
    expect(session.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'completed',
      postRunFinalizedAt: expect.any(Number),
    });
    await session.close();
  });

  it('rejects a fresh responseId when queued resume recovery has no matching inbox receipt', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const queuedItemId = 'q-completed-resume-fresh-response';
    const now = Date.now();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        {
          id: queuedItemId,
          admissionId: 'queue-completed-resume-fresh-response',
          admissionHash: 'hash-completed-resume-fresh-response',
          enqueuedAt: now,
          content: 'already resumed',
          attachments: [],
          mode: 'default',
        },
      ],
      pendingResume: {
        kind: 'tool-approval',
        itemId: 'tc-completed-fresh',
        runId: 'completed-fresh-run',
        toolCallId: 'tc-completed-fresh',
        toolName: 'shell',
        source: 'parent',
        requestedAt: now,
        queuedItemId,
        modeId: 'default',
        resumedAt: now,
        payload: { input: { cmd: 'ls' } },
      },
      queueAdmissionReceipts: {
        [queuedItemId]: {
          admissionId: 'queue-completed-resume-fresh-response',
          admissionHash: 'hash-completed-resume-fresh-response',
          queuedItemId,
          modeId: 'default',
          status: 'completed',
          runId: 'completed-fresh-run',
          signalId: 'completed-fresh-signal',
          attempts: 1,
          enqueuedAt: now,
          acceptedAt: now,
          completedAt: now,
          updatedAt: now,
          result: { text: 'already done', finishReason: 'stop', runId: 'completed-fresh-run' },
        },
      },
    }));

    await expect(session.respondToToolApproval({ approved: true, responseId: 'fresh-response' })).rejects.toThrow(
      'pending resume already responded; no matching inbox response receipt exists',
    );

    expect(agent.resumeCalls).toHaveLength(0);
    expect(session.getRecord().inboxResponseReceipts?.['fresh-response']).toBeUndefined();
    await session.close();
  });

  it('does not apply accepted inbox receipts from a different completed queued item with the same runId', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const now = Date.now();
    const response = { approved: true };
    const responseHash = (session as any)._computeInboxResponseHash({
      kind: 'tool-approval',
      itemId: 'tc-target',
      runId: 'shared-run',
      pendingRequestedAt: now,
      response,
    });
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      inboxResponseReceipts: {
        target: {
          responseId: 'target',
          responseHash,
          resumeAttemptId: 'target',
          itemId: 'tc-target',
          queuedItemId: 'q-target',
          kind: 'tool-approval',
          runId: 'shared-run',
          toolCallId: 'tc-target',
          pendingRequestedAt: now,
          response,
          status: 'accepted',
          acceptedAt: now,
          updatedAt: now,
        },
      },
      queueAdmissionReceipts: {
        'q-other': {
          admissionId: 'queue-other',
          admissionHash: 'hash-other',
          queuedItemId: 'q-other',
          modeId: 'default',
          status: 'completed',
          runId: 'shared-run',
          signalId: 'other-signal',
          attempts: 1,
          enqueuedAt: now,
          acceptedAt: now,
          completedAt: now,
          updatedAt: now,
          result: { text: 'wrong queue item', finishReason: 'stop', runId: 'shared-run' },
        },
      },
    }));

    const duplicate = await session.respondToToolApproval({ approved: true, responseId: 'target' });

    expect(duplicate).toMatchObject({ status: 'accepted', duplicate: true, responseId: 'target' });
    expect(session.getRecord().inboxResponseReceipts?.target).toMatchObject({ status: 'accepted' });
    await session.close();
  });

  it('completes a rehydrated suspended queued item when respondTo* resumes it', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-rehydrated-queued-suspend';
    const queuedItemId = 'q-rehydrated-queued-suspend';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-rehydrated-queued-suspend',
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
            admissionId: 'queue-rehydrated-suspend',
            admissionHash: 'hash-rehydrated-suspend',
            enqueuedAt: now,
            content: 'resume me',
            attachments: [],
          },
        ],
        pendingResume: {
          kind: 'tool-approval',
          itemId: 'tool-approval:tc-1',
          runId: 'r1',
          toolCallId: 'tc-1',
          toolName: 'shell',
          source: 'parent',
          requestedAt: now,
          payload: { input: { cmd: 'echo ok' } },
        },
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-rehydrated-suspend',
            admissionHash: 'hash-rehydrated-suspend',
            queuedItemId,
            status: 'accepted',
            runId: 'r1',
            signalId: 'signal-1',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const replayAgent = new MockAgent({ id: 'default' });
    replayAgent.enqueueRun({ finishReason: 'stop', runId: 'r1', text: 'resumed done' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    const events: HarnessEvent[] = [];
    replayHarness.subscribe(e => events.push(e));
    const replaySession = await replayHarness.session({ sessionId });

    const result = await replaySession.respondToToolApproval({ approved: true });

    expect(result.text).toBe('resumed done');
    expect(events.find(e => e.type === 'suspension_resolved')).toMatchObject({ queuedItemId });
    expect(events.find(e => e.type === 'agent_end')).toMatchObject({ queuedItemId });
    expect(events.findIndex(e => e.type === 'agent_end')).toBeGreaterThan(
      events.findIndex(e => e.type === 'suspension_resolved'),
    );
    expect(replaySession.getRecord().pendingResume).toBeUndefined();
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'completed',
      result: expect.objectContaining({ text: 'resumed done' }),
    });
  });

  it('fails a stale rehydrated queued resume instead of stranding pendingResume', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-stale-queued-resume';
    const queuedItemId = 'q-stale-queued-resume';
    const now = Date.now();
    const staleAt = now - 31_000;
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-stale-queued-resume',
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
            admissionId: 'queue-stale-resume',
            admissionHash: 'hash-stale-resume',
            enqueuedAt: now,
            content: 'resume was in flight',
            attachments: [],
          },
        ],
        pendingResume: {
          kind: 'tool-approval',
          itemId: 'tool-approval:tc-1',
          runId: 'r1',
          toolCallId: 'tc-1',
          toolName: 'shell',
          source: 'parent',
          requestedAt: staleAt,
          resumedAt: staleAt,
          queuedItemId,
          payload: { input: { cmd: 'echo ok' } },
        },
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-stale-resume',
            admissionHash: 'hash-stale-resume',
            queuedItemId,
            status: 'accepted',
            runId: 'r1',
            signalId: 'signal-1',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const replayAgent = new MockAgent({ id: 'default' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    const events: HarnessEvent[] = [];
    replayHarness.subscribe(e => events.push(e));
    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(replayAgent.resumeCalls).toHaveLength(0);
    expect(events.find(e => e.type === 'queue_item_started')).toBeUndefined();
    expect(events.find(e => e.type === 'queue_item_replayed')).toMatchObject({ queuedItemId });
    expect(replaySession.getRecord().pendingResume).toBeUndefined();
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'failed',
      error: { code: 'harness.queue_resume_recovery_stale' },
    });
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
    expect(agent.streamCalls.map(c => extractSignalContents(c.messages))).toEqual(['manual call', 'queued call']);
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
    db.harnessSessions.set(`default\u0000${sessionId}`, {
      harnessName: 'default',
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

  it('replays an accepted receipt when no durable signal was persisted before hydration', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-accepted-replay';
    const queuedItemId = 'q-accepted';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-accepted-replay',
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
            admissionId: 'queue-accepted',
            admissionHash: 'hash-accepted',
            enqueuedAt: now,
            content: 'recover accepted',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-accepted',
            admissionHash: 'hash-accepted',
            queuedItemId,
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const replayAgent = new MockAgent({ id: 'default' });
    replayAgent.enqueueRun({ finishReason: 'stop', text: 'accepted recovered' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });

    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(replayAgent.streamCalls.map(c => extractSignalContents(c.messages))).toEqual(['recover accepted']);
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    const receipt = replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId];
    expect(receipt).toMatchObject({
      status: 'completed',
      result: expect.objectContaining({ text: 'accepted recovered' }),
    });
    expect(receipt?.runId).not.toBe('stale-run');
  });

  it('recovers an accepted receipt using its persisted mode after the session default mode changes', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-accepted-mode-drift';
    const queuedItemId = 'q-accepted-mode-drift';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-accepted-mode-drift',
        origin: 'top-level',
        ownsThread: false,
        modeId: 'other',
        modelId: 'default',
        subagentModelOverrides: {},
        permissionRules: { categories: {}, tools: {} },
        sessionGrants: { categories: [], tools: [] },
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        pendingQueue: [
          {
            id: queuedItemId,
            admissionId: 'queue-accepted-mode-drift',
            admissionHash: 'hash-accepted-mode-drift',
            enqueuedAt: now,
            content: 'recover on original mode',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-accepted-mode-drift',
            admissionHash: 'hash-accepted-mode-drift',
            queuedItemId,
            modeId: 'default',
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const defaultAgent = new MockAgent({ id: 'default' });
    const otherAgent = new MockAgent({ id: 'other' });
    defaultAgent.enqueueRun({ finishReason: 'stop', text: 'mode recovered' });
    const replayHarness = new Harness({
      agents: { default: defaultAgent, other: otherAgent } as any,
      storage,
      modes: [
        { id: 'default', agentId: 'default' },
        { id: 'other', agentId: 'other' },
      ],
      defaultModeId: 'other',
    });

    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(defaultAgent.streamCalls.map(c => extractSignalContents(c.messages))).toEqual(['recover on original mode']);
    expect(otherAgent.streamCalls).toHaveLength(0);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'completed',
      modeId: 'default',
      result: expect.objectContaining({ text: 'mode recovered' }),
    });
  });

  it('fails closed when replayed queued work references a missing mode', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-queued-missing-mode';
    const queuedItemId = 'q-queued-missing-mode';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-queued-missing-mode',
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
            admissionId: 'queue-missing-mode',
            admissionHash: 'hash-missing-mode',
            enqueuedAt: now,
            content: 'do not run',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-missing-mode',
            admissionHash: 'hash-missing-mode',
            queuedItemId,
            modeId: 'removed-mode',
            runtimeDependencies: { modeId: 'removed-mode', agentId: 'removed-agent', modelId: 'default' },
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const replayAgent = new MockAgent({ id: 'default' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });

    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(replayAgent.streamCalls).toHaveLength(0);
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'failed',
      error: {
        code: 'harness.runtime_dependency_drifted',
        message: expect.stringContaining('mode "removed-mode" is not registered'),
      },
    });
  });

  it('fails closed when a replayed queued receipt observes mode-to-agent binding drift', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-queued-agent-drift';
    const queuedItemId = 'q-queued-agent-drift';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-queued-agent-drift',
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
            admissionId: 'queue-agent-drift',
            admissionHash: 'hash-agent-drift',
            enqueuedAt: now,
            content: 'do not retarget',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-agent-drift',
            admissionHash: 'hash-agent-drift',
            queuedItemId,
            modeId: 'default',
            runtimeDependencies: { modeId: 'default', agentId: 'old-agent', modelId: 'default' },
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const newAgent = new MockAgent({ id: 'new-agent' });
    const replayHarness = new Harness({
      agents: { 'new-agent': newAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'new-agent' }],
      defaultModeId: 'default',
    });

    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(newAgent.streamCalls).toHaveLength(0);
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'failed',
      error: {
        code: 'harness.runtime_dependency_drifted',
        message: expect.stringContaining('old-agent'),
      },
    });
  });

  it('fails closed when queued work admitted without a workspace provider replays with one configured', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-queued-workspace-drift';
    const queuedItemId = 'q-queued-workspace-drift';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-queued-workspace-drift',
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
            admissionId: 'queue-workspace-drift',
            admissionHash: 'hash-workspace-drift',
            enqueuedAt: now,
            content: 'do not run with new workspace',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-workspace-drift',
            admissionHash: 'hash-workspace-drift',
            queuedItemId,
            modeId: 'default',
            runtimeDependencies: {
              modeId: 'default',
              agentId: 'default',
              modelId: 'default',
              workspaceProviderId: null,
            },
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const replayAgent = new MockAgent({ id: 'default' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      workspace: {
        kind: 'per-resource',
        provider: {
          providerId: 'workspace-now-configured',
          resumable: false,
          create: async () => ({}) as any,
        },
      },
    });

    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(replayAgent.streamCalls).toHaveLength(0);
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'failed',
      error: {
        code: 'harness.runtime_dependency_drifted',
        message: expect.stringContaining('workspace_provider "unconfigured"'),
      },
    });
  });

  it('fails closed when queued work admitted with a shared workspace replays after restart', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-queued-shared-workspace-drift';
    const queuedItemId = 'q-queued-shared-workspace-drift';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-queued-shared-workspace-drift',
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
            admissionId: 'queue-shared-workspace-drift',
            admissionHash: 'hash-shared-workspace-drift',
            enqueuedAt: now,
            content: 'do not run with a new shared workspace',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-shared-workspace-drift',
            admissionHash: 'hash-shared-workspace-drift',
            queuedItemId,
            modeId: 'default',
            runtimeDependencies: {
              modeId: 'default',
              agentId: 'default',
              modelId: 'default',
              workspaceProviderId: 'shared:harness-old-owner',
            },
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );

    const replayAgent = new MockAgent({ id: 'default' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      workspace: {
        kind: 'shared',
        workspace: { init: vi.fn(async () => {}), destroy: vi.fn(async () => {}) } as any,
      },
    });

    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(replayAgent.streamCalls).toHaveLength(0);
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'failed',
      error: {
        code: 'harness.runtime_dependency_drifted',
        message: expect.stringContaining('workspace_provider "shared:harness-old-owner"'),
      },
    });
  });

  it('replays an accepted receipt when pending signal evidence has no persisted memory signal', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-accepted-pending-without-memory';
    const queuedItemId = 'q-accepted-pending-without-memory';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-accepted-pending-without-memory',
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
            admissionId: 'queue-accepted-pending-without-memory',
            admissionHash: 'hash-accepted-pending-without-memory',
            enqueuedAt: now,
            content: 'recover pending without memory',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-accepted-pending-without-memory',
            admissionHash: 'hash-accepted-pending-without-memory',
            queuedItemId,
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );
    await harnessStore.writeMessageResultEvidence({
      harnessName: 'default',
      sessionId,
      resourceId: 'u',
      threadId: 't-accepted-pending-without-memory',
      signalId: 'stale-signal',
      runId: 'stale-run',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    const replayAgent = new MockAgent({ id: 'default' });
    replayAgent.enqueueRun({ finishReason: 'stop', text: 'pending recovered' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });

    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(replayAgent.streamCalls.map(c => extractSignalContents(c.messages))).toEqual([
      'recover pending without memory',
    ]);
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    const receipt = replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId];
    expect(receipt).toMatchObject({
      status: 'completed',
      result: expect.objectContaining({ text: 'pending recovered' }),
    });
    expect(receipt?.signalId).not.toBe('stale-signal');
  });

  it('completes an accepted receipt from durable signal result evidence after hydration even if runtime deps drifted', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    if (!harnessStore) throw new Error('expected harness storage');
    const sessionId = 'sess-accepted-signal-result';
    const queuedItemId = 'q-accepted-signal-result';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-accepted-signal-result',
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
            admissionId: 'queue-accepted-signal-result',
            admissionHash: 'hash-accepted-signal-result',
            enqueuedAt: now,
            content: 'already reconciled',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-accepted-signal-result',
            admissionHash: 'hash-accepted-signal-result',
            queuedItemId,
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            runtimeDependencies: { modeId: 'default', agentId: 'old-agent', modelId: 'default' },
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            postRunFinalizedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );
    await harnessStore.writeMessageResultEvidence({
      harnessName: 'default',
      sessionId,
      resourceId: 'u',
      threadId: 't-accepted-signal-result',
      signalId: 'stale-signal',
      runId: 'stale-run',
      status: 'completed',
      result: { text: 'durable full result', finishReason: 'stop', runId: 'stale-run' },
      createdAt: now,
      updatedAt: now,
    });

    const replayAgent = new MockAgent({ id: 'new-agent' });
    replayAgent.enqueueRun({ finishReason: 'stop', text: 'must not run' });
    const replayHarness = new Harness({
      agents: { 'new-agent': replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'new-agent' }],
      defaultModeId: 'default',
    });

    const events: HarnessEvent[] = [];
    replayHarness.subscribe(e => events.push(e));
    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(replayAgent.streamCalls).toHaveLength(0);
    expect(events.some(e => e.type === 'agent_end')).toBe(false);
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'completed',
      runId: 'stale-run',
      signalId: 'stale-signal',
      postRunFinalizedAt: now,
      result: expect.objectContaining({ text: 'durable full result' }),
    });
  });

  it('parks an accepted receipt once the signal is visible without live result evidence', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    const memory = await storage.getStore('memory');
    if (!harnessStore || !memory) throw new Error('expected harness and memory storage');
    const sessionId = 'sess-accepted-incomplete';
    const queuedItemId = 'q-accepted-incomplete';
    const now = Date.now();
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-accepted-incomplete',
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
            admissionId: 'queue-accepted-incomplete',
            admissionHash: 'hash-accepted-incomplete',
            enqueuedAt: now,
            content: 'do not replay accepted',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-accepted-incomplete',
            admissionHash: 'hash-accepted-incomplete',
            queuedItemId,
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
        state: undefined,
        createdAt: now,
        lastActivityAt: now,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );
    await memory.saveMessages({
      messages: [
        {
          id: 'stale-signal',
          role: 'user',
          threadId: 't-accepted-incomplete',
          resourceId: 'u',
          createdAt: new Date(now),
          content: { format: 2, parts: [{ type: 'text', text: 'do not replay accepted' }] },
        } as any,
        {
          id: 'assistant-result',
          role: 'assistant',
          threadId: 't-accepted-incomplete',
          resourceId: 'u',
          createdAt: new Date(now + 1),
          content: { format: 2, parts: [{ type: 'text', text: 'durable but not full result evidence' }] },
        } as any,
      ],
    });

    const replayAgent = new MockAgent({ id: 'default' });
    replayAgent.enqueueRun({ finishReason: 'stop', text: 'must not run' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });

    const events: HarnessEvent[] = [];
    replayHarness.subscribe(e => events.push(e));
    const replaySession = await replayHarness.session({ sessionId });
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    expect(replayAgent.streamCalls).toHaveLength(0);
    expect(events.some(e => e.type === 'queue_item_replayed')).toBe(true);
    expect(replaySession.getRecord().pendingQueue).toMatchObject([{ id: queuedItemId }]);
    expect(replaySession.isBusy()).toBe(true);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'accepted',
      runId: 'stale-run',
      signalId: 'stale-signal',
    });
  });

  it('fails a stale accepted receipt when no live run or durable result evidence is available', async () => {
    const storage = new InMemoryStore();
    const harnessStore = await storage.getStore('harness');
    const memory = await storage.getStore('memory');
    if (!harnessStore || !memory) throw new Error('expected harness and memory storage');
    const sessionId = 'sess-accepted-stale';
    const queuedItemId = 'q-accepted-stale';
    const now = Date.now();
    const staleAt = now - 60_000;
    await harnessStore.saveSession(
      {
        harnessName: 'default',
        id: sessionId,
        resourceId: 'u',
        threadId: 't-accepted-stale',
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
            admissionId: 'queue-accepted-stale',
            admissionHash: 'hash-accepted-stale',
            enqueuedAt: staleAt,
            content: 'stale accepted',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          [queuedItemId]: {
            admissionId: 'queue-accepted-stale',
            admissionHash: 'hash-accepted-stale',
            queuedItemId,
            status: 'accepted',
            runId: 'stale-run',
            signalId: 'stale-signal',
            attempts: 1,
            enqueuedAt: staleAt,
            acceptedAt: staleAt,
            updatedAt: staleAt,
          },
        },
        state: undefined,
        createdAt: staleAt,
        lastActivityAt: staleAt,
        version: 0,
      },
      { harnessName: 'default', ifVersion: 0 },
    );
    await memory.saveMessages({
      messages: [
        {
          id: 'stale-signal',
          role: 'signal',
          threadId: 't-accepted-stale',
          resourceId: 'u',
          createdAt: new Date(staleAt),
          content: { format: 2, parts: [{ type: 'text', text: 'stale accepted' }] },
        } as any,
      ],
    });

    const replayAgent = new MockAgent({ id: 'default' });
    replayAgent.enqueueRun({ finishReason: 'stop', text: 'must not run' });
    const replayHarness = new Harness({
      agents: { default: replayAgent } as any,
      storage,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });

    const replaySession = await replayHarness.session({ sessionId });
    await replaySession.waitForIdle({ timeoutMs: 1000 });

    expect(replayAgent.streamCalls).toHaveLength(0);
    expect(replaySession.getRecord().pendingQueue).toEqual([]);
    expect(replaySession.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
      status: 'failed',
      runId: 'stale-run',
      signalId: 'stale-signal',
      error: { code: 'harness.queue_recovery_stale' },
    });
  });
});
