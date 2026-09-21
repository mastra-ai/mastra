import { randomUUID } from 'node:crypto';

import { createSampleSessionRecord } from '@internal/storage-test-utils';
import {
  HarnessTerminalHandoffClaimConflictError,
  HarnessTerminalHandoffFencedError,
  HarnessTerminalHandoffIdentityConflictError,
  HarnessTerminalHandoffValidationError,
  TABLE_HARNESS_TERMINAL_ADMISSIONS,
  TABLE_HARNESS_TERMINAL_INTENTS,
  TABLE_HARNESS_TERMINAL_TOMBSTONES,
  harnessTerminalAdmissionId,
  harnessTerminalIntentId,
  type AgentSignalResultEvidence,
  type HarnessStorage,
  type HarnessTerminalAdmissionInput,
  type HarnessTerminalClaimIdentity,
  type HarnessTerminalIntent,
  type SessionRecord,
} from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const HARNESS = 'default';

function terminalStore(id: string, schemaName: string, terminalHandoff?: Record<string, unknown>) {
  return new PostgresStore({
    ...TEST_CONFIG,
    id,
    schemaName,
    enabledDomains: ['harness'],
    sessionRecordProjection: { enabled: true },
    terminalHandoff: { enabled: true, ...terminalHandoff },
  });
}

async function createNativeSession(
  harness: HarnessStorage,
  id: string,
  overrides: Partial<SessionRecord> = {},
): Promise<SessionRecord> {
  const record = createSampleSessionRecord({
    id,
    harnessName: HARNESS,
    resourceId: `resource-${id}`,
    threadId: `thread-${id}`,
    ...overrides,
  });
  const result = await harness.createOrLoadActiveSession(record, {
    initialLease: { ownerId: `owner-${id}`, ttlMs: 60_000 },
  });
  if (!result.created) throw new Error(`expected a fresh session for ${id}`);
  const loaded = await harness.loadSession({ harnessName: HARNESS, sessionId: id });
  if (!loaded?.sessionIncarnation) {
    throw new Error('expected a storage-assigned session incarnation on the native path');
  }
  return loaded;
}

