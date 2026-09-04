/**
 * The sweep's emit call site against real storage: after reconciliation, every
 * open finding whose notification stamp is null is emitted once and stamped;
 * stamped rows are silent on later sweeps; a reopened finding re-rings.
 */

import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { EMIT_PAGE_SIZE, FactorySupervisorHealthWorker } from './health-worker.js';
import { runFactoryHealthCheck, SUPERVISOR_ATTENTION_FORCE_SURFACE_MS } from './health.js';
import type { NotifySupervisorInput } from './notify.js';

let seed: FactoryStorageTestSeed;
let PROJECT_ID = '';

function createDeps(): WorkerDeps & { warn: ReturnType<typeof vi.fn> } {
  const warn = vi.fn();
  return {
    pubsub: {} as WorkerDeps['pubsub'],
    storage: {} as WorkerDeps['storage'],
    logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() } as unknown as WorkerDeps['logger'],
    warn,
  };
}

async function seedWorkItem(): Promise<WorkItemRow> {
  const { item } = await seed.workItems.upsert({
    orgId: 'org1',
    userId: 'u1',
    factoryProjectId: PROJECT_ID,
    input: { title: 'Fix login', stages: ['building'], sessions: {}, metadata: {} },
  });
  return item;
}

async function seedFailure(workItem: WorkItemRow, now: Date) {
  await seed.workItems.commitRuleEvaluation({
    orgId: 'org1',
    factoryProjectId: PROJECT_ID,
    workItemId: workItem.id,
    ingress: { identity: `sweep-failure-${now.getTime()}`, triggerType: 'test' },
    ruleSetVersion: 'rules-v1',
    expectedRevision: (await seed.workItems.get({ orgId: 'org1', id: workItem.id }))?.revision ?? workItem.revision,
    actor: { type: 'system', id: 'rules' },
    outcome: { status: 'accepted' },
    decisions: [
      { type: 'sendMessage', role: 'work', message: 'Notify.', idempotencyKey: `sweep-failure-${now.getTime()}` },
    ],
    causalChain: [],
    now,
  });
  const [claimed] = await seed.workItems.claimDeferredDecisions({
    ownerId: 'worker-1',
    now,
    leaseExpiresAt: new Date(now.getTime() + 60_000),
    limit: 1,
  });
  if (!claimed) throw new Error('Expected a deferred decision');
  await seed.workItems.failDeferredDecision({
    id: claimed.id,
    orgId: claimed.orgId,
    factoryProjectId: claimed.factoryProjectId,
    ownerId: 'worker-1',
    now,
    availableAt: now,
    lastError: 'No active Factory binding for role work.',
    failureCode: 'session_unavailable',
    terminal: true,
  });
}

/** One full sweep: start fires the immediate tick; stop waits for it. */
async function sweep(worker: FactorySupervisorHealthWorker) {
  await worker.start();
  await new Promise(resolve => setTimeout(resolve, 0));
  await worker.stop();
}

function openFindings() {
  return seed.workItems.listSupervisorFindingPage({ orgId: 'org1', factoryProjectId: PROJECT_ID, limit: 50 });
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'org1 project' } });
  PROJECT_ID = project.id;
});

