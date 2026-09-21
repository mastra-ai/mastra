import { describe, expect, it } from 'vitest';

import { projectHarnessPublicError } from '../../../harness/v1/events';
import { InMemoryDB } from '../inmemory-db';
import {
  HarnessTerminalHandoffClaimConflictError,
  HarnessTerminalHandoffFencedError,
  HarnessTerminalHandoffIdentityConflictError,
  HarnessTerminalHandoffUnsupportedError,
  HarnessTerminalFinalizationPendingError,
  InMemoryHarness,
  harnessTerminalAdmissionId,
  harnessTerminalIntentId,
  type AgentSignalResultEvidence,
  type HarnessTerminalAdmissionInput,
  type HarnessTerminalIntent,
  type SessionRecord,
} from './index';

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    harnessName: 'default',
    id: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    sessionIncarnation: 'incarnation-1',
    origin: 'top-level',
    ownsThread: false,
    modeId: 'build',
    modelId: 'model-1',
    subagentModelOverrides: {},
    permissionRules: { categories: {}, tools: {} },
    sessionGrants: { categories: [], tools: [] },
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    pendingQueue: [],
    state: {},
    createdAt: 1_000,
    lastActivityAt: 1_000,
    version: 0,
    ...overrides,
  };
}

function admission(): HarnessTerminalAdmissionInput {
  return {
    harnessName: 'default',
    sessionId: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    sessionIncarnation: 'incarnation-1',
    admissionId: 'admission-1',
    admissionHash: 'admission-hash-1',
    signalId: 'signal-1',
    runId: 'run-1',
    executionGrant: { key: 'grant-1', generation: 1 },
    finalizerId: 'doxa.chat',
    finalizerVersion: '1',
    seed: { admissionId: 'admission-1', mode: 'build' },
    createdAt: 2_000,
  };
}

function pendingEvidence(input: HarnessTerminalAdmissionInput): AgentSignalResultEvidence {
  return {
    status: 'pending',
    signalId: input.signalId,
    runId: input.runId,
    operationKind: 'message',
    admissionId: input.admissionId,
    admissionHash: input.admissionHash,
    harnessName: input.harnessName,
    sessionId: input.sessionId,
    resourceId: input.resourceId,
    threadId: input.threadId,
    createdAt: 2_000,
    updatedAt: 2_000,
  };
}

