/**
 * The sweep's emit call site against real storage: after reconciliation, every
 * open finding whose notification stamp is null is emitted once and stamped;
 * stamped rows are silent on later sweeps; a reopened finding re-rings.
 */

import type { WorkerDeps } from '@mastra/core/worker';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { FactorySupervisorHealthWorker } from './health-worker.js';
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