describe('FactorySupervisorHealthWorker emit call site', () => {
  it('emits once for a newly opened finding and stamps last_notified_at', async () => {
    await seedFailure(await seedWorkItem(), new Date());
    const notify = vi.fn(async (_input: NotifySupervisorInput) => {});
    const worker = new FactorySupervisorHealthWorker({ projects: seed.projects, workItems: seed.workItems, notify });
    await worker.init(createDeps());

    await sweep(worker);

    const { rows } = await openFindings();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastNotifiedAt).toBeInstanceOf(Date);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]?.[0]).toMatchObject({
      projectId: PROJECT_ID,
      findingKey: rows[0]?.findingKey,
      kind: 'decision-failed',
    });
    expect(notify.mock.calls[0]?.[0].summary).toContain('session_unavailable');
  });

  it('does not re-emit for a still-open finding that is already stamped', async () => {
    await seedFailure(await seedWorkItem(), new Date());
    const notify = vi.fn(async (_input: NotifySupervisorInput) => {});
    const worker = new FactorySupervisorHealthWorker({ projects: seed.projects, workItems: seed.workItems, notify });
    await worker.init(createDeps());

    await sweep(worker);
    await sweep(worker);

    expect(notify).toHaveBeenCalledTimes(1);
    expect((await openFindings()).rows).toHaveLength(1);
  });

  it('re-emits when a resolved finding reopens (reopen clears the stamp)', async () => {
    await seedFailure(await seedWorkItem(), new Date());
    const notify = vi.fn(async (_input: NotifySupervisorInput) => {});
    const worker = new FactorySupervisorHealthWorker({ projects: seed.projects, workItems: seed.workItems, notify });
    await worker.init(createDeps());

    await sweep(worker);
    const [first] = (await openFindings()).rows;
    // Resolve the row out-of-band (an empty snapshot auto-resolves every open row).
    await seed.workItems.syncSupervisorFindings({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      findings: [],
      now: new Date(),
    });
    expect((await openFindings()).rows).toHaveLength(0);

    // The failed decision is still there, so the next sweep recomputes the same finding → reopen.
    await sweep(worker);

    const [reopened] = (await openFindings()).rows;
    expect(reopened?.findingKey).toBe(first?.findingKey);
    expect(first?.occurrence).toBe(0);
    expect(reopened?.occurrence).toBe(1);
    expect(reopened?.lastNotifiedAt).toBeInstanceOf(Date);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('logs and skips a failing emit, leaving the row un-stamped for the next sweep', async () => {
    await seedFailure(await seedWorkItem(), new Date());
    const notify = vi.fn(async (_input: NotifySupervisorInput) => {}).mockRejectedValueOnce(new Error('storage down'));
    const worker = new FactorySupervisorHealthWorker({ projects: seed.projects, workItems: seed.workItems, notify });
    const deps = createDeps();
    await worker.init(deps);

    await sweep(worker);
    expect(deps.warn).toHaveBeenCalledWith(
      'Factory supervisor notify failed',
      expect.objectContaining({ error: 'storage down' }),
    );
    expect((await openFindings()).rows[0]?.lastNotifiedAt).toBeNull();

    await sweep(worker);
    expect(notify).toHaveBeenCalledTimes(2);
    expect((await openFindings()).rows[0]?.lastNotifiedAt).toBeInstanceOf(Date);
  });

  it('drains more than one page of un-notified findings in a single sweep', async () => {
    const count = EMIT_PAGE_SIZE + 3;
    const base = Date.now();
    for (let i = 0; i < count; i += 1) {
      await seedFailure(await seedWorkItem(), new Date(base + i));
    }
    const notify = vi.fn(async (_input: NotifySupervisorInput) => {});
    const worker = new FactorySupervisorHealthWorker({ projects: seed.projects, workItems: seed.workItems, notify });
    await worker.init(createDeps());

    await sweep(worker);

    expect(notify).toHaveBeenCalledTimes(count);
    const unnotified = await seed.workItems.listUnnotifiedSupervisorFindings({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      limit: 10,
    });
    expect(unnotified).toEqual([]);
  });

  it('attempts every row once per sweep even when an entire leading page fails', async () => {
    const count = EMIT_PAGE_SIZE + 2;
    const base = Date.now();
    for (let i = 0; i < count; i += 1) {
      await seedFailure(await seedWorkItem(), new Date(base + i));
    }
    // Every row on the first page fails; the two rows behind it must still be reached.
    let calls = 0;
    const notify = vi.fn(async (_input: NotifySupervisorInput) => {
      calls += 1;
      if (calls <= EMIT_PAGE_SIZE) throw new Error('storage down');
    });
    const worker = new FactorySupervisorHealthWorker({ projects: seed.projects, workItems: seed.workItems, notify });
    await worker.init(createDeps());

    await sweep(worker);

    expect(notify).toHaveBeenCalledTimes(count);
    const stillUnnotified = await seed.workItems.listUnnotifiedSupervisorFindings({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      limit: count,
    });
    expect(stillUnnotified).toHaveLength(EMIT_PAGE_SIZE);
    // Next sweep retries exactly the failed rows.
    notify.mockImplementation(async () => {});
    await sweep(worker);
    expect(notify).toHaveBeenCalledTimes(count + EMIT_PAGE_SIZE);
    expect(
      await seed.workItems.listUnnotifiedSupervisorFindings({ orgId: 'org1', factoryProjectId: PROJECT_ID, limit: 5 }),
    ).toEqual([]);
  });

  it('sweeps cleanly with no notify handle wired', async () => {
    await seedFailure(await seedWorkItem(), new Date());
    const worker = new FactorySupervisorHealthWorker({ projects: seed.projects, workItems: seed.workItems });
    await worker.init(createDeps());
    await sweep(worker);
    const { rows } = await openFindings();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastNotifiedAt).toBeNull();
  });
});