describe('native chat terminal handoff', () => {
  it('commits canonical evidence and the exact delivery intent atomically and replays it', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const input = admission();
    await storage.writeMessageResultEvidence(pendingEvidence(input));

    const admitted = await storage.admitTerminalHandoff(input);
    expect(admitted.status).toBe('created');
    const projection = { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'done' } };
    const terminalResult = { status: 'completed' as const, runId: input.runId, completedAt: 3_000 };
    const resultEvidence: AgentSignalResultEvidence = {
      ...pendingEvidence(input),
      status: 'completed',
      result: { text: 'provider output' },
      updatedAt: 3_000,
    };

    const committed = await storage.commitTerminalHandoff({
      admission: input,
      resultEvidence,
      terminalResult,
      projection,
    });
    expect(committed.status).toBe('committed');
    expect(committed.intent).toMatchObject({
      id: harnessTerminalIntentId(harnessTerminalAdmissionId(input)),
      projection: expect.objectContaining({ payloadHash: expect.any(String), payloadJson: '{"text":"done"}' }),
    });
    await expect(
      storage.loadMessageResultEvidence({
        harnessName: input.harnessName,
        sessionId: input.sessionId,
        resourceId: input.resourceId,
        threadId: input.threadId,
        signalId: input.signalId,
      }),
    ).resolves.toMatchObject({ status: 'completed', result: { text: 'provider output' } });

    const replay = await storage.commitTerminalHandoff({
      admission: input,
      resultEvidence,
      terminalResult,
      projection,
    });
    expect(replay.status).toBe('duplicate');
    expect(replay.intent?.id).toBe(harnessTerminalIntentId(harnessTerminalAdmissionId(input)));
    expect(committed.admission.id).toBe(harnessTerminalAdmissionId(input));

    await expect(storage.getTerminalQueuePressure({ harnessName: input.harnessName })).resolves.toEqual({
      pendingIntents: 1,
      pendingBytes: committed.intent!.projection.payloadBytes,
    });
    const claim = await storage.claimTerminalIntents({
      harnessName: input.harnessName,
      consumerId: 'delivery-worker-1',
      limit: 1,
      now: 4_000,
    });
    expect(claim.intents).toHaveLength(1);
    await storage.ackTerminalIntent({
      harnessName: input.harnessName,
      intentId: claim.intents[0]!.id,
      sessionId: input.sessionId,
      sessionIncarnation: input.sessionIncarnation,
      revision: claim.intents[0]!.revision,
      payloadHash: claim.intents[0]!.projection.payloadHash,
      claimId: claim.intents[0]!.claimId!,
      consumerId: 'delivery-worker-1',
      now: 4_001,
    });
    await expect(storage.getTerminalQueuePressure({ harnessName: input.harnessName })).resolves.toEqual({
      pendingIntents: 0,
      pendingBytes: 0,
    });
  });

  it('retains a no-row cancellation fence and rejects a stale session-incarnation callback', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const input = admission();
    await storage.cancelTerminalHandoff({
      harnessName: input.harnessName,
      sessionId: input.sessionId,
      sessionIncarnation: input.sessionIncarnation,
      admissionId: input.admissionId,
      admissionHash: input.admissionHash,
      executionGrant: input.executionGrant,
      reason: { code: 'cancelled', message: 'user cancelled' },
      cancelledAt: 2_100,
    });
    await expect(storage.admitTerminalHandoff(input)).resolves.toMatchObject({ status: 'cancelled' });

    const staleInput = {
      ...input,
      admissionId: 'admission-2',
      admissionHash: 'admission-hash-2',
      signalId: 'signal-2',
      runId: 'run-2',
      executionGrant: { key: 'grant-2', generation: 1 },
    };
    await storage.writeMessageResultEvidence(pendingEvidence(staleInput));
    await storage.admitTerminalHandoff(staleInput);
    await storage.deleteSession({
      harnessName: 'default',
      sessionId: 'session-1',
      ifVersion: 1,
      expectedResourceId: 'resource-1',
      expectedThreadId: 'thread-1',
      expectedParentSessionId: null,
      expectedCreatedAt: 1_000,
    });
    await storage.createOrLoadActiveSession(session({ sessionIncarnation: 'incarnation-2' }), {
      initialLease: { ownerId: 'owner-2', ttlMs: 30_000 },
    });
    await expect(
      storage.commitTerminalHandoff({
        admission: staleInput,
        resultEvidence: {
          ...pendingEvidence(staleInput),
          status: 'completed',
          result: { text: 'stale' },
          updatedAt: 3_000,
        },
        terminalResult: { status: 'completed', runId: staleInput.runId, completedAt: 3_000 },
        projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'stale' } },
      }),
    ).rejects.toBeInstanceOf(HarnessTerminalHandoffFencedError);
  });

  it('lets a committed winner survive a late cancel and a pending cancel fence a late commit', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const winner = admission();
    await storage.writeMessageResultEvidence(pendingEvidence(winner));
    await storage.admitTerminalHandoff(winner);
    await storage.commitTerminalHandoff({
      admission: winner,
      resultEvidence: { ...pendingEvidence(winner), status: 'completed', result: { text: 'done' }, updatedAt: 3_000 },
      terminalResult: { status: 'completed', runId: winner.runId, completedAt: 3_000 },
      projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'done' } },
    });
    await expect(
      storage.cancelTerminalHandoff({
        harnessName: winner.harnessName,
        sessionId: winner.sessionId,
        sessionIncarnation: winner.sessionIncarnation,
        admissionId: winner.admissionId,
        admissionHash: winner.admissionHash,
        executionGrant: winner.executionGrant,
        reason: { code: 'cancelled', message: 'too late' },
      }),
    ).resolves.toMatchObject({ status: 'committed' });

    const loser = {
      ...admission(),
      admissionId: 'admission-2',
      admissionHash: 'admission-hash-2',
      signalId: 'signal-2',
      runId: 'run-2',
      executionGrant: { key: 'grant-2', generation: 1 },
    };
    await storage.writeMessageResultEvidence(pendingEvidence(loser));
    await storage.admitTerminalHandoff(loser);
    await storage.cancelTerminalHandoff({
      harnessName: loser.harnessName,
      sessionId: loser.sessionId,
      sessionIncarnation: loser.sessionIncarnation,
      admissionId: loser.admissionId,
      admissionHash: loser.admissionHash,
      executionGrant: loser.executionGrant,
      reason: { code: 'cancelled', message: 'cancelled first' },
    });
    await expect(
      storage.commitTerminalHandoff({
        admission: loser,
        resultEvidence: { ...pendingEvidence(loser), status: 'completed', result: { text: 'x' }, updatedAt: 3_000 },
        terminalResult: { status: 'completed', runId: loser.runId, completedAt: 3_000 },
        projection: { projectionKind: 'chat.summary', projectionId: 'summary-2', payload: { text: 'x' } },
      }),
    ).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('fences a grant tombstone across scopes and keeps only the live claim able to settle', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true, maxAttempts: 2 } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const other = session({
      id: 'session-2',
      resourceId: 'resource-2',
      threadId: 'thread-2',
      sessionIncarnation: 'incarnation-2',
    });
    await storage.saveSession(other, { ownerId: 'owner-2', ifVersion: 0 });
    const input = admission();
    await storage.cancelTerminalHandoff({
      harnessName: input.harnessName,
      sessionId: input.sessionId,
      sessionIncarnation: input.sessionIncarnation,
      admissionId: input.admissionId,
      admissionHash: input.admissionHash,
      executionGrant: input.executionGrant,
      reason: { code: 'cancelled', message: 'revoked' },
    });
    // The tombstone is grant-scoped: a replay under a different session is fenced.
    await expect(
      storage.admitTerminalHandoff({ ...input, sessionId: 'session-2', sessionIncarnation: 'incarnation-2' }),
    ).resolves.toMatchObject({ status: 'cancelled' });

    const live = { ...input, executionGrant: { key: 'grant-live', generation: 1 } };
    await storage.writeMessageResultEvidence(pendingEvidence(live));
    await storage.admitTerminalHandoff(live);
    await storage.commitTerminalHandoff({
      admission: live,
      resultEvidence: { ...pendingEvidence(live), status: 'completed', result: { text: 'done' }, updatedAt: 3_000 },
      terminalResult: { status: 'completed', runId: live.runId, completedAt: 3_000 },
      projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'done' } },
    });
    const claimed = await storage.claimTerminalIntents({
      harnessName: live.harnessName,
      consumerId: 'worker-a',
      limit: 1,
      now: 4_000,
      leaseMs: 1_000,
    });
    const stale: HarnessTerminalIntent = claimed.intents[0]!;
    const reclaimed = (
      await storage.claimTerminalIntents({
        harnessName: live.harnessName,
        consumerId: 'worker-b',
        limit: 1,
        now: 5_500,
      })
    ).intents[0]!;
    await expect(
      storage.ackTerminalIntent({
        harnessName: live.harnessName,
        intentId: stale.id,
        sessionId: stale.sessionId,
        sessionIncarnation: stale.sessionIncarnation,
        revision: stale.revision,
        payloadHash: stale.projection.payloadHash,
        claimId: stale.claimId!,
        consumerId: 'worker-a',
        now: 6_000,
      }),
    ).rejects.toBeInstanceOf(HarnessTerminalHandoffClaimConflictError);
    await expect(
      storage.ackTerminalIntent({
        harnessName: live.harnessName,
        intentId: reclaimed.id,
        sessionId: reclaimed.sessionId,
        sessionIncarnation: reclaimed.sessionIncarnation,
        revision: reclaimed.revision,
        payloadHash: reclaimed.projection.payloadHash,
        claimId: reclaimed.claimId!,
        consumerId: 'worker-b',
        now: 6_000,
      }),
    ).resolves.toMatchObject({ status: 'acked' });
    await expect(storage.getTerminalQueuePressure({ harnessName: live.harnessName })).resolves.toEqual({
      pendingIntents: 0,
      pendingBytes: 0,
    });
  });

  it('retries a failed claim, dead-letters at maxAttempts, and releases queue pressure', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true, maxAttempts: 2 },
    });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const input = admission();
    await storage.writeMessageResultEvidence(pendingEvidence(input));
    await storage.admitTerminalHandoff(input);
    await storage.commitTerminalHandoff({
      admission: input,
      resultEvidence: { ...pendingEvidence(input), status: 'completed', result: { text: 'done' }, updatedAt: 3_000 },
      terminalResult: { status: 'completed', runId: input.runId, completedAt: 3_000 },
      projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'done' } },
    });
    const committed = (
      await storage.claimTerminalIntents({
        harnessName: 'default',
        consumerId: 'worker-a',
        limit: 1,
        now: 4_000,
        leaseMs: 10_000,
      })
    ).intents[0]!;

    const failed = await storage.failTerminalIntent({
      harnessName: committed.harnessName,
      intentId: committed.id,
      sessionId: committed.sessionId,
      sessionIncarnation: committed.sessionIncarnation,
      revision: committed.revision,
      payloadHash: committed.projection.payloadHash,
      claimId: committed.claimId!,
      consumerId: 'worker-a',
      now: 5_000,
      error: { code: 'delivery_failed', message: 'sink unavailable' },
    });
    expect(failed.status).toBe('failed');
    expect(failed.intent.nextAttemptAt).toBeGreaterThan(5_000);
    expect(failed.intent.lastError).toMatchObject({ code: 'delivery_failed' });
    await expect(storage.getTerminalQueuePressure({ harnessName: 'default' })).resolves.toMatchObject({
      pendingIntents: 1,
    });

    const reclaimed = (
      await storage.claimTerminalIntents({
        harnessName: 'default',
        consumerId: 'worker-b',
        limit: 1,
        now: failed.intent.nextAttemptAt!,
        leaseMs: 10_000,
      })
    ).intents[0]!;
    const dead = await storage.failTerminalIntent({
      harnessName: reclaimed.harnessName,
      intentId: reclaimed.id,
      sessionId: reclaimed.sessionId,
      sessionIncarnation: reclaimed.sessionIncarnation,
      revision: reclaimed.revision,
      payloadHash: reclaimed.projection.payloadHash,
      claimId: reclaimed.claimId!,
      consumerId: 'worker-b',
      now: 7_000,
      error: { code: 'delivery_failed', message: 'still unavailable' },
    });
    expect(dead.status).toBe('dead');
    await expect(storage.getTerminalQueuePressure({ harnessName: 'default' })).resolves.toEqual({
      pendingIntents: 0,
      pendingBytes: 0,
    });
    await expect(
      storage.claimTerminalIntents({ harnessName: 'default', consumerId: 'worker-c', limit: 1, now: 8_000 }),
    ).resolves.toMatchObject({ intents: [] });
  });

  it('rejects a terminal commit when pending capacity is exhausted and lets it retry after drain', async () => {
    const storage = new InMemoryHarness({
      db: new InMemoryDB(),
      terminalHandoff: { enabled: true, maxPendingIntents: 1, maxPendingBytes: 1_000_000 },
    });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const first = admission();
    await storage.writeMessageResultEvidence(pendingEvidence(first));
    await storage.admitTerminalHandoff(first);
    await storage.commitTerminalHandoff({
      admission: first,
      resultEvidence: { ...pendingEvidence(first), status: 'completed', result: { text: 'one' }, updatedAt: 3_000 },
      terminalResult: { status: 'completed', runId: first.runId, completedAt: 3_000 },
      projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'one' } },
    });

    const second = {
      ...admission(),
      admissionId: 'admission-2',
      admissionHash: 'admission-hash-2',
      signalId: 'signal-2',
      runId: 'run-2',
      executionGrant: { key: 'grant-2', generation: 1 },
    };
    await storage.writeMessageResultEvidence(pendingEvidence(second));
    await storage.admitTerminalHandoff(second);
    const secondCommit = {
      admission: second,
      resultEvidence: {
        ...pendingEvidence(second),
        status: 'completed' as const,
        result: { text: 'two' },
        updatedAt: 3_000,
      },
      terminalResult: { status: 'completed' as const, runId: second.runId, completedAt: 3_000 },
      projection: { projectionKind: 'chat.summary', projectionId: 'summary-2', payload: { text: 'two' } },
    };
    await expect(storage.commitTerminalHandoff(secondCommit)).rejects.toThrow('queue capacity is exhausted');

    const claimed = (
      await storage.claimTerminalIntents({ harnessName: 'default', consumerId: 'worker-a', limit: 1, now: 4_000 })
    ).intents[0]!;
    await storage.ackTerminalIntent({
      harnessName: claimed.harnessName,
      intentId: claimed.id,
      sessionId: claimed.sessionId,
      sessionIncarnation: claimed.sessionIncarnation,
      revision: claimed.revision,
      payloadHash: claimed.projection.payloadHash,
      claimId: claimed.claimId!,
      consumerId: 'worker-a',
      now: 5_000,
    });
    await expect(storage.commitTerminalHandoff(secondCommit)).resolves.toMatchObject({ status: 'committed' });
  });

  it('keeps finalization-pending typed at the public error projection', () => {
    const error = new HarnessTerminalFinalizationPendingError(4_000, new Error('provider detail'));
    expect(projectHarnessPublicError(error)).toMatchObject({
      code: 'harness.terminal_pending',
    });
  });

  it('mints and preserves a session incarnation when only terminal handoff is enabled', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true } });
    await storage.saveSession(session({ sessionIncarnation: undefined }), { ownerId: 'owner-1', ifVersion: 0 });
    const stored = await storage.loadSession({ harnessName: 'default', sessionId: 'session-1' });
    expect(stored?.sessionIncarnation).toEqual(expect.any(String));

    // An update that omits the incarnation preserves the minted fence.
    await storage.saveSession(session({ sessionIncarnation: undefined }), { ownerId: 'owner-1', ifVersion: 1 });
    await expect(storage.loadSession({ harnessName: 'default', sessionId: 'session-1' })).resolves.toMatchObject({
      sessionIncarnation: stored!.sessionIncarnation,
    });

    const input = admission();
    input.sessionIncarnation = stored!.sessionIncarnation!;
    await storage.writeMessageResultEvidence(pendingEvidence(input));
    await expect(storage.admitTerminalHandoff(input)).resolves.toMatchObject({ status: 'created' });
    await expect(
      storage.commitTerminalHandoff({
        admission: input,
        resultEvidence: { ...pendingEvidence(input), status: 'completed', result: { text: 'ok' }, updatedAt: 3_000 },
        terminalResult: { status: 'completed', runId: input.runId, completedAt: 3_000 },
        projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'ok' } },
      }),
    ).resolves.toMatchObject({ status: 'committed' });
  });

  it('namespaces delivery intents by the durable admission identity across sessions', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const other = session({
      id: 'session-2',
      resourceId: 'resource-2',
      threadId: 'thread-2',
      sessionIncarnation: 'incarnation-2',
    });
    await storage.saveSession(other, { ownerId: 'owner-2', ifVersion: 0 });

    // Both sessions reuse the same caller admissionId under different grants.
    const first = admission();
    const secondInput = {
      ...admission(),
      sessionId: 'session-2',
      resourceId: 'resource-2',
      threadId: 'thread-2',
      sessionIncarnation: 'incarnation-2',
      executionGrant: { key: 'grant-2', generation: 1 },
    };
    for (const input of [first, secondInput]) {
      await storage.writeMessageResultEvidence(pendingEvidence(input));
      await storage.admitTerminalHandoff(input);
      const committed = await storage.commitTerminalHandoff({
        admission: input,
        resultEvidence: {
          ...pendingEvidence(input),
          status: 'completed',
          result: { text: `done ${input.sessionId}` },
          updatedAt: 3_000,
        },
        terminalResult: { status: 'completed', runId: input.runId, completedAt: 3_000 },
        projection: { projectionKind: 'chat.summary', projectionId: `summary-${input.sessionId}`, payload: {} },
      });
      expect(committed.status).toBe('committed');
      expect(committed.intent?.id).toBe(harnessTerminalIntentId(harnessTerminalAdmissionId(input)));
    }
    await expect(storage.getTerminalQueuePressure({ harnessName: 'default' })).resolves.toMatchObject({
      pendingIntents: 2,
    });
  });

  it('binds a grant generation to one admission across sessions', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const other = session({
      id: 'session-2',
      resourceId: 'resource-2',
      threadId: 'thread-2',
      sessionIncarnation: 'incarnation-2',
    });
    await storage.saveSession(other, { ownerId: 'owner-2', ifVersion: 0 });

    const first = admission();
    await expect(storage.admitTerminalHandoff(first)).resolves.toMatchObject({ status: 'created' });

    // The same grant admitted under a different session conflicts rather than
    // creating a second competing admission.
    const competing = {
      ...admission(),
      sessionId: 'session-2',
      resourceId: 'resource-2',
      threadId: 'thread-2',
      sessionIncarnation: 'incarnation-2',
      admissionId: 'admission-2',
      admissionHash: 'admission-hash-2',
    };
    const conflict = await storage.admitTerminalHandoff(competing);
    expect(conflict.status).toBe('conflict');
    expect(conflict.admission.id).toBe(harnessTerminalAdmissionId(first));
  });

  it('resolves a committed grant winner across sessions before cancelling', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const other = session({
      id: 'session-2',
      resourceId: 'resource-2',
      threadId: 'thread-2',
      sessionIncarnation: 'incarnation-2',
    });
    await storage.saveSession(other, { ownerId: 'owner-2', ifVersion: 0 });

    const winner = admission();
    await storage.writeMessageResultEvidence(pendingEvidence(winner));
    await storage.admitTerminalHandoff(winner);
    await storage.commitTerminalHandoff({
      admission: winner,
      resultEvidence: { ...pendingEvidence(winner), status: 'completed', result: { text: 'done' }, updatedAt: 3_000 },
      terminalResult: { status: 'completed', runId: winner.runId, completedAt: 3_000 },
      projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'done' } },
    });

    // Cancelling the same grant under another session cannot tombstone over the
    // committed winner — the grant-scoped resolution validates the caller's
    // claimed identity and fails closed instead.
    await expect(
      storage.cancelTerminalHandoff({
        harnessName: 'default',
        sessionId: 'session-2',
        sessionIncarnation: 'incarnation-2',
        admissionId: 'admission-2',
        admissionHash: 'admission-hash-2',
        executionGrant: winner.executionGrant,
        reason: { code: 'cancelled', message: 'stale cancel' },
        cancelledAt: 4_000,
      }),
    ).rejects.toBeInstanceOf(HarnessTerminalHandoffIdentityConflictError);
    await expect(
      storage.loadTerminalAdmission({
        harnessName: 'default',
        sessionId: winner.sessionId,
        admissionId: winner.admissionId,
        executionGrant: winner.executionGrant,
      }),
    ).resolves.toMatchObject({ status: 'committed' });
    // The committed intent stays deliverable — no split committed+cancelled outcome.
    await expect(storage.getTerminalQueuePressure({ harnessName: 'default' })).resolves.toMatchObject({
      pendingIntents: 1,
    });
  });

  it('loads a terminal admission by run across pending and committed statuses', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const input = admission();
    await storage.writeMessageResultEvidence(pendingEvidence(input));
    await storage.admitTerminalHandoff(input);

    const byRun = {
      harnessName: input.harnessName,
      sessionId: input.sessionId,
      runId: input.runId,
      sessionIncarnation: input.sessionIncarnation,
    };
    // The settlement-retry probe must see the row in ANY status: a commit that
    // sealed before the caller's bookkeeping finished is 'committed', not
    // 'pending', and still owns the run.
    await expect(storage.loadTerminalAdmissionByRun(byRun)).resolves.toMatchObject({ status: 'pending' });

    await storage.commitTerminalHandoff({
      admission: input,
      resultEvidence: { ...pendingEvidence(input), status: 'completed', result: { text: 'done' }, updatedAt: 3_000 },
      terminalResult: { status: 'completed', runId: input.runId, completedAt: 3_000 },
      projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: {} },
    });
    await expect(storage.loadPendingTerminalAdmission(byRun)).resolves.toBeNull();
    await expect(storage.loadTerminalAdmissionByRun(byRun)).resolves.toMatchObject({ status: 'committed' });
    await expect(storage.loadTerminalAdmissionByRun({ ...byRun, runId: 'run-other' })).resolves.toBeNull();
    // A run id is only deterministic within its session incarnation — a
    // deleted-then-recreated session id must never resolve the prior
    // incarnation's admission.
    await expect(
      storage.loadTerminalAdmissionByRun({ ...byRun, sessionIncarnation: 'incarnation-2' }),
    ).resolves.toBeNull();
    await expect(
      storage.loadPendingTerminalAdmission({ ...byRun, sessionIncarnation: 'incarnation-2' }),
    ).resolves.toBeNull();
  });

  it('preserves completed canonical evidence when a retried commit finds no intent row', async () => {
    const db = new InMemoryDB();
    const storage = new InMemoryHarness({ db, terminalHandoff: { enabled: true } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const input = admission();
    await storage.writeMessageResultEvidence(pendingEvidence(input));
    await storage.admitTerminalHandoff(input);

    // A commit that crashed after writing canonical evidence but before the
    // intent row leaves: admission pending, evidence completed, intent absent.
    const storedEvidence = [...db.harnessMessageResultEvidence.values()].find(row => row.signalId === input.signalId)!;
    storedEvidence.status = 'completed';
    storedEvidence.result = { text: 'canonical winner' };

    // A retried commit carrying a DIFFERENT result must conflict rather than
    // overwrite the sealed canonical evidence.
    await expect(
      storage.commitTerminalHandoff({
        admission: input,
        resultEvidence: {
          ...pendingEvidence(input),
          status: 'completed',
          result: { text: 'impostor' },
          updatedAt: 3_000,
        },
        terminalResult: { status: 'completed', runId: input.runId, completedAt: 3_000 },
        projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'done' } },
      }),
    ).rejects.toBeInstanceOf(HarnessTerminalHandoffIdentityConflictError);
    await expect(
      storage.loadMessageResultEvidence({
        harnessName: input.harnessName,
        sessionId: input.sessionId,
        resourceId: input.resourceId,
        threadId: input.threadId,
        signalId: input.signalId,
      }),
    ).resolves.toMatchObject({ status: 'completed', result: { text: 'canonical winner' } });

    // The faithful retry completes the half-applied commit — same result, so
    // the evidence compare passes and the intent is finally written.
    const retried = await storage.commitTerminalHandoff({
      admission: input,
      resultEvidence: {
        ...pendingEvidence(input),
        status: 'completed',
        result: { text: 'canonical winner' },
        updatedAt: 3_000,
      },
      terminalResult: { status: 'completed', runId: input.runId, completedAt: 3_000 },
      projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'done' } },
    });
    expect(retried.status).toBe('committed');
    expect(retried.intent?.id).toBe(harnessTerminalIntentId(harnessTerminalAdmissionId(input)));
  });

  it('leaves admission pending and evidence untouched when the commit payload cannot be cloned', async () => {
    const db = new InMemoryDB();
    const storage = new InMemoryHarness({ db, terminalHandoff: { enabled: true } });
    await storage.saveSession(session(), { ownerId: 'owner-1', ifVersion: 0 });
    const input = admission();
    await storage.writeMessageResultEvidence(pendingEvidence(input));
    await storage.admitTerminalHandoff(input);

    // A function inside the provider result fails structuredClone — the throw
    // must land BEFORE any durable row mutates, or a committed admission with
    // pending evidence and no intent violates the atomic commit contract.
    await expect(
      storage.commitTerminalHandoff({
        admission: input,
        resultEvidence: {
          ...pendingEvidence(input),
          status: 'completed',
          result: { text: 'x', callback: () => 'uncloneable' },
          updatedAt: 3_000,
        },
        terminalResult: { status: 'completed', runId: input.runId, completedAt: 3_000 },
        projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: { text: 'done' } },
      }),
    ).rejects.toBeTruthy();
    await expect(
      storage.loadTerminalAdmission({
        harnessName: input.harnessName,
        sessionId: input.sessionId,
        admissionId: input.admissionId,
        executionGrant: input.executionGrant,
      }),
    ).resolves.toMatchObject({ status: 'pending' });
    await expect(
      storage.loadMessageResultEvidence({
        harnessName: input.harnessName,
        sessionId: input.sessionId,
        resourceId: input.resourceId,
        threadId: input.threadId,
        signalId: input.signalId,
      }),
    ).resolves.toMatchObject({ status: 'pending' });
    await expect(
      storage.loadTerminalIntent({
        harnessName: input.harnessName,
        intentId: harnessTerminalIntentId(harnessTerminalAdmissionId(input)),
      }),
    ).resolves.toBeNull();
    await expect(storage.getTerminalQueuePressure({ harnessName: input.harnessName })).resolves.toEqual({
      pendingIntents: 0,
      pendingBytes: 0,
    });
  });

  it('reports terminal handoff as unsupported and rejects terminal operations when disabled', async () => {
    const disabled = new InMemoryHarness({ db: new InMemoryDB() });
    expect(disabled.supportsTerminalHandoff).toBe(false);
    const input = admission();
    const expected = HarnessTerminalHandoffUnsupportedError;
    await expect(disabled.admitTerminalHandoff(input)).rejects.toBeInstanceOf(expected);
    await expect(
      disabled.loadTerminalAdmission({
        harnessName: input.harnessName,
        sessionId: input.sessionId,
        admissionId: input.admissionId,
        executionGrant: input.executionGrant,
      }),
    ).rejects.toBeInstanceOf(expected);
    await expect(
      disabled.loadPendingTerminalAdmission({
        harnessName: input.harnessName,
        sessionId: input.sessionId,
        runId: input.runId,
        sessionIncarnation: input.sessionIncarnation,
      }),
    ).rejects.toBeInstanceOf(expected);
    await expect(
      disabled.loadTerminalAdmissionByRun({
        harnessName: input.harnessName,
        sessionId: input.sessionId,
        runId: input.runId,
        sessionIncarnation: input.sessionIncarnation,
      }),
    ).rejects.toBeInstanceOf(expected);
    await expect(
      disabled.commitTerminalHandoff({
        admission: input,
        resultEvidence: pendingEvidence(input),
        terminalResult: { status: 'completed', runId: input.runId, completedAt: 3_000 },
        projection: { projectionKind: 'chat.summary', projectionId: 'summary-1', payload: {} },
      }),
    ).rejects.toBeInstanceOf(expected);
    await expect(
      disabled.loadTerminalIntent({
        harnessName: input.harnessName,
        intentId: harnessTerminalIntentId(harnessTerminalAdmissionId(input)),
      }),
    ).rejects.toBeInstanceOf(expected);
    await expect(
      disabled.claimTerminalIntents({ harnessName: input.harnessName, consumerId: 'w-1', limit: 1, now: 4_000 }),
    ).rejects.toBeInstanceOf(expected);
    await expect(disabled.getTerminalQueuePressure({ harnessName: input.harnessName })).rejects.toBeInstanceOf(
      expected,
    );

    const enabled = new InMemoryHarness({ db: new InMemoryDB(), terminalHandoff: { enabled: true } });
    expect(enabled.supportsTerminalHandoff).toBe(true);
  });
});
