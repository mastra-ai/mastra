import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests, createSharedFactoryDatabaseForTests } from '../../test-utils.js';
import type { FactoryOpenRun } from './base.js';

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
    await openRuns.close('kickoff-1');
    await expect(openRuns.heartbeat('kickoff-1', 'lost-worker', 10)).resolves.toBe(false);

    await expect(openRuns.listByThread('thread-1')).resolves.toEqual([]);
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

      const [, renewed] = await Promise.all([a.close('kickoff-1'), b.heartbeat('kickoff-2', 'worker-b', 60)]);

      expect(renewed).toBe(true);
      await expect(a.listByThread('thread-1')).resolves.toEqual([{ ...other, heartbeatAt: 60 }]);
    });

    it('does not bring an ended run back when its heartbeat races the end', async () => {
      const { a, b } = await replicas();
      await a.open(LOST);

      await Promise.all([a.close('kickoff-1'), b.heartbeat('kickoff-1', 'lost-worker', 60)]);

      await expect(a.listByThread('thread-1')).resolves.toEqual([]);
    });

    it('copies a legacy run once, so a copied run that ended does not come back', async () => {
      const { a, b } = await replicas();

      const [copiedA, copiedB] = await Promise.all([a.importLegacy([LOST]), b.importLegacy([LOST])]);
      expect([copiedA, copiedB]).toEqual([['kickoff-1'], ['kickoff-1']]);
      await expect(a.listByThread('thread-1')).resolves.toEqual([LOST]);

      await a.close('kickoff-1');
      await expect(b.importLegacy([LOST])).resolves.toEqual(['kickoff-1']);
      await expect(a.listByThread('thread-1')).resolves.toEqual([]);
    });
  });
});
