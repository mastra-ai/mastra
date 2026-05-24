/**
 * Tests for `Session.getTokenUsage()` durability.
 *
 * Three regressions guarded here:
 *   1. Rehydration: a fresh `Session` instance built from a persisted record
 *      seeds `_tokenUsage` from `SessionRecord.tokenUsage`, so a process
 *      restart / eviction does not reset the cumulative counter to zero.
 *   2. Persistence: increments accumulated during a turn flow into the next
 *      `saveSession` write via the `_flushUpdate` overlay, with no setter
 *      having to thread `tokenUsage` through its closure.
 *   3. `totalTokens` derivation: providers that only emit
 *      `inputTokens`/`outputTokens` still produce a consistent
 *      `totalTokens` aggregate.
 */

import { describe, expect, it, vi } from 'vitest';

import type { SessionRecord } from '../../storage/domains/harness/types';
import type { FullOutput } from '../../stream/base/output';
import { setupHarness } from './__test-utils__/setup';
import type { Session } from './session';

interface TokenUsageInternals {
  _tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  _recordTurnCompletion(
    full: FullOutput<unknown>,
  ): { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
  _recordMessageTurnCompletion(
    full: FullOutput<unknown>,
    opts?: { persist?: boolean },
  ): {
    tokenUsageDelta?: { promptTokens: number; completionTokens: number; totalTokens: number };
    tokenUsageAccounted: boolean;
  };
}

type LegacyMissingTokenUsageRecord = Omit<SessionRecord, 'tokenUsage'> & { tokenUsage?: undefined };

function asInternals(session: Session): TokenUsageInternals {
  return session as unknown as TokenUsageInternals;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('Session token usage — durability', () => {
  it('seeds the live counter from the persisted record on construction', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ runId: 'r1', finishReason: 'stop' });

    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'one' });

    // MockAgent emits `{ inputTokens: 1, outputTokens: 1, totalTokens: 2 }` per
    // run, so after one turn the live counter and the persisted record agree.
    const before = session.getTokenUsage();
    expect(before.promptTokens).toBeGreaterThan(0);
    expect(before.completionTokens).toBeGreaterThan(0);
    expect(before.totalTokens).toBeGreaterThanOrEqual(before.promptTokens + before.completionTokens);

