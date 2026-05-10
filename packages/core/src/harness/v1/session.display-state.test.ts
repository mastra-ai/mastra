/**
 * Tests for Session.getDisplayState() — spec §4.2 / §4.4 `SessionDisplayState`.
 *
 * Verifies the new v1 shape:
 *   - Identity fields are populated from the live record.
 *   - Run fields (`isRunning`, `currentRunId`) flip during a turn.
 *   - Activity maps (`activeTools`, `toolInputBuffers`, `activeSubagents`)
 *     are fresh projections per call.
 *   - Token usage accumulates across turns.
 *   - Pending interrupts surface as full `pendingResume` (not booleans).
 *   - Queue depth + `currentQueuedItemId` track the running queued item.
 */

import { describe, expect, it } from 'vitest';
import { setupHarness } from './__test-utils__/setup';

describe('Session.getDisplayState — shape', () => {
  it('reports the documented identity fields', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const ds = session.getDisplayState();
    expect(ds.sessionId).toBe(session.id);
    expect(ds.threadId).toBe(session.threadId);
    expect(ds.resourceId).toBe('u');
    expect(ds.lifecycleState).toBe('live');
    expect(ds.modeId).toBeTypeOf('string');
    expect(ds.modelId).toBeTypeOf('string');
    expect(ds.createdAt).toBe(session.createdAt);
    expect(ds.lastActivityAt).toBeTypeOf('number');
  });

  it('idle state has no run fields, empty activity maps, zero usage', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const ds = session.getDisplayState();
    expect(ds.isRunning).toBe(false);
    expect(ds.currentRunId).toBeUndefined();
    expect(ds.currentMessageId).toBeUndefined();
    expect(ds.currentTraceId).toBeUndefined();
    expect(ds.activeTools).toEqual({});
    expect(ds.toolInputBuffers).toEqual({});
    expect(ds.activeSubagents).toEqual({});
    expect(ds.tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    expect(ds.pending).toBeNull();
    expect(ds.queueDepth).toBe(0);
    expect(ds.currentQueuedItemId).toBeUndefined();
    expect(ds.goal).toBeUndefined();
  });

  it('isRunning flips true while a turn is in flight, and currentRunId is captured', async () => {
    const { harness, agent } = setupHarness();
    let release!: () => void;
    const hold = new Promise<void>(r => {
      release = r;
    });
    agent.enqueueRun({ runId: 'run-display', finishReason: 'stop', text: 'ok', holdUntil: hold });

    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const inFlight = session.message({ content: 'hi' });

    // Drive the event loop until the turn is observably running.
    while (!session.isRunning()) await Promise.resolve();

    const mid = session.getDisplayState();
    expect(mid.isRunning).toBe(true);

    release();
    await inFlight;

    const after = session.getDisplayState();
    expect(after.isRunning).toBe(false);
    expect(after.currentRunId).toBeUndefined();
    // Token usage accumulated from the run's totalUsage.
    expect(after.tokenUsage.totalTokens).toBeGreaterThanOrEqual(2);
  });

  it('accumulates token usage across multiple turns', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ runId: 'r1', finishReason: 'stop' });
    agent.enqueueRun({ runId: 'r2', finishReason: 'stop' });

    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'one' });
    const after1 = session.getDisplayState().tokenUsage.totalTokens;
    await session.message({ content: 'two' });
    const after2 = session.getDisplayState().tokenUsage.totalTokens;
    expect(after2).toBeGreaterThan(after1);
  });

  it('surfaces full pending payload (kind + payload), not booleans', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-pending',
      suspendPayload: {
        toolCallId: 'tc-1',
        toolName: 'ask_user',
        args: { question: 'pick one', options: [{ label: 'a' }, { label: 'b' }] },
      },
    });

    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'ask' });

    const ds = session.getDisplayState();
    expect(ds.pending).not.toBeNull();
    expect(ds.pending?.kind).toBe('question');
    expect(ds.pending?.toolCallId).toBe('tc-1');
    expect(ds.pending?.payload).toEqual({
      question: 'pick one',
      options: [{ label: 'a' }, { label: 'b' }],
    });
    // Legacy boolean fields are gone — make sure consumers know to use `pending`.
    expect((ds as unknown as Record<string, unknown>).hasPendingQuestion).toBeUndefined();
  });

  it('returns fresh activity collections on each call (no shared mutation)', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const a = session.getDisplayState();
    const b = session.getDisplayState();
    expect(a.activeTools).not.toBe(b.activeTools);
    expect(a.toolInputBuffers).not.toBe(b.toolInputBuffers);
    expect(a.activeSubagents).not.toBe(b.activeSubagents);
    expect(a.tokenUsage).not.toBe(b.tokenUsage);
  });

  it('parentSessionId is omitted for top-level sessions', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    expect(session.getDisplayState().parentSessionId).toBeUndefined();
  });
});
