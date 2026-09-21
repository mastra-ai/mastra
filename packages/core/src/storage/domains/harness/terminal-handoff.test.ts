import { describe, expect, it } from 'vitest';

import { projectHarnessPublicError } from '../../../harness/v1/events';
import { InMemoryDB } from '../inmemory-db';
import {
  HarnessTerminalHandoffClaimConflictError,
  HarnessTerminalHandoffFencedError,
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
      id: harnessTerminalIntentId(input.admissionId),
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
    expect(replay.intent?.id).toBe(harnessTerminalIntentId(input.admissionId));
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

  it('keeps finalization-pending typed at the public error projection', () => {
    const error = new HarnessTerminalFinalizationPendingError(4_000, new Error('provider detail'));
    expect(projectHarnessPublicError(error)).toMatchObject({
      code: 'harness.terminal_pending',
    });
  });
});
