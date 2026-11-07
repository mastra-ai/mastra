import { describe, expect, it, vi } from 'vitest';

import type { BoardTransitionPolicy } from '../boards/index.js';
import { createBoardRegistry, defineBoard, workItemPhaseSemantics } from '../boards/index.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { createTerminalStageCleanup } from './terminal-cleanup.js';
import { FactoryTransitionService } from './transition-service.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function setup(options: { reject?: boolean } = {}) {
  const seed = await createFactoryStorageForTests();
  const storage = seed.workItems;
  const policy = vi.fn<BoardTransitionPolicy>(context =>
    options.reject && context.toStage === 'preparing'
      ? { type: 'reject', code: 'forbidden', reason: 'Release blocked' }
      : undefined,
  );
  const release = defineBoard({
    id: 'release',
    name: 'Release',
    initialPhase: 'queued',
    phases: {
      queued: { name: 'Queued', kind: 'resting', nextPhases: ['preparing'] },
      preparing: {
        name: 'Preparing',
        kind: 'working',
        runner: { context: 'release-preparer', skill: 'prepare-release' },
        nextPhases: ['shipped'],
      },
      shipped: { name: 'Shipped', kind: 'terminal' },
    },
    transitionPolicy: policy,
  });
  const distribution = defineBoard({
    id: 'distribution',
    name: 'Distribution',
    initialPhase: 'waiting',
    phases: { waiting: { name: 'Waiting', kind: 'resting' } },
  });
  const unrelated = defineBoard({
    id: 'unrelated',
    name: 'Unrelated',
    initialPhase: 'queued',
    phases: {
      queued: { name: 'Queued', kind: 'resting', nextPhases: ['working'] },
      working: { name: 'Working', kind: 'working', runner: { context: 'other', skill: 'other-skill' } },
    },
  });
  const boards = createBoardRegistry({ boards: [release, distribution, unrelated], includeDefaultBoards: false });
  storage.useTerminalPhasePredicate(item => workItemPhaseSemantics(boards, item)?.kind === 'terminal');
  const releaseSandboxes = vi.fn(async () => {});
  const service = new FactoryTransitionService({
    storage,
    boards,
    configVersion: 'custom-lifecycle-v1',
    onTerminalStage: createTerminalStageCleanup({ workItems: storage, releaseSandboxes }),
  });
  const { item } = await storage.upsert({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    input: {
      board: 'release',
      externalSource: { integrationId: 'github', type: 'issue', externalId: 'release:42' },
      title: 'Release',
      stages: ['queued'],
      sessions: {},
      metadata: {},
    },
  });
  const move = async (stage: string, identity: string, flags: { initialEntry?: boolean; reenter?: boolean } = {}) => {
    const current = await storage.get({ orgId: 'org-1', id: item.id });
    if (!current) throw new Error('Missing release');
    return service.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'release',
      stage,
      expectedRevision: current.revision,
      actor: { type: 'system', id: 'release-coordinator' },
      ingress: { type: 'human', identity },
      cause: 'release-test',
      ...flags,
    });
  };
  const dispatcher = new FactoryDecisionDispatcher({
    storage,
    boards,
    transitionService: service,
    controller: {} as never,
    isAutoRunEnabled: async () => true,
  });
  return {
    storage,
    db: seed.storage.ops,
    service,
    item,
    move,
    policy,
    dispatcher,
    releaseSandboxes,
  };
}

