import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests, createSharedFactoryDatabaseForTests } from '../../test-utils.js';
import { FACTORY_RUN_END_RETENTION_MS } from './base.js';
import type { FactoryOpenRun, OpenRunsStorage } from './base.js';

function openRun(kickoffId: string, overrides: Partial<FactoryOpenRun> = {}): FactoryOpenRun {
  return {
    kickoffId,
    bindingId: 'binding-1',
    role: 'build',
    startedBy: 'factory-rule-dispatcher',
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    workItemId: 'work-1',
    sessionId: 'session-1',
    threadId: 'thread-1',
    branch: 'factory/work-1',
    ...overrides,
  };
}

const LOST = openRun('kickoff-1', { ownerId: 'lost-worker', heartbeatAt: 1, startedAt: 1 });

async function finish(openRuns: OpenRunsStorage, kickoffId: string, at = 100) {
  await openRuns.end(kickoffId, { reason: 'complete', endedAt: at });
  await openRuns.close({ kickoffId, threadId: 'thread-1' }, at);
}

/** Runs on the thread's ledger that have not ended; an ended run stays on it until its end is audited. */
async function unended(openRuns: OpenRunsStorage): Promise<FactoryOpenRun[]> {
  const runs: FactoryOpenRun[] = [];
  for (const run of await openRuns.listByThread('thread-1')) {
    if (!(await openRuns.get(run.kickoffId))?.end) runs.push(run);
  }
  return runs;
}

async function replicas() {
  const database = await createSharedFactoryDatabaseForTests();
  const a = await database.connect('replica-a');
  const b = await database.connect('replica-b');
  return { a: a.openRuns, b: b.openRuns };
}