function admissionFor(session: SessionRecord, tag: string): HarnessTerminalAdmissionInput {
  return {
    harnessName: HARNESS,
    sessionId: session.id,
    resourceId: session.resourceId,
    threadId: session.threadId,
    sessionIncarnation: session.sessionIncarnation!,
    admissionId: `admission-${tag}`,
    admissionHash: `admission-hash-${tag}`,
    signalId: `signal-${tag}`,
    runId: `run-${tag}`,
    executionGrant: { key: `grant-${tag}`, generation: 1 },
    finalizerId: 'doxa.chat',
    finalizerVersion: '1',
    seed: { admissionId: `admission-${tag}`, mode: 'build' },
    createdAt: Date.now(),
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function commitInput(input: HarnessTerminalAdmissionInput, tag: string) {
  return {
    admission: input,
    resultEvidence: {
      ...pendingEvidence(input),
      status: 'completed' as const,
      runId: input.runId,
      result: { text: `provider output ${tag}` },
      updatedAt: Date.now(),
    },
    terminalResult: { status: 'completed' as const, runId: input.runId, completedAt: Date.now() },
    projection: {
      projectionKind: 'chat.summary',
      projectionId: `summary-${tag}`,
      payload: { text: `done ${tag}` },
    },
  };
}

function claimIdentityOf(intent: HarnessTerminalIntent, consumerId: string): HarnessTerminalClaimIdentity {
  return {
    harnessName: intent.harnessName,
    intentId: intent.id,
    sessionId: intent.sessionId,
    sessionIncarnation: intent.sessionIncarnation,
    revision: intent.revision,
    payloadHash: intent.projection.payloadHash,
    claimId: intent.claimId!,
    consumerId,
  };
}

async function claimFirst(
  harness: HarnessStorage,
  consumerId: string,
  now: number,
  leaseMs = 60_000,
): Promise<HarnessTerminalIntent> {
  const claimed = await harness.claimTerminalIntents({ harnessName: HARNESS, consumerId, limit: 1, now, leaseMs });
  if (claimed.intents.length !== 1)
    throw new Error(`expected exactly one claimable intent, got ${claimed.intents.length}`);
  return claimed.intents[0]!;
}

describe('HarnessPG native terminal handoff', () => {
  const schemaName = `pf4276_terminal_${randomUUID().replaceAll('-', '_')}`;
  const store = terminalStore('pg-harness-terminal-test-store', schemaName, { maxAttempts: 2 });

  const harness = () => store.stores.harness!;
  const rowCount = async (table: string) => {
    const row = await store.db.one<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "${schemaName}"."${table}"`);
    return Number(row.count);
  };

  beforeAll(async () => {
    await store.init();
  });

  beforeEach(async () => {
    await store.stores.harness!.dangerouslyClearAll();
  });

  afterAll(async () => {
    await store.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => {});
    await store.close();
  });

  it('threads the PostgresStore terminalHandoff option into the adapter bounds', async () => {
    const bounded = terminalStore('pg-harness-terminal-bounded-store', schemaName, {
      maxAttempts: 1,
      maxPendingIntents: 8,
      claimLeaseMs: 5_000,
    });
    await bounded.init();
    try {
      const bh = bounded.stores.harness!;
      expect(bh.supportsTerminalHandoff).toBe(true);
      const session = await createNativeSession(bh, 'bounded-session');
      const input = admissionFor(session, 'bounded');
      await bh.writeMessageResultEvidence(pendingEvidence(input));
      await bh.admitTerminalHandoff(input);
      const committed = await bh.commitTerminalHandoff(commitInput(input, 'bounded'));
      expect(committed.status).toBe('committed');

      const claimed = await claimFirst(bh, 'worker-a', Date.now());
      // maxAttempts: 1 must reach the adapter — a single failure dead-letters.
      const failed = await bh.failTerminalIntent({
        ...claimIdentityOf(claimed, 'worker-a'),
        error: { code: 'delivery_failed', message: 'sink unavailable' },
        now: Date.now(),
      });
      expect(failed.status).toBe('dead');
      await expect(bh.getTerminalQueuePressure({ harnessName: HARNESS })).resolves.toEqual({
        pendingIntents: 0,
        pendingBytes: 0,
      });
    } finally {
      await bounded.close();
    }
  });

  it('commits canonical evidence, the exact delivery intent, and the terminal winner atomically', async () => {
    const session = await createNativeSession(harness(), 'session-commit');
    const input = admissionFor(session, 'commit');
    await harness().writeMessageResultEvidence(pendingEvidence(input));

    const admitted = await harness().admitTerminalHandoff(input);
    expect(admitted.status).toBe('created');
    expect(admitted.admission.id).toBe(harnessTerminalAdmissionId(input));

    const args = commitInput(input, 'commit');
    const committed = await harness().commitTerminalHandoff(args);
    expect(committed.status).toBe('committed');
    expect(committed.intent?.id).toBe(harnessTerminalIntentId(input.admissionId));
    expect(committed.intent?.projection.payloadJson).toBe('{"text":"done commit"}');
    expect(committed.admission.status).toBe('committed');

    await expect(
      harness().loadMessageResultEvidence({
        harnessName: HARNESS,
        sessionId: session.id,
        resourceId: session.resourceId,
        threadId: session.threadId,
        signalId: input.signalId,
      }),
    ).resolves.toMatchObject({ status: 'completed', result: { text: 'provider output commit' } });

    const pressure = await harness().getTerminalQueuePressure({ harnessName: HARNESS });
    expect(pressure.pendingIntents).toBe(1);
    expect(pressure.pendingBytes).toBe(committed.intent!.projection.payloadBytes);

    // A lost commit acknowledgement retries the identical commit and must
    // not produce a second intent or double-counted pressure.
    const replay = await harness().commitTerminalHandoff(args);
    expect(replay.status).toBe('duplicate');
    expect(replay.intent?.id).toBe(committed.intent!.id);
    expect(await rowCount(TABLE_HARNESS_TERMINAL_INTENTS)).toBe(1);
    await expect(harness().getTerminalQueuePressure({ harnessName: HARNESS })).resolves.toEqual(pressure);

    // A mutated replay under the same grant is an identity conflict, not a
    // silent overwrite of the committed winner.
    await expect(
      harness().commitTerminalHandoff({
        ...args,
        projection: { projectionKind: 'chat.summary', projectionId: 'summary-commit', payload: { text: 'other' } },
      }),
    ).rejects.toBeInstanceOf(HarnessTerminalHandoffIdentityConflictError);
  });

  it('serializes concurrent duplicate admits to exactly one winner', async () => {
    const session = await createNativeSession(harness(), 'session-admit-race');
    const input = admissionFor(session, 'admit-race');
    await harness().writeMessageResultEvidence(pendingEvidence(input));

    const outcomes = await Promise.allSettled([
      harness().admitTerminalHandoff(input),
      harness().admitTerminalHandoff({ ...input }),
    ]);
    const receipts = outcomes.map(o => (o.status === 'fulfilled' ? o.value.status : `rejected:${String(o.reason)}`));
    expect(receipts.sort()).toEqual(['created', 'duplicate']);
    expect(await rowCount(TABLE_HARNESS_TERMINAL_ADMISSIONS)).toBe(1);
  });

  it('rejects a replayed admit that mutates identity under the same grant', async () => {
    const session = await createNativeSession(harness(), 'session-identity');
    const input = admissionFor(session, 'identity');
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    await harness().admitTerminalHandoff(input);

    // Same grant + session -> same admission row id, different payload.
    await expect(
      harness().admitTerminalHandoff({ ...input, runId: 'run-other', signalId: 'signal-other' }),
    ).rejects.toBeInstanceOf(HarnessTerminalHandoffIdentityConflictError);
    expect(await rowCount(TABLE_HARNESS_TERMINAL_ADMISSIONS)).toBe(1);
  });

  it('keeps an absent-row cancellation tombstone that fences late admission and commit', async () => {
    const session = await createNativeSession(harness(), 'session-tombstone');
    const input = admissionFor(session, 'tombstone');

    const cancelled = await harness().cancelTerminalHandoff({
      harnessName: HARNESS,
      sessionId: session.id,
      sessionIncarnation: session.sessionIncarnation!,
      admissionId: input.admissionId,
      admissionHash: input.admissionHash,
      executionGrant: input.executionGrant,
      reason: { code: 'cancelled', message: 'user cancelled' },
      cancelledAt: Date.now(),
    });
    expect(cancelled.status).toBe('cancelled');
    expect(await rowCount(TABLE_HARNESS_TERMINAL_TOMBSTONES)).toBe(1);

    // Late admission cannot revive the cancelled grant.
    await expect(harness().admitTerminalHandoff(input)).resolves.toMatchObject({ status: 'cancelled' });
    expect(await rowCount(TABLE_HARNESS_TERMINAL_ADMISSIONS)).toBe(0);

    // A commit replay for the tombstoned grant also fails closed.
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    await expect(harness().commitTerminalHandoff(commitInput(input, 'tombstone'))).rejects.toBeInstanceOf(
      HarnessTerminalHandoffFencedError,
    );
    expect(await rowCount(TABLE_HARNESS_TERMINAL_INTENTS)).toBe(0);
  });

  it('lets a pending cancel win and keeps the commit fenced afterwards', async () => {
    const session = await createNativeSession(harness(), 'session-cancel-pending');
    const input = admissionFor(session, 'cancel-pending');
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    await harness().admitTerminalHandoff(input);

    const cancelled = await harness().cancelTerminalHandoff({
      harnessName: HARNESS,
      sessionId: session.id,
      sessionIncarnation: session.sessionIncarnation!,
      admissionId: input.admissionId,
      admissionHash: input.admissionHash,
      executionGrant: input.executionGrant,
      reason: { code: 'cancelled', message: 'user cancelled' },
    });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.admission?.status).toBe('cancelled');

    const committed = await harness().commitTerminalHandoff(commitInput(input, 'cancel-pending'));
    expect(committed.status).toBe('cancelled');
    expect(await rowCount(TABLE_HARNESS_TERMINAL_INTENTS)).toBe(0);
    await expect(
      harness().loadMessageResultEvidence({
        harnessName: HARNESS,
        sessionId: session.id,
        resourceId: session.resourceId,
        threadId: session.threadId,
        signalId: input.signalId,
      }),
    ).resolves.toMatchObject({ status: 'pending' });
  });

  it('lets a committed winner survive a late cancel', async () => {
    const session = await createNativeSession(harness(), 'session-cancel-late');
    const input = admissionFor(session, 'cancel-late');
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    await harness().admitTerminalHandoff(input);
    await harness().commitTerminalHandoff(commitInput(input, 'cancel-late'));

    const cancelled = await harness().cancelTerminalHandoff({
      harnessName: HARNESS,
      sessionId: session.id,
      sessionIncarnation: session.sessionIncarnation!,
      admissionId: input.admissionId,
      admissionHash: input.admissionHash,
      executionGrant: input.executionGrant,
      reason: { code: 'cancelled', message: 'too late' },
    });
    expect(cancelled.status).toBe('committed');
    expect(cancelled.admission?.status).toBe('committed');
    expect(await rowCount(TABLE_HARNESS_TERMINAL_INTENTS)).toBe(1);
  });

  it('resolves a concurrent commit-vs-cancel race to exactly one terminal outcome', async () => {
    const session = await createNativeSession(harness(), 'session-race');
    const input = admissionFor(session, 'race');
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    await harness().admitTerminalHandoff(input);

    const [commitOutcome, cancelOutcome] = await Promise.allSettled([
      harness().commitTerminalHandoff(commitInput(input, 'race')),
      harness().cancelTerminalHandoff({
        harnessName: HARNESS,
        sessionId: session.id,
        sessionIncarnation: session.sessionIncarnation!,
        admissionId: input.admissionId,
        admissionHash: input.admissionHash,
        executionGrant: input.executionGrant,
        reason: { code: 'cancelled', message: 'raced' },
      }),
    ]);
    expect(commitOutcome.status).toBe('fulfilled');
    expect(cancelOutcome.status).toBe('fulfilled');

    const commitStatus = commitOutcome.status === 'fulfilled' ? commitOutcome.value.status : 'threw';
    const cancelStatus = cancelOutcome.status === 'fulfilled' ? cancelOutcome.value.status : 'threw';
    const stored = await harness().loadTerminalAdmission({
      harnessName: HARNESS,
      sessionId: session.id,
      admissionId: input.admissionId,
      executionGrant: input.executionGrant,
    });
    const intents = await rowCount(TABLE_HARNESS_TERMINAL_INTENTS);
    const evidence = await harness().loadMessageResultEvidence({
      harnessName: HARNESS,
      sessionId: session.id,
      resourceId: session.resourceId,
      threadId: session.threadId,
      signalId: input.signalId,
    });

    if (commitStatus === 'committed') {
      // Commit won the grant lock first: cancel must observe the winner and
      // the result+intent pair must both be durable.
      expect(cancelStatus).toBe('committed');
      expect(stored?.status).toBe('committed');
      expect(intents).toBe(1);
      expect(evidence).toMatchObject({ status: 'completed' });
    } else {
      // Cancel won: the tombstone fences the commit and no half-state is
      // observable — no intent, pending evidence, cancelled admission.
      expect(commitStatus).toBe('cancelled');
      expect(cancelStatus).toBe('cancelled');
      expect(stored?.status).toBe('cancelled');
      expect(intents).toBe(0);
      expect(evidence).toMatchObject({ status: 'pending' });
      expect(await rowCount(TABLE_HARNESS_TERMINAL_TOMBSTONES)).toBe(1);
    }
  });

  it('rolls back cleanly when canonical evidence is missing, then recovers on retry', async () => {
    const session = await createNativeSession(harness(), 'session-rollback');
    const input = admissionFor(session, 'rollback');
    await harness().admitTerminalHandoff(input);

    // No pending evidence row was written: the commit must fail without
    // leaving an intent, pressure, or a mutated admission behind.
    await expect(harness().commitTerminalHandoff(commitInput(input, 'rollback'))).rejects.toBeInstanceOf(
      HarnessTerminalHandoffValidationError,
    );
    await expect(
      harness().loadTerminalAdmission({
        harnessName: HARNESS,
        sessionId: session.id,
        admissionId: input.admissionId,
        executionGrant: input.executionGrant,
      }),
    ).resolves.toMatchObject({ status: 'pending' });
    expect(await rowCount(TABLE_HARNESS_TERMINAL_INTENTS)).toBe(0);
    await expect(harness().getTerminalQueuePressure({ harnessName: HARNESS })).resolves.toEqual({
      pendingIntents: 0,
      pendingBytes: 0,
    });

    // The durable pending admission survives the failed commit and a legal
    // retry succeeds once the canonical evidence lands.
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    const retried = await harness().commitTerminalHandoff(commitInput(input, 'rollback'));
    expect(retried.status).toBe('committed');
  });

  it('fences a stale session incarnation after delete and recreate', async () => {
    const session = await createNativeSession(harness(), 'session-incarnation');
    const input = admissionFor(session, 'incarnation');
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    await harness().admitTerminalHandoff(input);

    await harness().deleteSession({
      harnessName: HARNESS,
      sessionId: session.id,
      ifVersion: session.version,
      expectedResourceId: session.resourceId,
      expectedThreadId: session.threadId,
      expectedCreatedAt: session.createdAt,
    });

    // Recreation mints a fresh incarnation through the native path.
    const recreated = await createNativeSession(harness(), 'session-incarnation');
    expect(recreated.sessionIncarnation).not.toBe(session.sessionIncarnation);

    // The deletion fenced the stale admission row.
    await expect(
      harness().loadTerminalAdmission({
        harnessName: HARNESS,
        sessionId: session.id,
        admissionId: input.admissionId,
        executionGrant: input.executionGrant,
      }),
    ).resolves.toMatchObject({ status: 'fenced' });

    await expect(harness().commitTerminalHandoff(commitInput(input, 'incarnation'))).rejects.toBeInstanceOf(
      HarnessTerminalHandoffFencedError,
    );
    await expect(harness().admitTerminalHandoff(input)).resolves.toMatchObject({ status: 'fenced' });

    // The new incarnation accepts fresh work.
    const fresh = admissionFor(recreated, 'incarnation-fresh');
    await harness().writeMessageResultEvidence(pendingEvidence(fresh));
    await expect(harness().admitTerminalHandoff(fresh)).resolves.toMatchObject({ status: 'created' });
  });

  it('fences a grant tombstone across scopes', async () => {
    const sessionA = await createNativeSession(harness(), 'session-scope-a');
    const sessionB = await createNativeSession(harness(), 'session-scope-b');
    const grant = { key: 'grant-shared', generation: 1 };
    const inputA = { ...admissionFor(sessionA, 'scope-a'), executionGrant: grant };

    await harness().cancelTerminalHandoff({
      harnessName: HARNESS,
      sessionId: sessionA.id,
      sessionIncarnation: sessionA.sessionIncarnation!,
      admissionId: inputA.admissionId,
      admissionHash: inputA.admissionHash,
      executionGrant: grant,
      reason: { code: 'cancelled', message: 'grant revoked' },
    });

    // The tombstone is grant-scoped: replaying the grant under a different
    // session/incarnation still observes the durable fence.
    const inputB = { ...admissionFor(sessionB, 'scope-b'), executionGrant: grant };
    await expect(harness().admitTerminalHandoff(inputB)).resolves.toMatchObject({ status: 'cancelled' });
    expect(await rowCount(TABLE_HARNESS_TERMINAL_ADMISSIONS)).toBe(0);
  });

  it('lets only the live claim holder ack; an expired claim cannot settle the winner', async () => {
    const session = await createNativeSession(harness(), 'session-claim');
    const input = admissionFor(session, 'claim');
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    await harness().admitTerminalHandoff(input);
    await harness().commitTerminalHandoff(commitInput(input, 'claim'));

    const t0 = Date.now();
    const first = await harness().claimTerminalIntents({
      harnessName: HARNESS,
      consumerId: 'worker-a',
      limit: 1,
      now: t0,
      leaseMs: 1_000,
    });
    expect(first.intents).toHaveLength(1);
    const expired = first.intents[0]!;

    // The lease lapses; a second consumer takes over the same intent.
    const second = await harness().claimTerminalIntents({
      harnessName: HARNESS,
      consumerId: 'worker-b',
      limit: 1,
      now: t0 + 2_000,
    });
    expect(second.intents).toHaveLength(1);
    const reclaimed = second.intents[0]!;
    expect(reclaimed.id).toBe(expired.id);
    expect(reclaimed.claimId).not.toBe(expired.claimId);

    // The stale claim cannot ack, fail, or renew — the late loser cannot
    // settle the winner's delivery.
    await expect(
      harness().ackTerminalIntent({ ...claimIdentityOf(expired, 'worker-a'), now: t0 + 2_500 }),
    ).rejects.toBeInstanceOf(HarnessTerminalHandoffClaimConflictError);
    await expect(
      harness().renewTerminalIntent({ ...claimIdentityOf(expired, 'worker-a'), now: t0 + 2_500, leaseMs: 5_000 }),
    ).rejects.toBeInstanceOf(HarnessTerminalHandoffClaimConflictError);
    await expect(
      harness().failTerminalIntent({
        ...claimIdentityOf(expired, 'worker-a'),
        error: { code: 'x', message: 'x' },
        now: t0 + 2_500,
      }),
    ).rejects.toBeInstanceOf(HarnessTerminalHandoffClaimConflictError);

    // The live claim renews and acks, draining pressure exactly once.
    const renewed = await harness().renewTerminalIntent({
      ...claimIdentityOf(reclaimed, 'worker-b'),
      now: t0 + 2_100,
      leaseMs: 5_000,
    });
    expect(renewed.status).toBe('renewed');
    expect(renewed.intent.claimExpiresAt).toBe(t0 + 2_100 + 5_000);

    const acked = await harness().ackTerminalIntent({
      ...claimIdentityOf(reclaimed, 'worker-b'),
      now: t0 + 2_200,
    });
    expect(acked.status).toBe('acked');
    await expect(harness().getTerminalQueuePressure({ harnessName: HARNESS })).resolves.toEqual({
      pendingIntents: 0,
      pendingBytes: 0,
    });

    // A duplicate ack on the settled intent is a replay, not an error.
    const replay = await harness().ackTerminalIntent({
      ...claimIdentityOf(reclaimed, 'worker-b'),
      now: t0 + 2_300,
    });
    expect(replay.status).toBe('duplicate');
  });

  it('requeues a failed claim with backoff and dead-letters at maxAttempts', async () => {
    const session = await createNativeSession(harness(), 'session-retry');
    const input = admissionFor(session, 'retry');
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    await harness().admitTerminalHandoff(input);
    await harness().commitTerminalHandoff(commitInput(input, 'retry'));

    const t0 = Date.now();
    const first = await claimFirst(harness(), 'worker-a', t0);

    const failed = await harness().failTerminalIntent({
      ...claimIdentityOf(first, 'worker-a'),
      error: { code: 'delivery_failed', message: 'sink unavailable' },
      now: t0 + 10,
    });
    expect(failed.status).toBe('failed');
    expect(failed.intent.nextAttemptAt).toBeGreaterThan(t0 + 10);

    // Not yet due: the retry is invisible until nextAttemptAt.
    await expect(
      harness().claimTerminalIntents({ harnessName: HARNESS, consumerId: 'worker-a', limit: 1, now: t0 + 11 }),
    ).resolves.toMatchObject({ intents: [] });

    const second = await claimFirst(harness(), 'worker-a', failed.intent.nextAttemptAt! + 1);
    expect(second.attempts).toBe(2);

    const dead = await harness().failTerminalIntent({
      ...claimIdentityOf(second, 'worker-a'),
      error: { code: 'delivery_failed', message: 'still down' },
      now: failed.intent.nextAttemptAt! + 2,
    });
    expect(dead.status).toBe('dead');
    await expect(harness().getTerminalQueuePressure({ harnessName: HARNESS })).resolves.toEqual({
      pendingIntents: 0,
      pendingBytes: 0,
    });

    // Dead intents never reappear on the claim path.
    await expect(
      harness().claimTerminalIntents({
        harnessName: HARNESS,
        consumerId: 'worker-a',
        limit: 1,
        now: failed.intent.nextAttemptAt! + 3_000,
      }),
    ).resolves.toMatchObject({ intents: [] });
  });

  it('enforces the configured pending-intent bound across sessions', async () => {
    const bounded = terminalStore('pg-harness-terminal-capacity-store', schemaName, {
      maxPendingIntents: 1,
      maxPendingBytes: 1024 * 1024,
    });
    await bounded.init();
    try {
      const bh = bounded.stores.harness!;
      const sessionA = await createNativeSession(bh, 'session-cap-a');
      const inputA = admissionFor(sessionA, 'cap-a');
      await bh.writeMessageResultEvidence(pendingEvidence(inputA));
      await bh.admitTerminalHandoff(inputA);
      await bh.commitTerminalHandoff(commitInput(inputA, 'cap-a'));

      const sessionB = await createNativeSession(bh, 'session-cap-b');
      const inputB = admissionFor(sessionB, 'cap-b');
      await bh.writeMessageResultEvidence(pendingEvidence(inputB));
      await bh.admitTerminalHandoff(inputB);
      // The single pending intent fills the configured capacity; the second
      // commit is rejected before it can enqueue another delivery intent.
      await expect(bh.commitTerminalHandoff(commitInput(inputB, 'cap-b'))).rejects.toBeInstanceOf(
        HarnessTerminalHandoffValidationError,
      );
      // The rejected commit leaves the admission pending and recoverable.
      await expect(
        bh.loadTerminalAdmission({
          harnessName: HARNESS,
          sessionId: sessionB.id,
          admissionId: inputB.admissionId,
          executionGrant: inputB.executionGrant,
        }),
      ).resolves.toMatchObject({ status: 'pending' });
    } finally {
      await bounded.close();
    }
  });

  it('fences pending deliveries for a deleted session without rewriting the winner', async () => {
    const session = await createNativeSession(harness(), 'session-fence');
    const input = admissionFor(session, 'fence');
    await harness().writeMessageResultEvidence(pendingEvidence(input));
    await harness().admitTerminalHandoff(input);
    const committed = await harness().commitTerminalHandoff(commitInput(input, 'fence'));
    expect(committed.status).toBe('committed');

    await harness().fenceTerminalHandoffsForSession({
      harnessName: HARNESS,
      sessionId: session.id,
      sessionIncarnation: session.sessionIncarnation!,
    });

    // The committed admission remains the canonical winner; only the pending
    // delivery intent is fenced and its pressure released.
    await expect(
      harness().loadTerminalAdmission({
        harnessName: HARNESS,
        sessionId: session.id,
        admissionId: input.admissionId,
        executionGrant: input.executionGrant,
      }),
    ).resolves.toMatchObject({ status: 'committed' });
    await expect(
      harness().loadTerminalIntent({ harnessName: HARNESS, intentId: committed.intent!.id }),
    ).resolves.toMatchObject({ status: 'fenced' });
    await expect(harness().getTerminalQueuePressure({ harnessName: HARNESS })).resolves.toEqual({
      pendingIntents: 0,
      pendingBytes: 0,
    });

    // A fenced intent answers 'fenced' rather than acking or retrying.
    const fencedAck = await harness().ackTerminalIntent({
      harnessName: HARNESS,
      intentId: committed.intent!.id,
      sessionId: session.id,
      sessionIncarnation: session.sessionIncarnation!,
      revision: committed.intent!.revision,
      payloadHash: committed.intent!.projection.payloadHash,
      claimId: 'claim-any',
      consumerId: 'worker-a',
      now: Date.now(),
    });
    expect(fencedAck.status).toBe('fenced');
    await expect(
      harness().claimTerminalIntents({ harnessName: HARNESS, consumerId: 'worker-a', limit: 1 }),
    ).resolves.toMatchObject({ intents: [] });
  });
});