describe('custom board lifecycle integration without built-in boards', () => {
  it("starts only the entered phase's runner, and terminal entry revokes the run's binding", async () => {
    const h = await setup();
    // Arriving in a resting phase starts nothing.
    expect(await h.move('queued', 'initial', { initialEntry: true })).toMatchObject({ status: 'accepted' });
    expect(await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);

    expect(await h.move('preparing', 'prepare')).toMatchObject({ status: 'accepted' });
    expect(h.policy.mock.calls.at(-1)![0]).toMatchObject({
      board: 'release',
      actor: { type: 'system', id: 'release-coordinator' },
      configVersion: 'custom-lifecycle-v1',
      source: 'issue',
      fromStage: 'queued',
      toStage: 'preparing',
      tenant: { orgId: 'org-1', projectId: PROJECT_ID },
    });
    const runs = await h.storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(runs.map(run => run.decision)).toEqual([
      expect.objectContaining({
        type: 'invokeSkill',
        role: 'release-preparer',
        skillName: 'prepare-release',
        idempotencyKey: 'prepare:preparing:prepare-release',
        startsAfterOwnMove: true,
      }),
    ]);

    const prepared = await h.storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: h.item.id,
        input: { board: 'release', title: 'Release', stages: ['preparing'], sessions: {}, metadata: {} },
      },
      role: 'release-preparer',
      session: { sessionId: 'release-session', threadId: 'release-thread', branch: 'release-branch' },
      resourceId: 'release-resource',
      kickoffKey: 'release-start',
      kickoffMessage: null,
    });
    expect(prepared.binding.status).toBe('active');

    expect(await h.move('shipped', 'ship')).toMatchObject({ status: 'accepted' });
    await vi.waitFor(async () =>
      expect(await h.storage.listRunBindings('org-1', PROJECT_ID)).toEqual([
        expect.objectContaining({ id: prepared.binding.id, status: 'revoked' }),
      ]),
    );
    expect(h.releaseSandboxes).toHaveBeenCalledOnce();
    expect(await h.storage.get({ orgId: 'org-1', id: h.item.id })).toMatchObject({
      board: 'release',
      stages: ['shipped'],
    });
    // A terminal phase has no runner: shipping queued nothing further.
    expect(await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).toHaveLength(1);
    const audits = await h.db.findMany('factory_rule_evaluations', {});
    expect(audits.length).toBeGreaterThanOrEqual(3);
    expect(audits.every(row => row.rule_set_version === 'custom-lifecycle-v1')).toBe(true);
  });

  it("keeps the card and queues nothing when the board's policy rejects the move", async () => {
    const h = await setup({ reject: true });
    expect(await h.move('preparing', 'rejected')).toMatchObject({ status: 'rejected', code: 'forbidden' });
    expect(await h.storage.get({ orgId: 'org-1', id: h.item.id })).toMatchObject({
      stages: ['queued'],
      revision: h.item.revision,
    });
    expect(await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).toHaveLength(0);
    await h.dispatcher.runOnce();
    expect(h.releaseSandboxes).not.toHaveBeenCalled();
  });

  it('starts nothing when a card of any source arrives in a resting phase', async () => {
    const h = await setup();
    const { item } = await h.storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        board: 'distribution',
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'distribution-pr:1' },
        title: 'Distribution PR',
        stages: ['waiting'],
        sessions: {},
        metadata: {},
      },
    });
    expect(
      await h.service.transition({
        orgId: 'org-1',
        factoryProjectId: PROJECT_ID,
        workItemId: item.id,
        board: 'distribution',
        stage: 'waiting',
        expectedRevision: item.revision,
        initialEntry: true,
        actor: { type: 'system', id: 'release-coordinator' },
        ingress: { type: 'human', identity: 'undeclared-source' },
        cause: 'release-test',
      }),
    ).toMatchObject({ status: 'accepted' });
    expect(await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });

  it('distinguishes committed replay from explicit reentry', async () => {
    const h = await setup();
    const result = await h.move('preparing', 'prepare');
    expect(await h.move('preparing', 'prepare')).toEqual(result);
    expect(await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).toHaveLength(1);
    expect(await h.move('preparing', 'reenter', { reenter: true })).toMatchObject({ status: 'accepted' });
    const runs = (await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).map(run => run.decision);
    expect(runs).toHaveLength(2);
    // Re-entering supersedes the run in flight and resumes the skill.
    expect(runs).toContainEqual(
      expect.objectContaining({
        idempotencyKey: 'reenter:preparing:prepare-release',
        cancelInFlight: true,
        resume: true,
      }),
    );
  });
});