describe('OpenRunsStorage', () => {
  it('round-trips a run, leaving fields it never had absent', async () => {
    const { openRuns } = await createFactoryStorageForTests();
    const bare = openRun('kickoff-1');
    const full = openRun('kickoff-2', { workItemName: 'Fix it', ownerId: 'w', heartbeatAt: 5, startedAt: 4 });

    await expect(openRuns.open(bare)).resolves.toBe(true);
    await expect(openRuns.open(full)).resolves.toBe(true);
    await expect(openRuns.open({ ...bare, ownerId: 'someone' })).resolves.toBe(false);

    await expect(openRuns.listByThread('thread-1')).resolves.toEqual([bare, full]);
    await expect(openRuns.listByThread('thread-2')).resolves.toEqual([]);
  });

  it("renews only its owner's claim, and never reopens an ended run", async () => {
    const { openRuns } = await createFactoryStorageForTests();
    await openRuns.open(LOST);

    await expect(openRuns.heartbeat('kickoff-1', 'another-worker', 9)).resolves.toBe(false);
    await expect(openRuns.heartbeat('kickoff-1', 'lost-worker', 9)).resolves.toBe(true);
    await openRuns.end('kickoff-1', { reason: 'complete', endedAt: 10 });
    await expect(openRuns.heartbeat('kickoff-1', 'lost-worker', 10)).resolves.toBe(false);
    await openRuns.close(LOST, 10);
    await expect(openRuns.heartbeat('kickoff-1', 'lost-worker', 11)).resolves.toBe(false);

    await expect(openRuns.listByThread('thread-1')).resolves.toEqual([]);
  });

  it('keeps the first end of a run, readable after the run leaves the ledger', async () => {
    const { openRuns } = await createFactoryStorageForTests();
    await openRuns.open(LOST);
    await expect(openRuns.get('kickoff-1')).resolves.toEqual({ run: LOST });

    await expect(openRuns.end('kickoff-1', { reason: 'error', endedAt: 10 })).resolves.toBe(true);
    await expect(openRuns.end('kickoff-1', { reason: 'complete', endedAt: 11 })).resolves.toBe(false);
    // Ended, but on the ledger until its end is on the audit log.
    await expect(openRuns.listByThread('thread-1')).resolves.toEqual([LOST]);

    await openRuns.close(LOST, 12);
    await expect(openRuns.listByThread('thread-1')).resolves.toEqual([]);
    await expect(openRuns.get('kickoff-1')).resolves.toEqual({ run: LOST, end: { reason: 'error', endedAt: 10 } });
    await expect(openRuns.end('kickoff-unknown', { reason: 'complete', endedAt: 10 })).resolves.toBe(false);
  });

  it("prunes a thread's closed runs once they are past retention, keeping recent ones and other threads'", async () => {
    const { openRuns } = await createFactoryStorageForTests();
    const old = openRun('kickoff-old');
    const recent = openRun('kickoff-recent');
    const elsewhere = openRun('kickoff-elsewhere', { threadId: 'thread-2' });
    const open = openRun('kickoff-open');
    for (const run of [old, recent, elsewhere, open]) await openRuns.open(run);
    for (const run of [old, elsewhere]) {
      await openRuns.end(run.kickoffId, { reason: 'complete', endedAt: 1 });
      await openRuns.close(run, 1);
    }
    const now = 1 + FACTORY_RUN_END_RETENTION_MS;
    await openRuns.end(recent.kickoffId, { reason: 'aborted', endedAt: now });
    await openRuns.close(recent, now);

    await expect(openRuns.get(old.kickoffId)).resolves.toBeUndefined();
    await expect(openRuns.get(recent.kickoffId)).resolves.toMatchObject({ end: { reason: 'aborted' } });
    await expect(openRuns.get(elsewhere.kickoffId)).resolves.toMatchObject({ end: { reason: 'complete' } });
    await expect(openRuns.listByThread('thread-1')).resolves.toEqual([open]);
  });

  it('knows a kickoff it opened, ended or imported, and no other', async () => {
    const { openRuns } = await createFactoryStorageForTests();
    await openRuns.open(openRun('kickoff-open'));
    await openRuns.open(openRun('kickoff-closed'));
    await openRuns.end('kickoff-closed', { reason: 'complete', endedAt: 1 });
    await openRuns.close(openRun('kickoff-closed'), 1);
    await openRuns.importLegacy('thread-1', [openRun('kickoff-imported', { heartbeatAt: 1 })], 100);

    await expect(
      openRuns.known(['kickoff-open', 'kickoff-closed', 'kickoff-imported', 'kickoff-unknown']),
    ).resolves.toEqual(new Set(['kickoff-open', 'kickoff-closed', 'kickoff-imported']));
    await expect(openRuns.known([])).resolves.toEqual(new Set());
  });

  it('copies only legacy runs naming the thread read, and none with a heartbeat from the future', async () => {
    const { openRuns } = await createFactoryStorageForTests();
    const elsewhere = openRun('kickoff-elsewhere', { threadId: 'thread-2' });
    const future = openRun('kickoff-future', { ownerId: 'forged', heartbeatAt: 1_000 });
    const stale = openRun('kickoff-stale', { ownerId: 'gone', heartbeatAt: 10 });

    await openRuns.importLegacy('thread-1', [elsewhere, future, stale], 100);

    await expect(openRuns.listByThread('thread-1')).resolves.toEqual([stale]);
    await expect(openRuns.listByThread('thread-2')).resolves.toEqual([]);
  });

  it('swaps the lost runs it read for the resumed run', async () => {
    const { openRuns } = await createFactoryStorageForTests();
    const lostRetry = openRun('kickoff-1:retry:1');
    await openRuns.open(LOST);
    await openRuns.open(lostRetry);
    const resume = openRun('kickoff-1:resume:2', { ownerId: 'worker-2', heartbeatAt: 50 });

    await expect(openRuns.takeOver([LOST, lostRetry], resume)).resolves.toBe(true);

    await expect(unended(openRuns)).resolves.toEqual([resume]);
    // A waiter on a lost run reads it as aborted; it stays on the ledger until that end is audited.
    await expect(openRuns.get(LOST.kickoffId)).resolves.toMatchObject({ end: { reason: 'aborted' } });
    const ledger = await openRuns.listByThread('thread-1');
    expect(ledger).toHaveLength(3);
    expect(ledger).toEqual(expect.arrayContaining([LOST, lostRetry, resume]));
    await expect(openRuns.heartbeat(LOST.kickoffId, 'lost-worker', 60)).resolves.toBe(false);
  });

  describe('across replicas', () => {
    it('keeps every run when replicas open runs on the same thread at once', async () => {
      const { a, b } = await replicas();
      const runs = Array.from({ length: 10 }, (_, i) => openRun(`kickoff-${i}`, { ownerId: `worker-${i % 2}` }));

      await Promise.all(runs.map((run, i) => (i % 2 ? b : a).open(run)));

      const ledger = await a.listByThread('thread-1');
      expect(ledger).toHaveLength(10);
      expect(ledger).toEqual(expect.arrayContaining(runs));
    });

    it("ends one run and renews another on the same thread without touching each other's rows", async () => {
      const { a, b } = await replicas();
      const other = openRun('kickoff-2', { ownerId: 'worker-b', heartbeatAt: 1 });
      await a.open(LOST);
      await b.open(other);

      const [, renewed] = await Promise.all([finish(a, 'kickoff-1'), b.heartbeat('kickoff-2', 'worker-b', 60)]);

      expect(renewed).toBe(true);
      await expect(a.listByThread('thread-1')).resolves.toEqual([{ ...other, heartbeatAt: 60 }]);
    });

    it('does not bring an ended run back when its heartbeat races the end', async () => {
      const { a, b } = await replicas();
      await a.open(LOST);

      await Promise.all([finish(a, 'kickoff-1'), b.heartbeat('kickoff-1', 'lost-worker', 60)]);

      await expect(a.listByThread('thread-1')).resolves.toEqual([]);
    });

    it('keeps exactly one end when two replicas end the same run at once', async () => {
      const { a, b } = await replicas();
      await a.open(LOST);

      const ended = await Promise.all([
        a.end('kickoff-1', { reason: 'complete', endedAt: 10 }),
        b.end('kickoff-1', { reason: 'error', endedAt: 11 }),
      ]);

      expect(ended.filter(Boolean)).toHaveLength(1);
      const winner = ended[0] ? { reason: 'complete', endedAt: 10 } : { reason: 'error', endedAt: 11 };
      await expect(b.get('kickoff-1')).resolves.toEqual({ run: LOST, end: winner });
    });

    it('keeps a run another replica opens while a takeover runs on the same thread', async () => {
      const { a, b } = await replicas();
      await a.open(LOST);
      const resume = openRun('kickoff-1:resume:2', { ownerId: 'worker-a', heartbeatAt: 50 });
      const opened = openRun('kickoff-9', { ownerId: 'worker-b', heartbeatAt: 50 });

      const [tookOver, started] = await Promise.all([a.takeOver([LOST], resume), b.open(opened)]);

      expect([tookOver, started]).toEqual([true, true]);
      const ledger = await unended(a);
      expect(ledger).toHaveLength(2);
      expect(ledger).toEqual(expect.arrayContaining([resume, opened]));
    });

    it('does not bring a lost run back when its old owner heartbeats around the takeover', async () => {
      const { a, b } = await replicas();
      await a.open(LOST);
      const resume = openRun('kickoff-1:resume:2', { ownerId: 'worker-a', heartbeatAt: 50 });

      const [tookOver, renewed] = await Promise.all([
        a.takeOver([LOST], resume),
        b.heartbeat('kickoff-1', 'lost-worker', 60),
      ]);

      const ledger = await unended(a);
      // Exactly one side wins: the takeover replaced the lost run, or the heartbeat proved it alive.
      expect(tookOver).toBe(!renewed);
      expect(ledger).toEqual(tookOver ? [resume] : [{ ...LOST, heartbeatAt: 60 }]);
    });

    it('refuses a takeover once the lost run heartbeated after it was read', async () => {
      const { a, b } = await replicas();
      await a.open(LOST);

      await expect(b.heartbeat('kickoff-1', 'lost-worker', 60)).resolves.toBe(true);
      await expect(a.takeOver([LOST], openRun('kickoff-1:resume:2', { ownerId: 'worker-a' }))).resolves.toBe(false);
      await expect(b.heartbeat('kickoff-1', 'lost-worker', 70)).resolves.toBe(true);

      await expect(a.listByThread('thread-1')).resolves.toEqual([{ ...LOST, heartbeatAt: 70 }]);
    });

    it('lets exactly one of two takeovers of the same lost run win', async () => {
      const { a, b } = await replicas();
      await a.open(LOST);
      const resumeA = openRun('kickoff-1:resume:2', { ownerId: 'worker-a', heartbeatAt: 50 });
      const resumeB = openRun('kickoff-1:resume:3', { ownerId: 'worker-b', heartbeatAt: 50 });

      const results = await Promise.all([a.takeOver([LOST], resumeA), b.takeOver([LOST], resumeB)]);

      expect(results.filter(Boolean)).toHaveLength(1);
      await expect(unended(a)).resolves.toEqual([results[0] ? resumeA : resumeB]);
    });

    it('copies a legacy run once, so a copied run that ended does not come back', async () => {
      const { a, b } = await replicas();

      await Promise.all([a.importLegacy('thread-1', [LOST], 100), b.importLegacy('thread-1', [LOST], 100)]);
      await expect(a.listByThread('thread-1')).resolves.toEqual([LOST]);

      await finish(a, 'kickoff-1');
      // Even once the closed row is pruned.
      await a.close(openRun('kickoff-later'), 1 + 100 + FACTORY_RUN_END_RETENTION_MS);
      await expect(a.get('kickoff-1')).resolves.toBeUndefined();
      await b.importLegacy('thread-1', [LOST], 200);
      await expect(a.listByThread('thread-1')).resolves.toEqual([]);
    });
  });
});