    const persisted = session.getRecord().tokenUsage;
    expect(persisted).toEqual(before);
  });

  it('derives missing persisted totals from legacy prompt and completion counters', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: 't-legacy-partial-usage' });
    const record = session.getRecord();
    await storage.saveSession(
      {
        ...record,
        tokenUsage: { promptTokens: 3, completionTokens: 4 } as SessionRecord['tokenUsage'],
      },
      { harnessName: record.harnessName, ownerId: harness.ownerId, ifVersion: record.version },
    );

    await harness.shutdown();
    const { harness: harness2 } = setupHarness({ sessions: { storage } });
    const rehydrated = await harness2.session({ resourceId: 'u', threadId: 't-legacy-partial-usage' });

    expect(rehydrated.getTokenUsage()).toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 });
  });

  it('repairs stale zero persisted totals when prompt and completion counters are present', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: 't-legacy-zero-total-usage' });
    const record = session.getRecord();
    await storage.saveSession(
      {
        ...record,
        tokenUsage: { promptTokens: 5, completionTokens: 6, totalTokens: 0 },
      },
      { harnessName: record.harnessName, ownerId: harness.ownerId, ifVersion: record.version },
    );

    await harness.shutdown();
    const { harness: harness2 } = setupHarness({ sessions: { storage } });
    const rehydrated = await harness2.session({ resourceId: 'u', threadId: 't-legacy-zero-total-usage' });

    expect(rehydrated.getTokenUsage()).toEqual({ promptTokens: 5, completionTokens: 6, totalTokens: 11 });
  });

  it('repairs stale low persisted totals when prompt and completion counters are present', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: 't-legacy-low-total-usage' });
    const record = session.getRecord();
    await storage.saveSession(
      {
        ...record,
        tokenUsage: { promptTokens: 5, completionTokens: 6, totalTokens: 7 },
      },
      { harnessName: record.harnessName, ownerId: harness.ownerId, ifVersion: record.version },
    );

    await harness.shutdown();
    const { harness: harness2 } = setupHarness({ sessions: { storage } });
    const rehydrated = await harness2.session({ resourceId: 'u', threadId: 't-legacy-low-total-usage' });

    expect(rehydrated.getTokenUsage()).toEqual({ promptTokens: 5, completionTokens: 6, totalTokens: 11 });
  });

  it('ignores non-finite persisted counters during rehydration', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: 't-legacy-non-finite-usage' });
    const record = session.getRecord();
    await storage.saveSession(
      {
        ...record,
        tokenUsage: {
          promptTokens: Number.NaN,
          completionTokens: Number.POSITIVE_INFINITY,
          totalTokens: Number.NEGATIVE_INFINITY,
        },
      },
      { harnessName: record.harnessName, ownerId: harness.ownerId, ifVersion: record.version },
    );

    await harness.shutdown();
    const { harness: harness2 } = setupHarness({ sessions: { storage } });
    const rehydrated = await harness2.session({ resourceId: 'u', threadId: 't-legacy-non-finite-usage' });

    expect(rehydrated.getTokenUsage()).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('ignores negative and fractional persisted counters during rehydration', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: 't-legacy-invalid-usage' });
    const record = session.getRecord();
    await storage.saveSession(
      {
        ...record,
        tokenUsage: {
          promptTokens: -1,
          completionTokens: 1.5,
          totalTokens: -2,
        },
      },
      { harnessName: record.harnessName, ownerId: harness.ownerId, ifVersion: record.version },
    );

    await harness.shutdown();
    const { harness: harness2 } = setupHarness({ sessions: { storage } });
    const rehydrated = await harness2.session({ resourceId: 'u', threadId: 't-legacy-invalid-usage' });

    expect(rehydrated.getTokenUsage()).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('persists counters across rehydration via a new Harness instance', async () => {
    const { harness, agent, storage } = setupHarness();
    agent.enqueueRuns([
      { runId: 'r1', finishReason: 'stop' },
      { runId: 'r2', finishReason: 'stop' },
    ]);

    const original = await harness.session({ threadId: 't-token', resourceId: 'u' });
    const originalId = original.id;
    await original.message({ content: 'one' });
    await original.message({ content: 'two' });
    const before = original.getTokenUsage();
    expect(before.totalTokens).toBeGreaterThan(0);

    // Simulate a process restart: shut down the live harness (releases the
    // session lease) and resolve the same `(threadId, resourceId)` against a
    // fresh harness pointed at the same storage.
    await harness.shutdown();
    const { harness: harness2 } = setupHarness({ sessions: { storage } });
    const rehydrated = await harness2.session({ threadId: 't-token', resourceId: 'u' });
    expect(rehydrated.id).toBe(originalId);
    expect(rehydrated).not.toBe(original);
    expect(rehydrated.getTokenUsage()).toEqual(before);
  });

  it('persists cached duplicate message token usage before completed evidence without double-counting', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const full = {
      text: 'cached duplicate',
      finishReason: 'stop',
      runId: 'duplicate-token-run',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    } as unknown as FullOutput<unknown>;
    const evidenceTokenUsage: Array<SessionRecord['tokenUsage']> = [];
    const writeMessageResultEvidence = storage.writeMessageResultEvidence.bind(storage);
    vi.spyOn(storage, 'writeMessageResultEvidence').mockImplementation(async record => {
      if (record.admissionId === 'duplicate-token-race' && record.status === 'completed') {
        evidenceTokenUsage.push(session.getRecord().tokenUsage);
      }
      return writeMessageResultEvidence(record);
    });
    (session as unknown as { _completedRuns: Map<string, { ok: true; full: FullOutput<unknown> }> })._completedRuns.set(
      'duplicate-token-run',
      { ok: true, full },
    );
    expect(session.getDisplayState().currentRunId).toBeUndefined();

    const duplicate = await (session as unknown as {
      _returnDuplicateMessageResult(evidence: unknown, opts: unknown): Promise<unknown>;
    })._returnDuplicateMessageResult(
      {
        status: 'pending',
        signalId: 'duplicate-token-signal',
        runId: 'duplicate-token-run',
        admissionId: 'duplicate-token-race',
        admissionHash: 'duplicate-token-hash',
      },
      { content: 'hi' },
    );

    expect(duplicate).toBe(full);
    expect(evidenceTokenUsage).toEqual([{ promptTokens: 1, completionTokens: 1, totalTokens: 2 }]);
    expect(session.getTokenUsage()).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
    expect(session.getDisplayState().currentRunId).toBeUndefined();
    asInternals(session)._recordMessageTurnCompletion(full, { persist: false });
    expect(session.getTokenUsage()).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });

  it('persists cached suspended duplicate message token usage and pending resume before completed evidence', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const full = {
      text: 'cached suspended duplicate',
      finishReason: 'suspended',
      runId: 'duplicate-suspend-token-run',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      suspendPayload: { toolCallId: 'tc-duplicate-suspend', toolName: 'shell', args: { cmd: 'ls' } },
    } as unknown as FullOutput<unknown>;
    const completedEvidenceSnapshots: Array<{
      tokenUsage: SessionRecord['tokenUsage'];
      pendingToolCallId?: string;
      modeId?: string;
      modelId?: string;
    }> = [];
    const defaultModeId = session.getRecord().modeId;
    const writeMessageResultEvidence = storage.writeMessageResultEvidence.bind(storage);
    vi.spyOn(storage, 'writeMessageResultEvidence').mockImplementation(async record => {
      if (record.admissionId === 'duplicate-suspend-token-race' && record.status === 'completed') {
        completedEvidenceSnapshots.push({
          tokenUsage: session.getRecord().tokenUsage,
          pendingToolCallId: session.getRecord().pendingResume?.toolCallId,
          modeId: record.modeId,
          modelId: record.modelId,
        });
      }
      return writeMessageResultEvidence(record);
    });
    (session as unknown as { _completedRuns: Map<string, { ok: true; full: FullOutput<unknown> }> })._completedRuns.set(
      'duplicate-suspend-token-run',
      { ok: true, full },
    );
    const evidence = {
      status: 'pending',
      signalId: 'duplicate-suspend-token-signal',
      runId: 'duplicate-suspend-token-run',
      admissionId: 'duplicate-suspend-token-race',
      admissionHash: 'duplicate-suspend-token-hash',
    };

    const duplicate = await (session as unknown as {
      _returnDuplicateMessageResult(evidence: unknown, opts: unknown): Promise<unknown>;
    })._returnDuplicateMessageResult(evidence, { content: 'hi', model: 'duplicate-dispatched-model' });

    expect(duplicate).toBe(full);
    expect(completedEvidenceSnapshots).toEqual([
      {
        tokenUsage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        pendingToolCallId: 'tc-duplicate-suspend',
        modeId: defaultModeId,
        modelId: 'duplicate-dispatched-model',
      },
    ]);
    expect(session.getTokenUsage()).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-duplicate-suspend');
    expect(session.getRecord().pendingResume?.runtimeDependencies?.modelId).toBe('duplicate-dispatched-model');
    expect(session.getDisplayState().currentRunId).toBeUndefined();

    const replay = await (session as unknown as {
      _returnDuplicateMessageResult(evidence: unknown, opts: unknown): Promise<unknown>;
    })._returnDuplicateMessageResult(evidence, { content: 'hi', model: 'duplicate-dispatched-model' });
    expect(replay).toBe(full);
    expect(session.getTokenUsage()).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });

  it('retries suspended duplicate message token accounting when an in-flight owner rolls back', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const full = {
      text: 'cached suspended duplicate retry',
      finishReason: 'suspended',
      runId: 'duplicate-suspend-token-retry-run',
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
      totalUsage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
      suspendPayload: { toolCallId: 'tc-duplicate-suspend-retry', toolName: 'shell', args: { cmd: 'ls' } },
    } as unknown as FullOutput<unknown>;
    const saveSession = storage.saveSession.bind(storage);
    const firstSave = deferred();
    let pendingResumeSaveCount = 0;
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      if (record.pendingResume?.toolCallId === 'tc-duplicate-suspend-retry') {
        pendingResumeSaveCount += 1;
        if (pendingResumeSaveCount === 1) {
          await firstSave.promise;
          throw new Error('first duplicate suspend persist failed');
        }
      }
      return saveSession(record, opts);
    });

    const capture = (session as unknown as {
      _captureMessageSuspendWithTokenUsage(
        full: FullOutput<unknown>,
        queuedItemId: string | undefined,
        modeId: string,
        modelId: string,
      ): Promise<void>;
    })._captureMessageSuspendWithTokenUsage.bind(session);
    const first = capture(full, undefined, session.getRecord().modeId, session.getRecord().modelId);
    await vi.waitFor(() => expect(pendingResumeSaveCount).toBe(1));
    const second = capture(full, undefined, session.getRecord().modeId, session.getRecord().modelId);

    firstSave.resolve();
    await expect(first).rejects.toThrow('first duplicate suspend persist failed');
    await expect(second).resolves.toBeUndefined();

    expect(pendingResumeSaveCount).toBe(2);
    expect(session.getTokenUsage()).toEqual({ promptTokens: 2, completionTokens: 3, totalTokens: 5 });
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-duplicate-suspend-retry');
  });

  it('persists queued-turn token usage in the same write as the no-replay marker', async () => {
    // Regression guard for the ordering bug surfaced during review:
    // `_finalizeCompletedQueuedTurn` previously wrote `postRunFinalizedAt`
    // before accounting tokens, so a crash between marker and accumulator
    // would resume with the marker set and never re-record the turn's usage.
    const { harness, agent } = setupHarness();
    agent.enqueueRun({ runId: 'q1', finishReason: 'stop' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.queue({ content: 'queued' });
    const persisted = session.getRecord().tokenUsage;
    const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(receipt?.postRunFinalizedAt).toBeDefined();
    expect(persisted.totalTokens).toBeGreaterThan(0);
    expect(session.getTokenUsage()).toEqual(persisted);
  });

  it('does not write queued-turn token usage before the no-replay marker', async () => {
    const { harness, agent, storage } = setupHarness();
    const writes: SessionRecord[] = [];
    const saveSession = storage.saveSession.bind(storage);
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      writes.push(JSON.parse(JSON.stringify(record)) as SessionRecord);
      return saveSession(record, opts);
    });

    agent.enqueueRun({ runId: 'q-no-token-gap', finishReason: 'stop' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.queue({ content: 'queued' });

    const receiptId = Object.keys(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(receiptId).toBeDefined();
    const tokenOnlyWrites = writes.filter(record => {
      if ((record.tokenUsage?.totalTokens ?? 0) <= 0) return false;
      const receipt = record.queueAdmissionReceipts?.[receiptId!];
      return receipt !== undefined && receipt.postRunFinalizedAt === undefined;
    });
    expect(tokenOnlyWrites).toEqual([]);
    expect(
      writes.some(record => {
        const receipt = record.queueAdmissionReceipts?.[receiptId!];
        return (record.tokenUsage?.totalTokens ?? 0) > 0 && receipt?.postRunFinalizedAt !== undefined;
      }),
    ).toBe(true);
  });

  it('rolls back queued-turn token usage when the no-replay marker write retries', async () => {
    vi.useFakeTimers();
    try {
      const { harness, agent, storage } = setupHarness();
      const saveSession = storage.saveSession.bind(storage);
      let failedMarkerOnce = false;
      vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
        const receipt = Object.values(record.queueAdmissionReceipts ?? {})[0];
        if (
          !failedMarkerOnce &&
          receipt?.postRunFinalizedAt !== undefined &&
          (record.tokenUsage?.totalTokens ?? 0) > 0
        ) {
          failedMarkerOnce = true;
          throw new Error('marker write failed once');
        }
        return saveSession(record, opts);
      });

      agent.enqueueRun({ runId: 'q-marker-retry', finishReason: 'stop' });
      const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
      const queued = session.queue({ content: 'queued' });

      for (let i = 0; i < 10 && !failedMarkerOnce; i += 1) {
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(failedMarkerOnce).toBe(true);
      expect(session.getTokenUsage()).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

      await vi.advanceTimersByTimeAsync(1_001);
      await queued;

      expect(session.getTokenUsage()).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
      const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0];
      expect(receipt?.postRunFinalizedAt).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists admitted message token usage before completed result evidence', async () => {
    const { harness, agent, storage } = setupHarness();
    const events: string[] = [];
    const saveSession = storage.saveSession.bind(storage);
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      if ((record.tokenUsage?.totalTokens ?? 0) > 0) events.push('token-save');
      return saveSession(record, opts);
    });
    const writeEvidence = storage.writeMessageResultEvidence.bind(storage);
    vi.spyOn(storage, 'writeMessageResultEvidence').mockImplementation(async record => {
      if (record.status === 'completed') events.push('completed-evidence');
      return writeEvidence(record);
    });

    agent.enqueueRun({ runId: 'msg-token-order', finishReason: 'stop' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'one', admissionId: 'msg-token-order' });

    expect(events).toContain('token-save');
    expect(events).toContain('completed-evidence');
    expect(events.indexOf('token-save')).toBeLessThan(events.indexOf('completed-evidence'));
  });

  it('writes failed evidence when admitted stream token persistence fails before completion evidence', async () => {
    const { harness, agent, storage } = setupHarness();
    const evidenceStatuses: string[] = [];
    const saveSession = storage.saveSession.bind(storage);
    let failedTokenSave = false;
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      if (!failedTokenSave && (record.tokenUsage?.totalTokens ?? 0) > 0) {
        failedTokenSave = true;
        throw new Error('token persist failed');
      }
      return saveSession(record, opts);
    });
    const writeEvidence = storage.writeMessageResultEvidence.bind(storage);
    vi.spyOn(storage, 'writeMessageResultEvidence').mockImplementation(async record => {
      if (record.admissionId === 'stream-token-persist-failure') evidenceStatuses.push(record.status);
      return writeEvidence(record);
    });

    agent.enqueueRun({ runId: 'stream-token-persist-failure', finishReason: 'stop' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const stream = await session.message({
      content: 'one',
      admissionId: 'stream-token-persist-failure',
      stream: true,
    });
    await (stream as { getFullOutput(): Promise<FullOutput<unknown>> }).getFullOutput();
    await session.waitForIdle({ timeoutMs: 1_000 });

    expect(failedTokenSave).toBe(true);
    expect(evidenceStatuses).toContain('pending');
    expect(evidenceStatuses).toContain('failed');
    expect(evidenceStatuses).not.toContain('completed');
  });

  it('does not release the lease when suspended stream parking fails before pending resume persists', async () => {
    const { harness, agent, storage } = setupHarness();
    const releaseSessionLease = vi.spyOn(storage, 'releaseSessionLease');
    const saveSession = storage.saveSession.bind(storage);
    let failedPendingResumeSave = false;
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      if (!failedPendingResumeSave && record.pendingResume?.toolCallId === 'tc-stream-suspend-persist-failure') {
        failedPendingResumeSave = true;
        throw new Error('stream suspend persist failed');
      }
      return saveSession(record, opts);
    });

    const suspendedFull = {
      runId: 'stream-suspend-persist-failure',
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-stream-suspend-persist-failure', toolName: 'shell', args: { cmd: 'ls' } },
    } as unknown as FullOutput<unknown>;
    agent.enqueueRun(suspendedFull);
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const stream = await session.message({ content: 'suspend', stream: true });
    await (stream as { getFullOutput(): Promise<FullOutput<unknown>> }).getFullOutput();
    await session.waitForIdle({ timeoutMs: 1_000 });

    expect(failedPendingResumeSave).toBe(true);
    expect(session.getRecord().pendingResume).toBeUndefined();
    await expect(harness.shutdown()).rejects.toMatchObject({
      name: 'HarnessStorageError',
      cause: expect.objectContaining({ message: 'stream suspend persist failed' }),
    });
    expect(releaseSessionLease).not.toHaveBeenCalled();

    await (session as unknown as {
      _captureMessageSuspendWithTokenUsage(
        full: FullOutput<unknown>,
        queuedItemId: string | undefined,
        modeId: string,
        modelId: string,
      ): Promise<void>;
    })._captureMessageSuspendWithTokenUsage(suspendedFull, undefined, session.getRecord().modeId, session.getRecord().modelId);
    await expect(harness.shutdown()).resolves.toBeUndefined();
    expect(releaseSessionLease).toHaveBeenCalledTimes(1);
  });

  it('does not clear a durable-turn latch for an unrelated pending resume', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const pending = {
      kind: 'tool-approval',
      itemId: 'tool-approval:tc-existing',
      runId: 'existing-run',
      toolCallId: 'tc-existing',
      toolName: 'shell',
      source: 'parent',
      requestedAt: Date.now(),
    } satisfies NonNullable<SessionRecord['pendingResume']>;
    (session as unknown as { _record: SessionRecord })._record = {
      ...session.getRecord(),
      pendingResume: pending,
    };
    (session as unknown as {
      _pendingDurableTurnFlushError?: { error: unknown; pendingResume?: { runId: string; toolCallId: string } };
    })._pendingDurableTurnFlushError = {
      error: new Error('different suspend persist failed'),
      pendingResume: { runId: 'latched-run', toolCallId: 'tc-latched' },
    };

    await (session as unknown as {
      _maybeCaptureSuspend(
        full: FullOutput<unknown>,
        queuedItemId: string | undefined,
        modeId: string,
        modelId: string,
      ): Promise<void>;
    })._maybeCaptureSuspend(
      {
        finishReason: 'suspended',
        runId: 'unrelated-run',
        suspendPayload: { toolCallId: 'tc-unrelated', toolName: 'shell', args: { cmd: 'pwd' } },
      } as unknown as FullOutput<unknown>,
      undefined,
      session.getRecord().modeId,
      session.getRecord().modelId,
    );
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-unrelated');
    await expect(
      (session as unknown as { _internalAwaitFlushChain(): Promise<void> })._internalAwaitFlushChain(),
    ).rejects.toThrow('different suspend persist failed');

    (session as unknown as { _record: SessionRecord })._record = {
      ...session.getRecord(),
      pendingResume: { ...pending, runId: 'latched-run', toolCallId: 'tc-latched' },
    };
    await expect(
      (session as unknown as { _internalAwaitFlushChain(): Promise<void> })._internalAwaitFlushChain(),
    ).resolves.toBeUndefined();
  });

  it('clears an unkeyed durable-turn latch after token usage is repaired', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    asInternals(session)._tokenUsage = { promptTokens: 1, completionTokens: 2, totalTokens: 3 };
    (session as unknown as {
      _pendingDurableTurnFlushError?: { error: unknown; pendingResume?: { runId: string; toolCallId: string } };
    })._pendingDurableTurnFlushError = {
      error: new Error('unkeyed durable persist failed'),
    };

    await (session as unknown as { _persistTokenUsage(): Promise<void> })._persistTokenUsage();

    await expect(
      (session as unknown as { _internalAwaitFlushChain(): Promise<void> })._internalAwaitFlushChain(),
    ).resolves.toBeUndefined();
  });

  it('repairs foreground message token persistence on shutdown before releasing the lease', async () => {
    const { harness, agent, storage } = setupHarness();
    const releaseSessionLease = vi.spyOn(storage, 'releaseSessionLease');
    const saveSession = storage.saveSession.bind(storage);
    let failedTokenSave = false;
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      if (!failedTokenSave && (record.tokenUsage?.totalTokens ?? 0) > 0) {
        failedTokenSave = true;
        throw new Error('foreground token persist failed');
      }
      return saveSession(record, opts);
    });

    agent.enqueueRun({ runId: 'foreground-token-persist-failure', finishReason: 'stop' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await expect(session.message({ content: 'one', admissionId: 'foreground-token-persist-failure' })).rejects.toThrow(
      'foreground token persist failed',
    );
    expect(failedTokenSave).toBe(true);

    await expect(harness.shutdown()).resolves.toBeUndefined();
    expect(releaseSessionLease).toHaveBeenCalledTimes(1);
  });

  it('repairs owned system-reminder token persistence on shutdown before releasing the lease', async () => {
    const { harness, agent, storage } = setupHarness();
    const hold = deferred();
    const releaseSessionLease = vi.spyOn(storage, 'releaseSessionLease');
    const saveSession = storage.saveSession.bind(storage);
    let failedTokenSave = false;
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      if (!failedTokenSave && (record.tokenUsage?.totalTokens ?? 0) > 0) {
        failedTokenSave = true;
        throw new Error('reminder token persist failed');
      }
      return saveSession(record, opts);
    });

    agent.enqueueRun({ runId: 'reminder-token-persist-failure', finishReason: 'stop', holdUntil: hold.promise });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.injectSystemReminder('remember this');
    let shutdownSettled = false;
    const shutdown = harness.shutdown().finally(() => {
      shutdownSettled = true;
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(shutdownSettled).toBe(false);
    expect(failedTokenSave).toBe(false);
    hold.resolve();
    await expect(shutdown).resolves.toBeUndefined();
    expect(failedTokenSave).toBe(true);
    expect(releaseSessionLease).toHaveBeenCalledTimes(1);
  });

  it('persists a dirty live token counter during shutdown before releasing the lease', async () => {
    const { harness, storage } = setupHarness();
    let releasedTokenUsage: SessionRecord['tokenUsage'] | undefined;
    const releaseSessionLease = storage.releaseSessionLease.bind(storage);
    vi.spyOn(storage, 'releaseSessionLease').mockImplementation(async opts => {
      const stored = await storage.loadSession({ harnessName: opts.harnessName, sessionId: opts.sessionId });
      releasedTokenUsage = stored?.tokenUsage;
      return releaseSessionLease(opts);
    });

    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    asInternals(session)._tokenUsage = { promptTokens: 3, completionTokens: 4, totalTokens: 7 };

    await expect(harness.shutdown()).resolves.toBeUndefined();
    expect(releasedTokenUsage).toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 });
    const stored = await storage.loadSession({ harnessName: session.getRecord().harnessName, sessionId: session.id });
    expect(stored?.tokenUsage).toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 });
  });

  it('does not treat missing zero token usage as dirty under a zero shutdown deadline', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    (session as unknown as { _record: SessionRecord | LegacyMissingTokenUsageRecord })._record = {
      ...session.getRecord(),
      tokenUsage: undefined,
    };

    await expect(harness.shutdown({ drainTimeoutMs: 0 })).resolves.toBeUndefined();
  });

  it('repairs missing zero token usage during normal shutdown', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    (session as unknown as { _record: SessionRecord | LegacyMissingTokenUsageRecord })._record = {
      ...session.getRecord(),
      tokenUsage: undefined,
    };

    await expect(harness.shutdown()).resolves.toBeUndefined();

    const stored = await storage.loadSession({ harnessName: session.getRecord().harnessName, sessionId: session.id });
    expect(stored?.tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('does not release the lease when shutdown event persistence fails', async () => {
    const { harness, storage } = setupHarness();
    const releaseSessionLease = vi.spyOn(storage, 'releaseSessionLease');
    vi.spyOn(storage, 'appendSessionEvent').mockRejectedValueOnce(new Error('event persistence failed'));

    await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(harness.shutdown()).rejects.toMatchObject({
      name: 'HarnessStorageError',
      cause: expect.objectContaining({ message: 'event persistence failed' }),
    });
    expect(releaseSessionLease).not.toHaveBeenCalled();
  });

  it('does not partially release earlier session leases when later shutdown event persistence fails', async () => {
    const { harness, storage } = setupHarness();
    const releaseSessionLease = vi.spyOn(storage, 'releaseSessionLease');
    const appendSessionEvent = storage.appendSessionEvent.bind(storage);
    const evictedSessionIds: string[] = [];
    harness.subscribe(event => {
      if (event.type === 'session_evicted') evictedSessionIds.push(event.sessionId);
    });
    const first = await harness.session({ resourceId: 'u', threadId: 't-shutdown-partial-release-1' });
    const second = await harness.session({ resourceId: 'u', threadId: 't-shutdown-partial-release-2' });
    let failSecondEviction = true;
    vi.spyOn(storage, 'appendSessionEvent').mockImplementation(async record => {
      if (failSecondEviction && record.sessionId === second.id) {
        failSecondEviction = false;
        throw new Error('second event persistence failed');
      }
      return appendSessionEvent(record);
    });

    await expect(harness.shutdown()).rejects.toMatchObject({
      name: 'HarnessStorageError',
      cause: expect.objectContaining({ message: 'second event persistence failed' }),
    });
    expect(releaseSessionLease).not.toHaveBeenCalled();
    await expect(storage.loadSession({ harnessName: first.getRecord().harnessName, sessionId: first.id })).resolves.toMatchObject({
      ownerId: harness.ownerId,
    });

    await expect(harness.shutdown()).rejects.toMatchObject({
      name: 'HarnessStorageError',
      cause: expect.objectContaining({ message: 'second event persistence failed' }),
    });
    expect(releaseSessionLease).not.toHaveBeenCalled();
    expect(evictedSessionIds.filter(id => id === first.id)).toHaveLength(1);
    expect(evictedSessionIds.filter(id => id === second.id)).toHaveLength(1);
  });

  it('rejects new work from held session references while shutdown is releasing leases', async () => {
    const { harness, storage } = setupHarness();
    const holdRelease = deferred();
    let releaseStarted = false;
    const releaseSessionLease = storage.releaseSessionLease.bind(storage);
    vi.spyOn(storage, 'releaseSessionLease').mockImplementation(async opts => {
      releaseStarted = true;
      await holdRelease.promise;
      return releaseSessionLease(opts);
    });

    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const shutdown = harness.shutdown();
    await vi.waitFor(() => expect(releaseStarted).toBe(true));

    await expect(session.message({ content: 'too late' })).rejects.toMatchObject({
      name: 'HarnessSessionClosingError',
    });

    holdRelease.resolve();
    await expect(shutdown).resolves.toBeUndefined();
  });

  it('waits for returned stream token persistence before releasing the lease on shutdown', async () => {
    const { harness, agent, storage } = setupHarness();
    const hold = deferred();
    let releasedTokenUsage: SessionRecord['tokenUsage'] | undefined;
    const releaseSessionLease = storage.releaseSessionLease.bind(storage);
    vi.spyOn(storage, 'releaseSessionLease').mockImplementation(async opts => {
      const stored = await storage.loadSession({ harnessName: opts.harnessName, sessionId: opts.sessionId });
      releasedTokenUsage = stored?.tokenUsage;
      return releaseSessionLease(opts);
    });

    agent.enqueueRun({ runId: 'stream-shutdown-token-usage', finishReason: 'stop', holdUntil: hold.promise });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'stream', stream: true });
    let shutdownSettled = false;
    const shutdown = harness.shutdown().finally(() => {
      shutdownSettled = true;
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(shutdownSettled).toBe(false);
    hold.resolve();
    await expect(shutdown).resolves.toBeUndefined();
    expect(releasedTokenUsage).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });

  it('waits for foreground message token persistence before releasing the lease on shutdown', async () => {
    const { harness, agent, storage } = setupHarness();
    const hold = deferred();
    let releasedTokenUsage: SessionRecord['tokenUsage'] | undefined;
    const releaseSessionLease = storage.releaseSessionLease.bind(storage);
    vi.spyOn(storage, 'releaseSessionLease').mockImplementation(async opts => {
      const stored = await storage.loadSession({ harnessName: opts.harnessName, sessionId: opts.sessionId });
      releasedTokenUsage = stored?.tokenUsage;
      return releaseSessionLease(opts);
    });

    agent.enqueueRun({ runId: 'foreground-shutdown-token-usage', finishReason: 'stop', holdUntil: hold.promise });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const message = session.message({ content: 'foreground' });
    await new Promise(resolve => setImmediate(resolve));
    let shutdownSettled = false;
    const shutdown = harness.shutdown().finally(() => {
      shutdownSettled = true;
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(shutdownSettled).toBe(false);
    hold.resolve();
    await expect(message).resolves.toBeDefined();
    await expect(shutdown).resolves.toBeUndefined();
    expect(releasedTokenUsage).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });

  it('does not release the lease when shutdown times out before a foreground turn unwinds', async () => {
    const { harness, agent, storage } = setupHarness();
    const hold = deferred();
    const releaseSessionLease = vi.spyOn(storage, 'releaseSessionLease');

    agent.enqueueRun({ runId: 'foreground-shutdown-timeout', finishReason: 'stop', holdUntil: hold.promise });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const message = session.message({ content: 'foreground timeout' });
    await new Promise(resolve => setImmediate(resolve));

    await expect(harness.shutdown({ drainTimeoutMs: 0 })).rejects.toMatchObject({ name: 'HarnessStorageError' });
    expect(releaseSessionLease).not.toHaveBeenCalled();

    hold.resolve();
    await expect(message).resolves.toBeDefined();
    await expect(harness.shutdown()).resolves.toBeUndefined();
    expect(releaseSessionLease).toHaveBeenCalledTimes(1);
  });

  it('releases the lease for a durably parked suspended turn on shutdown', async () => {
    const { harness, agent, storage } = setupHarness();
    let releasedTokenUsage: SessionRecord['tokenUsage'] | undefined;
    const releaseSessionLease = storage.releaseSessionLease.bind(storage);
    vi.spyOn(storage, 'releaseSessionLease').mockImplementation(async opts => {
      const stored = await storage.loadSession({ harnessName: opts.harnessName, sessionId: opts.sessionId });
      releasedTokenUsage = stored?.tokenUsage;
      return releaseSessionLease(opts);
    });

    agent.enqueueRun({
      runId: 'suspended-shutdown-token-usage',
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-shutdown-suspend', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'suspend' });
    expect(session.getRecord().pendingResume).toBeDefined();

    await expect(harness.shutdown()).resolves.toBeUndefined();
    expect(releasedTokenUsage).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });

  it('releases the lease for a durably parked queued suspended turn on shutdown', async () => {
    const { harness, agent, storage } = setupHarness();
    const hold = deferred();
    let releasedTokenUsage: SessionRecord['tokenUsage'] | undefined;
    const releaseSessionLease = storage.releaseSessionLease.bind(storage);
    vi.spyOn(storage, 'releaseSessionLease').mockImplementation(async opts => {
      const stored = await storage.loadSession({ harnessName: opts.harnessName, sessionId: opts.sessionId });
      releasedTokenUsage = stored?.tokenUsage;
      return releaseSessionLease(opts);
    });

    agent.enqueueRun({
      runId: 'queued-suspended-shutdown-token-usage',
      finishReason: 'suspended',
      holdUntil: hold.promise,
      suspendPayload: { toolCallId: 'tc-queued-shutdown-suspend', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const queued = session.queue({ content: 'queued suspend' });
    void queued.catch(() => {});
    await new Promise(resolve => setImmediate(resolve));
    let shutdownSettled = false;
    const shutdown = harness.shutdown({ drainTimeoutMs: 250 }).finally(() => {
      shutdownSettled = true;
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(shutdownSettled).toBe(false);

    hold.resolve();
    await expect(shutdown).resolves.toBeUndefined();
    expect(session.getRecord().pendingResume?.toolCallId).toBe('tc-queued-shutdown-suspend');
    expect(session.getRecord().pendingQueue?.length).toBe(1);
    expect(releasedTokenUsage).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });

  it('waits for queued-turn token persistence before releasing the lease on shutdown', async () => {
    const { harness, agent, storage } = setupHarness();
    const hold = deferred();
    let releasedTokenUsage: SessionRecord['tokenUsage'] | undefined;
    const releaseSessionLease = storage.releaseSessionLease.bind(storage);
    vi.spyOn(storage, 'releaseSessionLease').mockImplementation(async opts => {
      const stored = await storage.loadSession({ harnessName: opts.harnessName, sessionId: opts.sessionId });
      releasedTokenUsage = stored?.tokenUsage;
      return releaseSessionLease(opts);
    });

    agent.enqueueRun({ runId: 'queued-shutdown-token-usage', finishReason: 'stop', holdUntil: hold.promise });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const queued = session.queue({ content: 'queued' });
    await new Promise(resolve => setImmediate(resolve));
    let shutdownSettled = false;
    const shutdown = harness.shutdown().finally(() => {
      shutdownSettled = true;
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(shutdownSettled).toBe(false);
    hold.resolve();
    await expect(queued).resolves.toBeDefined();
    await expect(shutdown).resolves.toBeUndefined();
    expect(releasedTokenUsage).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });

  it('does not write resumed queued-turn token usage before the no-replay marker', async () => {
    const { harness, agent, storage } = setupHarness();
    const writes: SessionRecord[] = [];
    const saveSession = storage.saveSession.bind(storage);
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      writes.push(JSON.parse(JSON.stringify(record)) as SessionRecord);
      return saveSession(record, opts);
    });

    agent.enqueueRun({
      runId: 'q-suspend-token-gap',
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-token-gap', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const queued = session.queue({ content: 'queued' });
    await new Promise(resolve => setImmediate(resolve));

    const receiptId = Object.keys(session.getRecord().queueAdmissionReceipts ?? {})[0];
    expect(receiptId).toBeDefined();
    const beforeResumeTokens = session.getTokenUsage().totalTokens;
    agent.enqueueRun({ runId: 'q-suspend-token-gap', finishReason: 'stop' });
    await session.respondToToolApproval({ approved: true });
    await queued;

    const tokenOnlyWrites = writes.filter(record => {
      if ((record.tokenUsage?.totalTokens ?? 0) <= beforeResumeTokens) return false;
      const receipt = record.queueAdmissionReceipts?.[receiptId!];
      return receipt !== undefined && receipt.postRunFinalizedAt === undefined;
    });
    expect(tokenOnlyWrites).toEqual([]);
    expect(
      writes.some(record => {
        const receipt = record.queueAdmissionReceipts?.[receiptId!];
        return (record.tokenUsage?.totalTokens ?? 0) > beforeResumeTokens && receipt?.postRunFinalizedAt !== undefined;
      }),
    ).toBe(true);
  });

  it('parks suspended message state in the same write as token usage', async () => {
    const { harness, agent, storage } = setupHarness();
    const writes: SessionRecord[] = [];
    const saveSession = storage.saveSession.bind(storage);
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      writes.push(JSON.parse(JSON.stringify(record)) as SessionRecord);
      return saveSession(record, opts);
    });

    agent.enqueueRun({
      runId: 'msg-suspend-token-gap',
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-msg-token-gap', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'needs approval' });

    const tokenOnlyWrites = writes.filter(
      record => (record.tokenUsage?.totalTokens ?? 0) > 0 && record.pendingResume === undefined,
    );
    expect(tokenOnlyWrites).toEqual([]);
    expect(
      writes.some(
        record => (record.tokenUsage?.totalTokens ?? 0) > 0 && record.pendingResume?.toolCallId === 'tc-msg-token-gap',
      ),
    ).toBe(true);
  });

  it('parks resumed suspension state in the same write as token usage', async () => {
    const { harness, agent, storage } = setupHarness();
    const writes: SessionRecord[] = [];
    const saveSession = storage.saveSession.bind(storage);
    vi.spyOn(storage, 'saveSession').mockImplementation(async (record, opts) => {
      writes.push(JSON.parse(JSON.stringify(record)) as SessionRecord);
      return saveSession(record, opts);
    });

    agent.enqueueRun({
      runId: 'msg-resuspend-token-gap',
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-resuspend-first', toolName: 'shell', args: { cmd: 'ls' } },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'needs approval' });
    const beforeResumeTokens = session.getTokenUsage().totalTokens;

    agent.enqueueRun({
      runId: 'msg-resuspend-token-gap',
      finishReason: 'suspended',
      suspendPayload: { toolCallId: 'tc-resuspend-second', toolName: 'shell', args: { cmd: 'pwd' } },
    });
    await session.respondToToolApproval({ approved: true });

    const tokenWritesWithoutNewPending = writes.filter(
      record =>
        (record.tokenUsage?.totalTokens ?? 0) > beforeResumeTokens &&
        record.pendingResume?.toolCallId !== 'tc-resuspend-second',
    );
    expect(tokenWritesWithoutNewPending).toEqual([]);
    expect(
      writes.some(
        record =>
          (record.tokenUsage?.totalTokens ?? 0) > beforeResumeTokens &&
          record.pendingResume?.toolCallId === 'tc-resuspend-second',
      ),
    ).toBe(true);
  });

  it('continues accumulating after rehydration instead of restarting at zero', async () => {
    const { harness, agent, storage } = setupHarness();
    agent.enqueueRun({ runId: 'r1', finishReason: 'stop' });
    const first = await harness.session({ threadId: 't-cont', resourceId: 'u' });
    await first.message({ content: 'one' });
    const afterFirst = first.getTokenUsage();
    await harness.shutdown();

    const { harness: harness2, agent: agent2 } = setupHarness({ sessions: { storage } });
    agent2.enqueueRun({ runId: 'r2', finishReason: 'stop' });
    const second = await harness2.session({ threadId: 't-cont', resourceId: 'u' });
    expect(second.getTokenUsage()).toEqual(afterFirst);
    await second.message({ content: 'two' });
    const afterSecond = second.getTokenUsage();
    expect(afterSecond.promptTokens).toBeGreaterThan(afterFirst.promptTokens);
    expect(afterSecond.completionTokens).toBeGreaterThan(afterFirst.completionTokens);
    expect(afterSecond.totalTokens).toBeGreaterThan(afterFirst.totalTokens);
  });
});

describe('Session token usage — totalTokens derivation', () => {
  it('derives totalTokens from input + output when the provider omits totalTokens', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { inputTokens: 3, outputTokens: 4 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 });
  });

  it('respects an explicit totalTokens when the provider supplies one', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { inputTokens: 2, outputTokens: 5, totalTokens: 9 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 2, completionTokens: 5, totalTokens: 9 });
  });

  it('repairs stale zero provider totals when component counters are present', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 0 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it('repairs stale low provider totals when component counters are present', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 7 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it('does not double-count when both totalTokens and input/output are present across turns', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    } as unknown as FullOutput<unknown>);
    internals._recordTurnCompletion({
      usage: { inputTokens: 4, outputTokens: 6 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 5, completionTokens: 7, totalTokens: 12 });
  });

  it('leaves promptTokens and completionTokens at zero when only totalTokens is provided', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { totalTokens: 5 },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 5 });
  });

  it('derives totalTokens from numeric components only', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: { inputTokens: 3, outputTokens: '4' },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 3, completionTokens: 0, totalTokens: 3 });
  });

  it('ignores non-finite provider usage values', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: {
        inputTokens: Number.NaN,
        outputTokens: Number.POSITIVE_INFINITY,
        totalTokens: Number.NEGATIVE_INFINITY,
      },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('ignores negative and fractional provider usage values', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const internals = asInternals(session);
    internals._recordTurnCompletion({
      usage: {
        inputTokens: -3,
        outputTokens: 1.5,
        totalTokens: -2,
      },
    } as unknown as FullOutput<unknown>);
    expect(internals._tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });
});