describe('FactorySupervisorHealthWorker force-surface doorbell', () => {
  const scope = () => ({ orgId: 'org1', factoryProjectId: PROJECT_ID });

  /** Open the sweep's own finding for a real failure, backdated so it is already past the backstop. */
  async function seedStaleFinding() {
    await seedFailure(await seedWorkItem(), new Date());
    const report = await runFactoryHealthCheck(seed.workItems, scope(), { now: new Date() });
    expect(report.findings.map(finding => finding.kind)).toEqual(['decision-failed']);
    const openedAt = new Date(Date.now() - SUPERVISOR_ATTENTION_FORCE_SURFACE_MS - 60_000);
    await seed.workItems.syncSupervisorFindings({ ...scope(), findings: report.findings, now: openedAt });
  }

  it('rings the attention doorbell once when a hidden finding ages past the backstop', async () => {
    await seedStaleFinding();
    const attentionChanged = vi.fn();
    const worker = new FactorySupervisorHealthWorker({
      projects: seed.projects,
      workItems: seed.workItems,
      attentionChanged,
    });
    await worker.init(createDeps());

    // First sweep after boot: the row is visible now and was not "since forever".
    await sweep(worker);
    expect(attentionChanged).toHaveBeenCalledTimes(1);
    expect(attentionChanged).toHaveBeenCalledWith(scope());
    // The row did not change and was already visible at the previous sweep: silence.
    await sweep(worker);
    expect(attentionChanged).toHaveBeenCalledTimes(1);
    const { rows } = await openFindings();
    expect(rows[0]).toMatchObject({ status: 'open', escalationNote: null });
  });

  it('stays silent for findings still inside the backstop window or already escalated', async () => {
    await seedFailure(await seedWorkItem(), new Date());
    const attentionChanged = vi.fn();
    const worker = new FactorySupervisorHealthWorker({
      projects: seed.projects,
      workItems: seed.workItems,
      attentionChanged,
    });
    await worker.init(createDeps());
    await sweep(worker);
    expect(attentionChanged).not.toHaveBeenCalled();

    // Escalation makes the row visible by a write (storage announces that
    // itself); a later sweep must not announce it again as a backstop flip.
    const { rows } = await openFindings();
    await seed.workItems.escalateSupervisorFinding({
      ...scope(),
      findingKey: rows[0]!.findingKey,
      note: 'needs a person',
      escalatedAt: new Date(),
    });
    await sweep(worker);
    expect(attentionChanged).not.toHaveBeenCalled();
  });

  describe('with the clock under control', () => {
    const T0 = new Date('2030-01-01T00:00:00.000Z');

    /** Sweep under fake timers: the immediate tick fires on the advance; stop waits for it. */
    async function fakeSweep(worker: FactorySupervisorHealthWorker) {
      await worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await worker.stop();
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
      vi.setSystemTime(T0);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('rings exactly once when a fresh finding crosses the backstop between sweeps', async () => {
      await seedFailure(await seedWorkItem(), T0);
      const attentionChanged = vi.fn();
      const worker = new FactorySupervisorHealthWorker({
        projects: seed.projects,
        workItems: seed.workItems,
        attentionChanged,
      });
      await worker.init(createDeps());

      await fakeSweep(worker); // opens the finding at T0, inside the window
      expect(attentionChanged).not.toHaveBeenCalled();
      vi.setSystemTime(new Date(T0.getTime() + SUPERVISOR_ATTENTION_FORCE_SURFACE_MS + 1_000));
      await fakeSweep(worker);
      expect(attentionChanged).toHaveBeenCalledTimes(1);
      await fakeSweep(worker);
      expect(attentionChanged).toHaveBeenCalledTimes(1);
    });

    it('still rings on the next good sweep when the crossing happened during a failed one', async () => {
      await seedFailure(await seedWorkItem(), T0);
      const attentionChanged = vi.fn();
      const worker = new FactorySupervisorHealthWorker({
        projects: seed.projects,
        workItems: seed.workItems,
        attentionChanged,
      });
      const deps = createDeps();
      await worker.init(deps);
      await fakeSweep(worker);
      expect(attentionChanged).not.toHaveBeenCalled();

      // The crossing happens inside a tick that fails after reconciliation.
      vi.setSystemTime(new Date(T0.getTime() + SUPERVISOR_ATTENTION_FORCE_SURFACE_MS + 1_000));
      const sync = vi.spyOn(seed.workItems, 'syncSupervisorFindings').mockRejectedValueOnce(new Error('db hiccup'));
      await fakeSweep(worker);
      expect(deps.logger.error).toHaveBeenCalled();
      expect(attentionChanged).not.toHaveBeenCalled();
      sync.mockRestore();

      // The failed tick did not advance the checkpoint, so the next one rings.
      vi.setSystemTime(new Date(T0.getTime() + SUPERVISOR_ATTENTION_FORCE_SURFACE_MS + 2_000));
      await fakeSweep(worker);
      expect(attentionChanged).toHaveBeenCalledTimes(1);
    });

    it('rings again on the next sweep when the doorbell publish itself rejected', async () => {
      await seedFailure(await seedWorkItem(), T0);
      const attentionChanged = vi.fn().mockRejectedValueOnce(new Error('broker down')).mockResolvedValue(undefined);
      const worker = new FactorySupervisorHealthWorker({
        projects: seed.projects,
        workItems: seed.workItems,
        attentionChanged,
      });
      const deps = createDeps();
      await worker.init(deps);
      await fakeSweep(worker);
      expect(attentionChanged).not.toHaveBeenCalled();

      vi.setSystemTime(new Date(T0.getTime() + SUPERVISOR_ATTENTION_FORCE_SURFACE_MS + 1_000));
      await fakeSweep(worker); // publish rejects: sweep fails, checkpoint stays
      expect(attentionChanged).toHaveBeenCalledTimes(1);
      expect(deps.logger.error).toHaveBeenCalled();
      await fakeSweep(worker); // retried
      expect(attentionChanged).toHaveBeenCalledTimes(2);
      await fakeSweep(worker); // announced: silent from here
      expect(attentionChanged).toHaveBeenCalledTimes(2);
    });
  });
});
