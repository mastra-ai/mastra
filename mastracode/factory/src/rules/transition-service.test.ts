import assert from 'node:assert';
import { randomUUID } from 'node:crypto';

import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { compileBoardDefinition } from '../boards/define-board.js';
import type { BoardDefinition } from '../boards/define-board.js';
import { createBoardRegistry, defineBoard, workBoard, workItemPhaseSemantics } from '../boards/index.js';
import { createTestBoard } from '../boards/test-utils.js';
import type { BoardTransitionPolicy } from '../boards/transition-policy.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { decisionOvertaken } from './decision-applicability.js';
import { FactoryTransitionService } from './transition-service.js';
import type { FactoryRuleBoard, FactoryRuleDecision, FactoryRuleStage, FactoryStageRuleContext } from './types.js';
import { MAX_FACTORY_RULE_CAUSAL_DEPTH } from './validation.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

function lifecycleOptions({
  version,
  handlers,
}: {
  version: string;
  handlers: BoardDefinition<string, string>['rules'];
}) {
  const stages = ['intake', 'triage', 'planning', 'execute', 'review', 'done', 'canceled'];
  const board = defineBoard({
    id: 'lifecycle-test',
    title: 'Lifecycle test',
    initialPhase: 'intake',
    phases: Object.fromEntries(
      stages.map(stage => [
        stage,
        {
          title: stage,
          kind: workBoard.phaseKind(stage),
          ...(workBoard.isWorking(stage) ? { role: workBoard.roleForPhase(stage) } : {}),
          outcomes: Object.fromEntries(stages.filter(next => next !== stage).map(next => [next, next])),
          onEnter: Object.fromEntries(
            Object.entries(handlers[stage] ?? {}).map(([source, leaf]) => [source, leaf?.onEnter]),
          ),
          onExit: Object.fromEntries(
            Object.entries(handlers[stage] ?? {}).map(([source, leaf]) => [source, leaf?.onExit]),
          ),
        },
      ]),
    ),
  });
  return {
    configVersion: version,
    boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
  };
}

async function createItem(
  storage: WorkItemsStorage,
  overrides: Partial<{
    orgId: string;
    source: 'github-issue' | 'github-pr' | 'gitlab-pr' | 'slack-thread';
    sourceKey: string;
    board: string;
    stages: string[];
    metadata: Record<string, unknown>;
  }> = {},
) {
  const orgId = overrides.orgId ?? 'org-1';
  const source = overrides.source ?? 'github-issue';
  return (
    await storage.upsert({
      orgId,
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        ...(overrides.board ? { board: overrides.board } : {}),
        externalSource: {
          integrationId: source === 'slack-thread' ? 'slack' : source === 'gitlab-pr' ? 'gitlab' : 'github',
          type: source === 'slack-thread' ? 'slack-thread' : source.endsWith('-pr') ? 'pull-request' : 'issue',
          externalId: overrides.sourceKey ?? '1',
        },
        title: 'Fix the bug',
        stages: overrides.stages ?? ['intake'],
        sessions: {},
        metadata: overrides.metadata ?? {},
      },
    })
  ).item;
}

function request(
  item: { id: string; revision: number; board?: string | null },
  overrides: Partial<{
    orgId: string;
    board: FactoryRuleBoard;
    stage: FactoryRuleStage;
    expectedRevision: number;
    identity: string;
    causalChain: Array<{ ingressId: string; decisionType: 'transition' }>;
  }> = {},
) {
  return {
    orgId: overrides.orgId ?? 'org-1',
    factoryProjectId: PROJECT_ID,
    workItemId: item.id,
    board: overrides.board ?? item.board ?? ('work' as const),
    stage: overrides.stage ?? ('execute' as const),
    expectedRevision: overrides.expectedRevision ?? item.revision,
    actor: { type: 'human' as const, id: 'user-1' },
    ingress: { type: 'human' as const, identity: overrides.identity ?? 'request-1' },
    cause: 'test',
    causalChain: overrides.causalChain,
  };
}

describe('installed lifecycle decision targets', () => {
  const linkedDecision = {
    type: 'upsertLinkedWorkItem' as const,
    idempotencyKey: 'release-linked',
    board: 'distribution',
    stage: 'waiting',
    source: 'github-issue' as const,
    sourceKey: 'mastra-ai/mastra#42',
    title: 'Distribute release',
    url: 'https://github.com/mastra-ai/mastra/issues/42',
  };
  const transitionDecision = {
    type: 'transition' as const,
    idempotencyKey: 'release-shipped',
    board: 'release',
    stage: 'shipped',
  };

  async function setup(exit: FactoryRuleDecision, enter: FactoryRuleDecision) {
    const storage = (await createFactoryStorageForTests()).workItems;
    const onExit = vi.fn(() => exit);
    const onEnter = vi.fn(() => enter);
    const release = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { title: 'Queued', kind: 'resting', next: 'preparing', onExit: { issue: onExit } },
        preparing: {
          title: 'Preparing',
          kind: 'working',
          role: 'release-preparer',
          next: 'shipped',
          onEnter: { issue: onEnter },
        },
        shipped: { title: 'Shipped', kind: 'terminal' },
      },
    });
    const distribution = defineBoard({
      id: 'distribution',
      title: 'Distribution',
      initialPhase: 'waiting',
      phases: { waiting: { title: 'Waiting', kind: 'resting' } },
    });
    const item = await createItem(storage, { board: 'release', stages: ['queued'] });
    const service = new FactoryTransitionService({
      storage,
      configVersion: 'release-targets-v1',
      boards: createBoardRegistry({ boards: [release, distribution], includeDefaultBoards: false }),
    });
    const input = {
      ...request(item, { stage: 'preparing' }),
      actor: { type: 'system' as const, id: 'release-coordinator' },
      ingress: { type: 'rule' as const, identity: 'release-prepare' },
    };
    return { storage, item, service, input, onExit, onEnter };
  }

  it('accepts custom lifecycle transitions and cross-installed linked items before persistence', async () => {
    const { storage, item, service, input, onExit, onEnter } = await setup(linkedDecision, transitionDecision);
    const result = await service.transition(input);
    expect(result).toMatchObject({ status: 'accepted', stage: 'preparing' });
    expect(onEnter).toHaveBeenCalledWith(expect.objectContaining({ configVersion: 'release-targets-v1' }));
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      board: 'release',
      stages: ['preparing'],
      revision: item.revision + 1,
    });
    const decisions = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(decisions).toHaveLength(2);
    expect(decisions.map(record => record.decision)).toEqual(
      expect.arrayContaining([linkedDecision, transitionDecision]),
    );

    const restarted = new FactoryTransitionService({
      storage,
      configVersion: 'release-targets-v2',
      boards: createBoardRegistry({ includeDefaultBoards: false }),
    });
    expect(await restarted.transition(input)).toEqual(result);
    expect(onExit).toHaveBeenCalledOnce();
    expect(onEnter).toHaveBeenCalledOnce();
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toHaveLength(2);
  });

  it.each([
    ['unknown transition board', { ...transitionDecision, board: 'missing' }],
    ['unknown transition phase', { ...transitionDecision, stage: 'missing' }],
    ['phase belonging to another board', { ...transitionDecision, stage: 'waiting' }],
    ['transition board reassignment', { ...transitionDecision, board: 'distribution', stage: 'waiting' }],
    ['unknown linked board', { ...linkedDecision, board: 'missing' }],
    ['foreign linked phase', { ...linkedDecision, stage: 'preparing' }],
  ] as const)('rejects %s atomically after an earlier valid lifecycle decision', async (_label, decision) => {
    const { storage, item, service, input, onExit, onEnter } = await setup(linkedDecision, decision);
    expect(await service.transition(input)).toMatchObject({ status: 'rejected', code: 'rule_error' });
    expect(onExit).toHaveBeenCalledOnce();
    expect(onEnter).toHaveBeenCalledOnce();
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      board: 'release',
      stages: ['queued'],
      revision: item.revision,
    });
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });

  it('rejects an invalid exit target before invoking entry or persisting effects', async () => {
    const { storage, item, service, input, onExit, onEnter } = await setup(
      { ...linkedDecision, stage: 'missing' },
      transitionDecision,
    );
    expect(await service.transition(input)).toMatchObject({ status: 'rejected', code: 'rule_error' });
    expect(onExit).toHaveBeenCalledOnce();
    expect(onEnter).not.toHaveBeenCalled();
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      stages: ['queued'],
      revision: item.revision,
    });
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });
});

describe('installed board transition policies', () => {
  async function setup(
    transitionPolicy?: BoardTransitionPolicy,
    onEnter: (context: FactoryStageRuleContext) => undefined | Promise<undefined> = () => undefined,
  ) {
    const storage = (await createFactoryStorageForTests()).workItems;
    const board = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'approval',
      transitionPolicy,
      phases: {
        approval: { title: 'Approval', kind: 'resting', next: 'shipped' },
        shipped: { title: 'Shipped', kind: 'working', role: 'release', onEnter: { issue: onEnter } },
      },
    });
    const item = await createItem(storage, { board: board.id, stages: ['approval'] });
    const service = new FactoryTransitionService({
      storage,
      configVersion: 'policy-test',
      boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
    });
    return { storage, board, item, service };
  }

  it('lets an installed release policy reject before lifecycle or writes', async () => {
    const onEnter = vi.fn(() => undefined);
    const { storage, item, service } = await setup(
      context =>
        context.isHumanTransition
          ? undefined
          : { type: 'reject', code: 'approval_required', reason: 'Approve the release.' },
      onEnter,
    );
    const result = await service.transition({
      ...request(item, { stage: 'shipped' }),
      actor: { type: 'system', id: 'sweep' },
      ingress: { type: 'rule', identity: 'release-denied' },
    });
    expect(result).toMatchObject({ status: 'rejected', code: 'approval_required' });
    expect(onEnter).not.toHaveBeenCalled();
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      revision: item.revision,
      stages: ['approval'],
      acceptedAt: null,
      triageType: null,
    });
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
    expect(await service.transition(request(item, { stage: 'shipped' }))).toMatchObject({ status: 'accepted' });
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it('evaluates policy on same-stage, initial entry and reentry but never on completed replay', async () => {
    const policy = vi.fn<BoardTransitionPolicy>(() => undefined);
    const { item, service, storage } = await setup(policy);
    for (const flags of [{}, { initialEntry: true }, { reenter: true }]) {
      const current = await storage.get({ orgId: 'org-1', id: item.id });
      assert(current);
      const input = { ...request(current, { stage: 'approval', identity: JSON.stringify(flags) }), ...flags };
      const result = await service.transition(input);
      expect(result.status).toBe('accepted');
      expect(await service.transition(input)).toEqual(result);
    }
    expect(policy).toHaveBeenCalledTimes(3);
    expect(policy.mock.calls[1][0]).toMatchObject({ initialEntry: true, reenter: false });
    expect(policy.mock.calls[2][0]).toMatchObject({ initialEntry: false, reenter: true });
  });

  it('fires the approval hook once for a person moving a Work card on, never for stale requests', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const onAccepted = vi.fn();
    const service = new FactoryTransitionService({ storage, configVersion: 'policy-test', onAccepted });
    expect(
      await service.transition(
        request(item, { stage: 'planning', expectedRevision: item.revision + 1, identity: 'stale' }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'stale' });
    expect(onAccepted).not.toHaveBeenCalled();
    const input = request(item, { stage: 'planning' });
    expect(await service.transition(input)).toMatchObject({ status: 'accepted' });
    expect(await service.transition(input)).toMatchObject({ status: 'accepted' });
    await vi.waitFor(() => expect(onAccepted).toHaveBeenCalledOnce());
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({ acceptedAt: null });
  });

  it('lets a retry commit under the identity that lost a revision race', async () => {
    const { item, storage, board } = await setup(() => undefined);
    const service = new FactoryTransitionService({
      storage,
      configVersion: 'policy-test',
      boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
    });
    expect(
      await service.transition(
        request(item, { stage: 'shipped', expectedRevision: item.revision - 1, identity: 'decision:merge' }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'stale' });
    expect(await service.transition(request(item, { stage: 'shipped', identity: 'decision:merge' }))).toMatchObject({
      status: 'accepted',
      stage: 'shipped',
    });
  });

  it('shares the policy/lifecycle timeout and ignores late completion', async () => {
    vi.useFakeTimers();
    try {
      const onEnter = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
        return undefined;
      });
      const policy: BoardTransitionPolicy = async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
        return { type: 'allow', accept: true };
      };
      const { item, storage, board } = await setup(policy, onEnter);
      const service = new FactoryTransitionService({
        storage,
        configVersion: 'policy-test',
        boards: createBoardRegistry({ boards: [board] }),
        timeoutMs: 100,
      });
      const pending = service.transition(request(item, { stage: 'shipped' }));
      await vi.advanceTimersByTimeAsync(100);
      expect(await pending).toMatchObject({ status: 'rejected', code: 'timeout' });
      await vi.advanceTimersByTimeAsync(100);
      expect(onEnter).toHaveBeenCalledOnce();
      expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
        revision: item.revision,
        acceptedAt: null,
        stages: ['approval'],
      });
      expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a malformed policy result before lifecycle', async () => {
    const onEnter = vi.fn(() => undefined);
    // @ts-expect-error Exercise an untyped JavaScript policy at the runtime boundary.
    const { item, service, storage } = await setup(() => ({ type: 'allow', accept: false }), onEnter);
    expect(await service.transition(request(item, { stage: 'shipped' }))).toMatchObject({
      status: 'rejected',
      code: 'rule_error',
    });
    expect(onEnter).not.toHaveBeenCalled();
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      acceptedAt: null,
      revision: item.revision,
    });
  });

  it.each(['error', 'reject'] as const)('discards policy intents on lifecycle %s', async failure => {
    const { item, storage, board } = await setup(() => ({ type: 'allow', accept: true }));
    const rejecting = defineBoard({
      id: board.id,
      name: board.name,
      initialPhase: 'approval',
      transitionPolicy: board.transitionPolicy,
      phases: {
        approval: { title: 'Approval', kind: 'resting', next: 'shipped' },
        shipped: {
          title: 'Shipped',
          kind: 'working',
          role: 'release',
          onEnter: {
            issue: () => {
              if (failure === 'error') throw new Error('Lifecycle failed');
              return { type: 'reject', code: 'forbidden', reason: 'Lifecycle denied' };
            },
          },
        },
      },
    });
    const service = new FactoryTransitionService({
      storage,
      configVersion: 'policy-test',
      boards: createBoardRegistry({ boards: [rejecting] }),
    });
    expect(await service.transition(request(item, { stage: 'shipped' }))).toMatchObject({
      status: 'rejected',
      code: failure === 'error' ? 'rule_error' : 'forbidden',
    });
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      acceptedAt: null,
      revision: item.revision,
    });
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });

  it('keeps identical board IDs isolated across installed registries', async () => {
    const denied = await setup(() => ({ type: 'reject', code: 'forbidden', reason: 'Denied here' }));
    const allowed = await setup(() => ({ type: 'allow' }));
    expect(await denied.service.transition(request(denied.item, { stage: 'shipped' }))).toMatchObject({
      status: 'rejected',
      code: 'forbidden',
    });
    expect(await allowed.service.transition(request(allowed.item, { stage: 'shipped' }))).toMatchObject({
      status: 'accepted',
    });
  });

  it('does not give Review a triage-role classification requirement', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'review', source: 'github-pr', metadata: { authorTrusted: true } });
    const service = new FactoryTransitionService({ storage, configVersion: 'policy-test' });
    expect(
      await service.transition({
        ...request(item, { stage: 'review' }),
        actor: { type: 'agent', bindingId: 'review-agent', role: 'triage' },
        ingress: { type: 'agent', identity: 'review-transition' },
      }),
    ).toMatchObject({ status: 'accepted' });
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({ triageType: null, acceptedAt: null });
  });

  it('keeps external-author safety shared even when a custom policy allows', async () => {
    const onEnter = vi.fn(() => undefined);
    const policy = vi.fn<BoardTransitionPolicy>(() => ({ type: 'allow' }));
    const storage = (await createFactoryStorageForTests()).workItems;
    const board = defineBoard({
      id: 'external',
      title: 'External',
      initialPhase: 'intake',
      transitionPolicy: policy,
      phases: {
        intake: { title: 'Intake', kind: 'resting', next: 'shipping' },
        shipping: { title: 'Shipping', kind: 'working', role: 'shipper', onEnter: { issue: onEnter } },
      },
    });
    const item = await createItem(storage, { board: board.id });
    const service = new FactoryTransitionService({
      storage,
      configVersion: 'policy-test',
      boards: createBoardRegistry({ boards: [board] }),
    });
    expect(
      await service.transition({
        ...request(item, { stage: 'shipping' }),
        actor: { type: 'agent', bindingId: 'bound', role: 'shipper' },
        ingress: { type: 'agent', identity: 'external-resume' },
      }),
    ).toMatchObject({ status: 'rejected', code: 'approval_required' });
    expect(policy).toHaveBeenCalledOnce();
    expect(onEnter).not.toHaveBeenCalled();
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      revision: item.revision,
      stages: ['intake'],
    });
  });

  it('does not invoke policy for topology-invalid requests', async () => {
    const policy = vi.fn<BoardTransitionPolicy>(() => ({ type: 'allow', accept: true }));
    const { item, service } = await setup(policy);
    expect(await service.transition(request(item, { stage: 'execute' }))).toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
    });
    expect(policy).not.toHaveBeenCalled();
  });

  it.each([
    () => ({ type: 'allow', accept: true }),
    () => ({ type: 'allow', triageType: 'bug' }),
  ] satisfies BoardTransitionPolicy[])(
    'ignores the classification and acceptance a policy still asks for',
    async policy => {
      const onEnter = vi.fn(() => undefined);
      const { item, service, storage } = await setup(policy, onEnter);
      expect(
        await service.transition({ ...request(item, { stage: 'shipped' }), actor: { type: 'system', id: 'sweep' } }),
      ).toMatchObject({ status: 'accepted', stage: 'shipped' });
      expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
        acceptedAt: null,
        triageType: null,
        revision: item.revision + 1,
      });
    },
  );

  it('isolates nested policy snapshots from the request and lifecycle', async () => {
    const onEnter = vi.fn((context: FactoryStageRuleContext) => {
      expect(context.actor).toEqual({ type: 'human', id: 'user-1' });
      expect(context.item.stages).toEqual(['approval']);
      return undefined;
    });
    const { item, service } = await setup(context => {
      expect(Reflect.set(context.actor, 'type', 'system')).toBe(false);
      expect(Reflect.set(context.item.stages, '0', 'shipped')).toBe(false);
      expect(Reflect.set(context.item.metadata!, 'autoStartCandidate', true)).toBe(false);
      expect(Reflect.set(context.ingress, 'type', 'agent')).toBe(false);
      return undefined;
    }, onEnter);
    const input = request(item, { stage: 'shipped' });
    expect(await service.transition(input)).toMatchObject({ status: 'accepted' });
    expect(input.actor.type).toBe('human');
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it('does not stamp acceptance or classification on a no-policy board with Work phase and role names', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const board = defineBoard({
      id: 'custom-work',
      title: 'Custom',
      initialPhase: 'intake',
      phases: {
        intake: { title: 'Intake', kind: 'resting', next: 'triage' },
        triage: { title: 'Triage', kind: 'working', role: 'triage', next: 'planning' },
        planning: { title: 'Planning', kind: 'working', role: 'plan', next: 'execute' },
        execute: { title: 'Execute', kind: 'working', role: 'work' },
      },
    });
    const service = new FactoryTransitionService({
      storage,
      configVersion: 'policy-test',
      boards: createBoardRegistry({ boards: [board] }),
    });
    let item = await createItem(storage, { board: board.id, metadata: { authorTrusted: true } });
    for (const stage of ['triage', 'planning']) {
      expect(
        await service.transition({
          ...request(item, { stage, identity: stage }),
          actor: { type: 'agent', bindingId: 'triage-agent', role: 'triage' },
          ingress: { type: 'agent', identity: stage },
        }),
      ).toMatchObject({ status: 'accepted' });
      item = (await storage.get({ orgId: 'org-1', id: item.id }))!;
    }
    expect(await service.transition(request(item))).toMatchObject({
      status: 'accepted',
    });
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      acceptedAt: null,
      triageType: null,
      stages: ['execute'],
    });
  });
});

// A person's move injects its own stage notice; the rules' own effects are what these assert on.
async function ruleDecisionKeys(storage: WorkItemsStorage, orgId: string) {
  const rows = await storage.listDeferredDecisions(orgId, PROJECT_ID);
  return rows.map(row => row.idempotencyKey).filter(key => !key.startsWith('factory-stage:'));
}

describe('FactoryTransitionService', () => {
  it.each(['github-issue', 'slack-thread'] as const)(
    'does not auto-start %s on manual intake entry even with candidate metadata',
    async source => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const item = await createItem(storage, { source, metadata: { autoStartCandidate: true } });
      const service = new FactoryTransitionService({
        storage,
        configVersion: 'manual-entry',
      });
      await expect(
        service.transition({ ...request(item, { stage: 'intake' }), initialEntry: true }),
      ).resolves.toMatchObject({ status: 'accepted' });
      expect(await ruleDecisionKeys(storage, 'org-1')).toEqual([]);
      const entered = await storage.get({ orgId: 'org-1', id: item.id });
      await expect(
        service.transition(request(entered!, { stage: 'triage', identity: 'explicit-triage' })),
      ).resolves.toMatchObject({ status: 'accepted' });
      expect(
        (await storage.listDeferredDecisions('org-1', PROJECT_ID)).filter(row => row.decision.type === 'invokeSkill'),
      ).toEqual(
        source === 'github-issue'
          ? [expect.objectContaining({ decision: expect.objectContaining({ skillName: 'factory-triage' }) })]
          : [],
      );
    },
  );

  it('replays concurrent transitions with the same ingress identity', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['planning'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const [first, second] = await Promise.all([service.transition(request(item)), service.transition(request(item))]);

    expect(second).toEqual(first);
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.revision).toBe(item.revision + 1);
  });

  it('lets a triage agent send an open non-bug back to Intake, where a person moves it on', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['triage'], metadata: { authorTrusted: true } });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });
    const returned = await service.transition({
      ...request(item, { stage: 'intake', identity: 'triage-feature' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'triage' },
      ingress: { type: 'agent', identity: 'triage-feature' },
    });

    expect(returned).toMatchObject({ status: 'accepted', stage: 'intake', revision: item.revision + 1 });
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      stages: ['intake'],
      triageType: null,
      acceptedAt: null,
    });
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);

    const approved = await service.transition(
      request({ id: item.id, revision: item.revision + 1 }, { stage: 'planning', identity: 'approve' }),
    );
    expect(approved).toMatchObject({ status: 'accepted', stage: 'planning' });
    // Moving the card on is the approval; nothing is stamped for it.
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.acceptedAt).toBeNull();
  });

  it.each(['planning', 'execute'] as const)(
    'never holds back a person or a board rule moving a card into %s',
    async stage => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const service = new FactoryTransitionService({ configVersion: 'human-approval', storage });
      for (const [actor, ingress] of [
        [
          { type: 'human', id: 'user-1' },
          { type: 'rule', identity: 'approved-rule' },
        ],
        [
          { type: 'system', id: 'dispatcher' },
          { type: 'rule', identity: 'board-rule' },
        ],
      ] as const) {
        // Building is entered from Review here: from Planning a board rule needs the approved plan.
        const item = await createItem(storage, {
          sourceKey: `${stage}-${actor.type}`,
          stages: [stage === 'execute' ? 'review' : 'intake'],
        });
        await expect(service.transition({ ...request(item, { stage }), actor, ingress })).resolves.toMatchObject({
          status: 'accepted',
          stage,
        });
        expect((await storage.get({ orgId: 'org-1', id: item.id }))?.acceptedAt).toBeNull();
      }
    },
  );

  it('keeps the plan gate after a person approves the card into Planning', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });
    const approved = await service.transition({
      ...request(item, { stage: 'planning', identity: 'human-plan' }),
      cause: 'board_drag',
    });
    expect(approved).toMatchObject({ status: 'accepted', stage: 'planning' });
    const revision = (approved as { revision: number }).revision;
    expect(
      (await storage.listDeferredDecisions('org-1', PROJECT_ID)).filter(
        row => row.decision.type === 'invokeSkill' && row.decision.skillName === 'factory-plan',
      ),
    ).toHaveLength(1);
    // Arming autonomy is not the same as approving the produced plan: with Auto-approve
    // plans off, nothing but a person or the approved submit_plan result moves it into Building.
    for (const [actor, ingress] of [
      [
        { type: 'agent', bindingId: 'agent', role: 'work' },
        { type: 'agent', identity: 'agent-execute' },
      ],
      [
        { type: 'system', id: 'dispatcher' },
        { type: 'rule', identity: 'rule-execute' },
      ],
      [
        { type: 'system', id: 'tool-result' },
        { type: 'toolResult', identity: 'tool-execute' },
      ],
      [
        { type: 'github', login: 'octocat', trusted: true, factoryAuthored: true },
        { type: 'github', identity: 'github-execute' },
      ],
    ] as const) {
      await expect(
        service.transition({
          ...request({ id: item.id, revision }, { stage: 'execute', identity: ingress.identity }),
          actor,
          ingress,
        }),
      ).resolves.toMatchObject({ status: 'rejected', code: 'approval_required' });
    }
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['planning']);
    // No work build is queued while the plan awaits approval.
    expect(
      (await storage.listDeferredDecisions('org-1', PROJECT_ID)).filter(
        row => row.decision.type === 'invokeSkill' && row.decision.skillName === undefined,
      ),
    ).toHaveLength(0);
  });

  it.each([
    ['execute', 'accepted'],
    ['planning', 'rejected'],
  ] as const)('sends a card from Review back into %s only to Building: %s', async (stage, status) => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['review'], metadata: { authorTrusted: true } });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });
    // Self-review requesting changes sends the builder back from Review; a new plan starts from Intake.
    const result = await service.transition({
      ...request(item, { stage }),
      actor: { type: 'agent', bindingId: 'agent', role: 'work' },
      ingress: { type: 'agent', identity: `review-${stage}` },
    });
    expect(result).toMatchObject({ status, ...(status === 'accepted' ? { stage } : { code: 'invalid_transition' }) });
  });

  it('neither opens nor closes the plan gate on a legacy acceptance stamp', async () => {
    const seed = await createFactoryStorageForTests();
    const storage = seed.workItems;
    const item = await createItem(storage, { stages: ['planning'], metadata: { authorTrusted: true } });
    const onAccepted = vi.fn();
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage, onAccepted });
    await seed.storage.ops.updateMany('work_items', { id: item.id }, { accepted_at: new Date() });

    const executed = await service.transition({
      ...request(item, { stage: 'execute' }),
      actor: { type: 'agent', bindingId: 'agent', role: 'plan' },
      ingress: { type: 'agent', identity: 'agent-execute' },
    });
    expect(executed).toMatchObject({ status: 'rejected', code: 'approval_required' });
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      stages: ['planning'],
      revision: item.revision,
    });

    const reworked = await service.transition({
      ...request(item, { stage: 'execute', identity: 'human-rework' }),
      cause: 'board_drag',
    });
    expect(reworked).toMatchObject({ status: 'accepted', stage: 'execute' });
    // Planning to Building is a plan approval, not the card's approval out of Intake.
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('fires onAccepted once, with the accepted row, and never lets the hook fail the transition', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const onAccepted = vi.fn().mockRejectedValue(new Error('label sync down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
      onAccepted,
    });
    const accepted = await service.transition({
      ...request(item, { stage: 'planning' }),
      cause: 'board_drag',
    });
    expect(accepted).toMatchObject({ status: 'accepted', stage: 'planning' });
    await vi.waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));
    expect(onAccepted.mock.calls[0]?.[0]).toMatchObject({
      orgId: 'org-1',
      workItemId: item.id,
      item: { id: item.id, stages: ['planning'] },
    });
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    const moved = await service.transition({
      ...request(
        { id: item.id, revision: (accepted as { revision: number }).revision },
        { stage: 'execute', identity: 'human-execute' },
      ),
      cause: 'board_drag',
    });
    expect(moved).toMatchObject({ status: 'accepted', stage: 'execute' });
    expect(onAccepted).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('isolates a synchronous acceptance-hook failure after the transition commits', async () => {
    const seed = await createFactoryStorageForTests();
    const storage = seed.workItems;
    const item = await createItem(storage);
    const onAccepted = vi.fn(() => {
      throw new Error('label sync threw');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
      audit: seed.audit,
      onAccepted,
    });
    const acceptRequest = { ...request(item, { stage: 'planning' }), cause: 'board_drag' };
    const accepted = await service.transition(acceptRequest);
    expect(accepted).toMatchObject({ status: 'accepted', stage: 'planning' });

    const stored = await storage.get({ orgId: 'org-1', factoryProjectId: PROJECT_ID, id: item.id });
    expect(stored).toMatchObject({ stages: ['planning'], acceptedAt: null });

    await vi.waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(warn.mock.calls[0]?.[0]).toBe(`[factory] acceptance hook failed for work item ${item.id}:`);

    const { events } = await seed.audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID });
    expect(events.filter(event => event.action === 'factory.work_item.stage_moved')).toMatchObject([
      { metadata: { transitionId: accepted.transitionId, to: 'planning' } },
    ]);

    expect(await service.transition(acceptRequest)).toEqual(accepted);
    expect(onAccepted).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('gates bug and grandfathered planning handoffs while leaving terminal transitions unaffected', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const bug = await createItem(storage, { metadata: { authorTrusted: true } });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });
    const planned = await service.transition({
      ...request(bug, { stage: 'planning', identity: 'bug-plan' }),
      actor: { type: 'agent', bindingId: 'triage', role: 'triage' },
      ingress: { type: 'agent', identity: 'bug-plan' },
    });
    const executed = await service.transition({
      ...request(
        { id: bug.id, revision: (planned as { revision: number }).revision },
        { stage: 'execute', identity: 'bug-execute' },
      ),
      actor: { type: 'agent', bindingId: 'work', role: 'work' },
      ingress: { type: 'agent', identity: 'bug-execute' },
    });
    expect(executed).toMatchObject({ status: 'rejected', code: 'approval_required' });
    const legacy = await createItem(storage, { stages: ['planning'], sourceKey: 'legacy' });
    await expect(
      service.transition({
        ...request(legacy, { stage: 'execute', identity: 'legacy-execute' }),
        actor: { type: 'agent', bindingId: 'work', role: 'work' },
        ingress: { type: 'agent', identity: 'legacy-execute' },
      }),
    ).resolves.toMatchObject({ status: 'rejected', code: 'approval_required' });
    const closed = await createItem(storage, { sourceKey: 'closed-feature' });
    await expect(
      service.transition({
        ...request(closed, { stage: 'done', identity: 'feature-close' }),
        actor: { type: 'agent', bindingId: 'triage', role: 'triage' },
        ingress: { type: 'agent', identity: 'feature-close' },
      }),
    ).resolves.toMatchObject({ status: 'accepted', stage: 'done' });
  });

  it('does not run GitHub issue rules against a Slack thread card', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'lifecycle-test', source: 'slack-thread', stages: ['execute'] });
    const issueRule = vi.fn(() => ({ type: 'notify' as const, idempotencyKey: 'issue-effect', title: 'Issue' }));
    const manualRule = vi.fn(() => ({ type: 'notify' as const, idempotencyKey: 'manual-effect', title: 'Manual' }));
    const service = new FactoryTransitionService({
      ...lifecycleOptions({
        version: 'rules-v1',
        handlers: { review: { issue: { onEnter: issueRule }, manual: { onEnter: manualRule } } },
      }),
      storage,
    });

    const result = await service.transition(request(item, { stage: 'review' }));

    expect(result).toMatchObject({ status: 'accepted' });
    expect(issueRule).not.toHaveBeenCalled();
    expect(manualRule).toHaveBeenCalledTimes(1);
  });

  it('hands the intake-stamped facts to the rule that runs on the stage', async () => {
    // Rules that read intake facts — who reported the issue, which repository it
    // came from — are unreachable unless the stamped metadata survives into the
    // context, and a rule reading `undefined` fails silently rather than loudly.
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'lifecycle-test', metadata: { author: 'octocat' } });
    const rule = vi.fn((_context: FactoryStageRuleContext) => ({
      type: 'notify' as const,
      idempotencyKey: 'effect-1',
      title: 'Ran',
    }));
    const service = new FactoryTransitionService({
      ...lifecycleOptions({
        version: 'rules-v1',
        handlers: { execute: { issue: { onEnter: rule } } },
      }),
      storage,
    });

    await service.transition(request(item, { stage: 'execute' }));

    expect(rule.mock.calls[0]?.[0]).toMatchObject({ item: { metadata: { author: 'octocat' } } });
  });

  it('invokes onTerminalStage only after a transition commits into a terminal stage', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['planning'] });
    const onTerminalStage = vi.fn();
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
      onTerminalStage,
    });

    const nonTerminal = await service.transition(request(item, { stage: 'execute' }));
    expect(nonTerminal.status).toBe('accepted');
    expect(onTerminalStage).not.toHaveBeenCalled();

    const rejected = await service.transition(
      request(item, { stage: 'done', identity: 'request-2', expectedRevision: 999 }),
    );
    expect(rejected.status).toBe('rejected');
    expect(onTerminalStage).not.toHaveBeenCalled();

    const updated = await storage.get({ orgId: 'org-1', id: item.id });
    const terminal = await service.transition(request(updated!, { stage: 'done', identity: 'request-3' }));
    expect(terminal.status).toBe('accepted');
    expect(onTerminalStage).toHaveBeenCalledExactlyOnceWith({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      stage: 'done',
      revision: expect.any(Number),
      actor: { type: 'human', id: 'user-1' },
    });
  });

  it('never fails a committed terminal transition when onTerminalStage throws', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const onTerminalStage = vi.fn().mockRejectedValue(new Error('release failed'));
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
      onTerminalStage,
    });

    const result = await service.transition(request(item, { stage: 'canceled' }));

    expect(result.status).toBe('accepted');
    expect(onTerminalStage).toHaveBeenCalledOnce();
  });

  it('returns a committed terminal transition when onTerminalStage hangs past the cleanup bound', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    // Never settles — models a hung sandbox-provider call during cleanup.
    const onTerminalStage = vi.fn(() => new Promise<void>(() => {}));
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
      onTerminalStage,
      terminalCleanupTimeoutMs: 20,
    });

    const result = await service.transition(request(item, { stage: 'done' }));

    expect(result.status).toBe('accepted');
    expect(onTerminalStage).toHaveBeenCalledOnce();
  });

  it('arms autonomy when a person moves a card, so its follow-up runs instead of parking', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['intake'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeNull();

    const result = await service.transition(request(item, { stage: 'triage' }));

    expect(result.status).toBe('accepted');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeInstanceOf(Date);
  });

  it('arms autonomy when a person creates a card straight into a working lane', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['intake'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { stage: 'planning' }),
      cause: 'manual_creation',
    });

    expect(result.status).toBe('accepted');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeInstanceOf(Date);
  });

  it('disarms autonomy when a person parks the card, so later events suggest instead of restarting it', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['intake'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });
    const dragged = await service.transition({ ...request(item, { stage: 'triage' }), cause: 'board_drag' });
    assert(dragged.status === 'accepted');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeInstanceOf(Date);

    const parked = await service.transition({
      ...request(item, { stage: 'intake', expectedRevision: dragged.revision, identity: 'request-2' }),
      cause: 'board_drag',
    });

    expect(parked.status).toBe('accepted');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeNull();
  });

  it('takes the factory hand off a card whoever rests it, so a push cannot restart finished work', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['intake'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });
    const dragged = await service.transition({ ...request(item, { stage: 'triage' }), cause: 'board_drag' });
    assert(dragged.status === 'accepted');

    const rested = await service.transition({
      ...request(item, { stage: 'done', expectedRevision: dragged.revision, identity: 'request-2' }),
      actor: { type: 'system', id: 'reconciler' },
      ingress: { type: 'rule', identity: 'rule-1' },
    });

    expect(rested.status).toBe('accepted');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeNull();
  });

  it("pre-approves the run an agent's working-lane move queues, naming the agent", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['triage'], metadata: { authorTrusted: false } });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { stage: 'planning' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'triage' },
      ingress: { type: 'agent', identity: 'triage-verdict' },
    });

    expect(result.status).toBe('accepted');
    const [plan] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(plan).toMatchObject({
      decision: { type: 'invokeSkill', role: 'work', skillName: 'factory-plan' },
      approvedBy: 'agent:binding-1',
    });
    expect(plan?.approvedAt).not.toBeNull();
  });

  it('leaves autonomy unarmed when the mover is not a person', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['intake'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { stage: 'triage' }),
      actor: { type: 'system', id: 'reconciler' },
      ingress: { type: 'rule', identity: 'rule-1' },
      cause: 'board_drag',
    });

    expect(result.status).toBe('accepted');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeNull();
  });

  it('queues an urgent wake-up when a move has no skill follow-up', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['triage'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { stage: 'canceled' }),
      cause: 'board_drag',
    });

    expect(result).toMatchObject({
      status: 'accepted',
      decisions: [
        {
          type: 'sendMessage',
          message: 'This work was moved from the triage stage to the canceled stage.',
          priority: 'urgent',
          idleBehavior: 'wake',
        },
      ],
    });
    assert(result.status === 'accepted');
    expect(result.decisions[0]).not.toHaveProperty('role');
  });

  it('attaches a persisted notice to a skill triggered by a move', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { stage: 'triage' }),
      cause: 'board_drag',
    });

    expect(result).toMatchObject({
      status: 'accepted',
      decisions: [
        {
          type: 'invokeSkill',
          role: 'triage',
          skillName: 'factory-triage',
          precedingMessage: 'This work was moved from the intake stage to the triage stage.',
        },
      ],
    });
  });

  it('runs onExit before onEnter and atomically persists accepted decisions', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'lifecycle-test' });
    const order: string[] = [];
    const rules = lifecycleOptions({
      version: 'rules-v1',
      handlers: {
        intake: {
          issue: {
            onExit: () => {
              order.push('exit');
              return { type: 'notify', idempotencyKey: 'notify-exit', title: 'Leaving intake' };
            },
          },
        },
        execute: {
          issue: {
            onEnter: () => {
              order.push('enter');
              return { type: 'sendMessage', idempotencyKey: 'message-enter', role: 'work', message: 'Build it.' };
            },
          },
        },
      },
    });

    const result = await new FactoryTransitionService({ ...rules, storage }).transition(request(item));

    expect(order).toEqual(['exit', 'enter']);
    expect(result).toMatchObject({ status: 'accepted', revision: 2, stage: 'execute' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stageHistory.map(entry => entry.stage)).toEqual([
      'intake',
      'execute',
    ]);
    expect(await ruleDecisionKeys(storage, 'org-1')).toEqual(['notify-exit', 'message-enter']);
  });

  it('rejects Review board moves outside its declared lifecycle', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { source: 'github-pr', stages: ['review'] });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    const result = await service.transition(request(item, { board: 'review', stage: 'planning' }));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
      reason:
        'The Review board does not allow moving from review to planning. Next stages declared from review: intake, done, canceled.',
    });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['review']);
  });

  it('names the declared next stages when the requested stage is not a phase', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['triage'] });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    const result = await service.transition(request(item, { stage: 'plan' as FactoryRuleStage }));

    expect(result).toMatchObject({ status: 'rejected', code: 'invalid_transition' });
    expect(result.status === 'rejected' && result.reason).toMatch(
      /^The \w+ board does not allow moving from triage to plan\. Next stages declared from triage: .*planning/,
    );
  });

  it('says no next stage is declared when the phase has no outgoing transitions', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const board = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
        shipped: { title: 'Shipped', kind: 'terminal' },
      },
    });
    const item = await createItem(storage, { board: board.id, stages: ['shipped'] });
    const service = new FactoryTransitionService({
      storage,
      configVersion: 'rules-v1',
      boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
    });

    const result = await service.transition(request(item, { stage: 'queued' }));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
      reason: 'The Release board does not allow moving from shipped to queued. No next stage is declared from shipped.',
    });
  });

  it('caps a long invalid_transition reason at the rejection limit', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const targets = Array.from({ length: 40 }, (_, index) => `target-phase-number-${index}`);
    const board = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: {
          title: 'Queued',
          kind: 'resting',
          outcomes: Object.fromEntries(targets.map(target => [target, target])),
        },
        ...Object.fromEntries(targets.map(target => [target, { title: target, kind: 'terminal' as const }])),
      },
    });
    const item = await createItem(storage, { board: board.id, stages: ['queued'] });
    const service = new FactoryTransitionService({
      storage,
      configVersion: 'rules-v1',
      boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
    });

    const result = await service.transition(request(item, { stage: 'missing' as FactoryRuleStage }));
    const replayed = await service.transition(request(item, { stage: 'missing' as FactoryRuleStage }));

    expect(result).toMatchObject({ status: 'rejected', code: 'invalid_transition' });
    expect(result.status === 'rejected' && result.reason.length).toBe(512);
    expect(replayed).toEqual(result);
  });

  it('starts nothing when a person parks a card back in Intake', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { source: 'github-pr', stages: ['review'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { board: 'review', stage: 'intake' }),
      cause: 'board_drag',
    });

    assert(result.status === 'accepted');
    // No role: the notice goes to whichever session is live on the card, so a
    // park lands regardless of which seat was running when the person parked it.
    expect(result.decisions).toEqual([
      {
        type: 'sendMessage',
        idempotencyKey: expect.stringContaining('factory-stage:'),
        message: 'This work was moved from the review stage to the intake stage.',
        priority: 'urgent',
        idleBehavior: 'wake',
      },
    ]);
  });

  it('still opens a session when a person drags a card into a working lane', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['execute'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
      selfReviewEnabled: async () => true,
    });

    const result = await service.transition({ ...request(item, { stage: 'review' }), cause: 'board_drag' });

    expect(result).toMatchObject({
      status: 'accepted',
      decisions: [{ type: 'invokeSkill', role: 'review', skillName: 'factory-self-review' }],
    });
  });

  it('opens the builder session when a person drags a card into Review with self-review off', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['execute'] });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    const result = await service.transition({ ...request(item, { stage: 'review' }), cause: 'board_drag' });

    expect(result).toMatchObject({
      status: 'accepted',
      decisions: [{ type: 'sendMessage', role: 'work', prepareBinding: true }],
    });
  });

  it('starts no second run when a run start records the card entering its own lane', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { source: 'github-pr', stages: ['intake'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { board: 'review', stage: 'review' }),
      cause: 'run_start',
    });

    expect(result).toMatchObject({ status: 'accepted', stage: 'review', decisions: [] });
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });

  it('allows a GitLab merge request to enter Review like a GitHub pull request', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'review', source: 'gitlab-pr', stages: ['intake'] });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    await expect(
      service.transition({ ...request(item, { board: 'review', stage: 'review' }), cause: 'run_start' }),
    ).resolves.toMatchObject({ status: 'accepted', stage: 'review' });
    const updated = await storage.get({ orgId: 'org-1', id: item.id });
    expect(updated).not.toBeNull();
    await expect(
      service.transition(request(updated!, { board: 'work', stage: 'execute', identity: 'wrong-gitlab-board' })),
    ).resolves.toMatchObject({ status: 'rejected', code: 'invalid_transition' });
  });

  it('lets the bound agent walk its parked card back into its lane without racing a second run', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, {
      source: 'github-pr',
      stages: ['intake'],
      metadata: { authorTrusted: true },
    });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { board: 'review', stage: 'review' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'review' },
      ingress: { type: 'agent', identity: 'request-1' },
      cause: 'user asked to resume the review',
    });

    expect(result).toMatchObject({ status: 'accepted', stage: 'review', decisions: [] });
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });

  it('refuses an agent pulling an externally authored card out of rest', async () => {
    // The card's own content can steer the agent; leaving rest on a card from
    // outside the write-access circle takes a person's gesture, never the agent's.
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, {
      source: 'github-pr',
      stages: ['intake'],
      metadata: { authorTrusted: false },
    });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { board: 'review', stage: 'review' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'review' },
      ingress: { type: 'agent', identity: 'self-resume-1' },
      cause: 'user asked to resume the review',
    });

    expect(result).toMatchObject({ status: 'rejected', code: 'approval_required' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
  });

  it('refuses the agent resume on a GitHub card missing its trust stamp', async () => {
    // Pre-stamp cards fail closed: absence of `authorTrusted` is not trust.
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { source: 'github-pr', stages: ['intake'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    });

    const result = await service.transition({
      ...request(item, { board: 'review', stage: 'review' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'review' },
      ingress: { type: 'agent', identity: 'self-resume-2' },
      cause: 'user asked to resume the review',
    });

    expect(result).toMatchObject({ status: 'rejected', code: 'approval_required' });
  });

  it('lets the planner move to Building when its phase auto-approves submit_plan for the card', async () => {
    // A board that keeps Work's plan handoff and ends Planning with an auto-approved
    // submit_plan: the plan needs no person, so the agent's own move must stand.
    const planned = defineBoard({
      id: 'planned',
      name: 'Planned',
      initialPhase: 'intake',
      tools: workBoard.tools,
      phases: {
        ...workBoard.phases,
        planning: {
          ...workBoard.phases.planning,
          exitTool: {
            id: 'submit_plan',
            autoApprove: true,
            autoApproveWhen: {
              operator: 'AND',
              conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
            },
          },
        },
      },
    });
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
      boards: createBoardRegistry({ boards: [planned] }),
    });
    const move = (item: { id: string; revision: number; board?: string | null }, identity: string) =>
      service.transition({
        ...request(item, { board: 'planned', stage: 'execute' }),
        actor: { type: 'agent', bindingId: 'binding-1', role: 'plan' },
        ingress: { type: 'agent', identity },
        cause: 'plan written',
      });

    const low = await createItem(storage, {
      board: 'planned',
      stages: ['planning'],
      metadata: { labels: ['effort:low'] },
    });
    expect(await move(low, 'low')).toMatchObject({ status: 'accepted' });
    expect((await storage.get({ orgId: 'org-1', id: low.id }))?.stages).toEqual(['execute']);

    const high = await createItem(storage, {
      board: 'planned',
      sourceKey: '2',
      stages: ['planning'],
      metadata: { labels: ['effort:high'] },
    });
    expect(await move(high, 'high')).toMatchObject({ status: 'rejected', code: 'approval_required' });
  });

  it('still hands the next seat its run when an agent moves the card past its own stage', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['planning'] });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    // The plan agent's planning -> execute handoff stands once a person approved the
    // plan; the gate itself is exercised separately below.
    const result = await service.transition({
      ...request(item, { stage: 'execute' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'plan' },
      ingress: { type: 'agent', identity: 'request-1' },
      cause: 'plan approved',
      planApproved: true,
    });

    assert(result.status === 'accepted');
    expect(result.decisions).toMatchObject([{ type: 'invokeSkill', role: 'work' }]);
  });

  it('still runs the left lane onExit when a run start skips the entered lane', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'lifecycle-test', stages: ['triage'] });
    const rules = lifecycleOptions({
      version: 'rules-v1',
      handlers: {
        triage: {
          issue: { onExit: () => ({ type: 'notify', idempotencyKey: 'notify-exit', title: 'Leaving triage' }) },
        },
      },
    });

    const result = await new FactoryTransitionService({ ...rules, storage }).transition({
      ...request(item, { stage: 'execute' }),
      cause: 'run_start',
    });

    expect(result).toMatchObject({ status: 'accepted', stage: 'execute' });
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID)).map(entry => entry.idempotencyKey)).toEqual([
      'notify-exit',
    ]);
  });

  it('persists rule rejection without moving or queuing decisions', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'lifecycle-test' });
    const rules = lifecycleOptions({
      version: 'rules-v1',
      handlers: {
        execute: {
          issue: { onEnter: () => ({ type: 'reject', code: 'forbidden', reason: 'Approval is required.' }) },
        },
      },
    });

    const result = await new FactoryTransitionService({ ...rules, storage }).transition(request(item));

    expect(result).toMatchObject({ status: 'rejected', code: 'forbidden', reason: 'Approval is required.' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });

  it('turns thrown rules into bounded safe rejection', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'lifecycle-test' });
    const rules = lifecycleOptions({
      version: 'rules-v1',
      handlers: { execute: { issue: { onEnter: () => Promise.reject(new Error('provider unavailable')) } } },
    });

    const result = await new FactoryTransitionService({ ...rules, storage }).transition(request(item));

    expect(result).toMatchObject({ status: 'rejected', code: 'rule_error' });
    expect(result.status === 'rejected' ? result.reason : '').toContain('provider unavailable');
  });

  it('applies one timeout to the full primary evaluation and ignores late resolution', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'lifecycle-test' });
    let resolveRule!: (value: { type: 'notify'; idempotencyKey: string; title: string }) => void;
    const lateRule = new Promise<{ type: 'notify'; idempotencyKey: string; title: string }>(resolve => {
      resolveRule = resolve;
    });
    const rules = lifecycleOptions({
      version: 'rules-v1',
      handlers: { execute: { issue: { onEnter: () => lateRule } } },
    });

    vi.useFakeTimers();
    try {
      const transition = new FactoryTransitionService({ ...rules, storage }).transition(request(item));
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await transition;
      expect(result).toMatchObject({ status: 'rejected', code: 'timeout' });

      resolveRule({ type: 'notify', idempotencyKey: 'too-late', title: 'Too late' });
      await lateRule;
      await Promise.resolve();
      expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
      expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('always returns typed stale on CAS loss and never overwrites canonical state', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });
    await storage.update({ orgId: 'org-1', id: item.id, userId: 'user-2', patch: { title: 'Changed concurrently' } });

    const result = await service.transition(request(item));

    expect(result).toMatchObject({ status: 'rejected', code: 'stale' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
  });

  it('replays immutable ingress across rule version changes without re-evaluation', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'lifecycle-test' });
    const first = await new FactoryTransitionService({
      ...lifecycleOptions({ version: 'rules-v1', handlers: {} }),
      storage,
    }).transition(request(item));
    const laterRule = vi.fn(() => ({ type: 'reject' as const, code: 'forbidden' as const, reason: 'new policy' }));
    const rulesV2 = lifecycleOptions({
      version: 'rules-v2',
      handlers: { execute: { issue: { onEnter: laterRule } } },
    });

    const replay = await new FactoryTransitionService({ ...rulesV2, storage }).transition(
      request(item, { stage: 'planning' }),
    );

    expect(replay).toEqual(first);
    expect(laterRule).not.toHaveBeenCalled();
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['execute']);
  });

  it('durably deduplicates missing-item rejection before any rule evaluation', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const handler = vi.fn(() => ({ type: 'notify' as const, idempotencyKey: 'never', title: 'Never' }));
    const service = new FactoryTransitionService({
      ...lifecycleOptions({
        version: 'rules-v1',
        handlers: { execute: { issue: { onEnter: handler } } },
      }),
      storage,
    });
    const missing = { board: 'lifecycle-test', id: '00000000-0000-4000-8000-000000000099', revision: 1 };

    const first = await service.transition(request(missing, { identity: 'missing-event' }));
    const replay = await service.transition(request(missing, { identity: 'missing-event', stage: 'done' }));

    expect(first).toMatchObject({ status: 'rejected', code: 'invalid_transition' });
    expect(replay).toEqual(first);
    expect(handler).not.toHaveBeenCalled();
  });

  it('accepts unchanged-stage no-op without revising history', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const result = await new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
    }).transition(request(item, { stage: 'intake' }));

    expect(result).toMatchObject({ status: 'accepted', revision: 1, stage: 'intake' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stageHistory).toHaveLength(1);
  });

  it('rejects excessive causal depth and wrong Work/Review authority', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const workItem = await createItem(storage);
    const reviewItem = await createItem(storage, {
      source: 'github-pr',
      sourceKey: 'github-pr:2',
    });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });
    const causalChain = Array.from({ length: MAX_FACTORY_RULE_CAUSAL_DEPTH + 1 }, (_, index) => ({
      ingressId: `ingress-${index}`,
      decisionType: 'transition' as const,
    }));

    await expect(service.transition(request(workItem, { identity: 'causal', causalChain }))).resolves.toMatchObject({
      status: 'rejected',
      code: 'causal_depth_exceeded',
    });
    await expect(
      service.transition(request(workItem, { identity: 'wrong-work', board: 'review' })),
    ).resolves.toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
    });
    await expect(
      service.transition(request(reviewItem, { identity: 'wrong-review', board: 'work' })),
    ).resolves.toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
    });
  });

  it('accepts a human cancel and can revive the item out of canceled', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['review'] });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    const discard = await service.transition(request(item, { stage: 'canceled', identity: 'discard-1' }));
    expect(discard).toMatchObject({ status: 'accepted', stage: 'canceled' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['canceled']);

    // An item sitting in canceled still has a canonical stage, so it can be
    // pulled back onto the board, into Intake.
    const revive = await service.transition(
      request({ id: item.id, revision: 2 }, { stage: 'intake', identity: 'revive-1' }),
    );
    expect(revive).toMatchObject({ status: 'accepted', stage: 'intake' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
  });

  it('audits a transition once when its ingress is delivered concurrently', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await createItem(seed.workItems);
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage: seed.workItems,
      audit: seed.audit,
    });
    const input = request(item, { stage: 'triage', identity: 'concurrent-ingress' });
    const [first, second] = await Promise.all([service.transition(input), service.transition(input)]);
    expect(first.status).toBe('accepted');
    expect(second).toEqual(first);
    expect((await seed.audit.list({ orgId: 'org-1' })).events).toHaveLength(1);
  });

  it('scopes ingress replay and deferred idempotency to the tenant', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const first = await createItem(storage, { board: 'lifecycle-test', orgId: 'org-1', sourceKey: 'github-issue:one' });
    const second = await createItem(storage, {
      board: 'lifecycle-test',
      orgId: 'org-2',
      sourceKey: 'github-issue:two',
    });
    const handler = () => ({ type: 'notify' as const, idempotencyKey: 'same-effect-key', title: 'Moved' });
    const rules = lifecycleOptions({
      version: 'rules-v1',
      handlers: { execute: { issue: { onEnter: handler } } },
    });
    const service = new FactoryTransitionService({ ...rules, storage });

    await service.transition(request(first, { identity: 'same-ingress' }));
    await service.transition(request(second, { orgId: 'org-2', identity: 'same-ingress' }));

    expect(await ruleDecisionKeys(storage, 'org-1')).toEqual(['same-effect-key']);
    expect(await ruleDecisionKeys(storage, 'org-2')).toEqual(['same-effect-key']);
  });

  it('requires legacy items to be assigned before custom-only transitions', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['intake'] });
    const board = createTestBoard();
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
      storage,
    });

    await expect(
      service.transition(request(item, { board: 'release', stage: 'shipped', identity: 'ship-legacy' })),
    ).resolves.toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
      reason: expect.stringContaining('Assign an installed board and phase'),
    });
  });

  it('validates and runs phase behavior from an installed custom board', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'release', stages: ['queued'] });
    const onEnter = vi.fn();
    const board = createTestBoard({ onShipped: onEnter });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
      storage,
    });

    await expect(
      service.transition(request(item, { board: 'release', stage: 'shipped', identity: 'ship-release' })),
    ).resolves.toMatchObject({ status: 'accepted', stage: 'shipped' });
    expect(onEnter).toHaveBeenCalledOnce();
    await expect(
      service.transition(
        request(
          { id: item.id, revision: item.revision + 1 },
          { board: 'work', stage: 'done', identity: 'work-disabled' },
        ),
      ),
    ).resolves.toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
      reason: 'The work item belongs to board "release", not "work".',
    });
  });
});

describe('audit trail', () => {
  it('records every commit under the request actor, rule moves as the system, replays never', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await createItem(seed.workItems);
    const service = new FactoryTransitionService({
      storage: seed.workItems,
      configVersion: 'audit-test',
      audit: seed.audit,
    });
    const sweep = {
      ...request(item, { stage: 'planning', identity: 'sweep-1' }),
      actor: { type: 'system' as const, id: 'sweep' },
      ingress: { type: 'rule' as const, identity: 'sweep-1' },
      cause: 'sweep',
    };

    const moved = await service.transition(sweep);
    expect(moved.status).toBe('accepted');
    expect(await service.transition(sweep)).toEqual(moved);
    const stale = await service.transition({
      ...request(item, { stage: 'done', identity: 'stale-1' }),
      actorProfile: { name: 'Ada' },
    });
    expect(stale).toMatchObject({ status: 'rejected', code: 'stale' });

    const { events } = await seed.audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID });
    expect(events).toHaveLength(2);
    expect(events.find(event => event.action === 'factory.work_item.stage_moved')).toMatchObject({
      actorId: 'sweep',
      actorType: 'system',
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the bug' }],
      metadata: {
        transitionId: moved.transitionId,
        ingressType: 'rule',
        cause: 'sweep',
        configVersion: 'audit-test',
        from: 'intake',
        to: 'planning',
        revision: 2,
      },
    });
    expect(events.find(event => event.action === 'factory.work_item.transition_rejected')).toMatchObject({
      actorId: 'user-1',
      actorType: 'human',
      metadata: { from: 'planning', to: 'done', code: 'stale', __actorProfile: { name: 'Ada' } },
    });
  });

  it('names the agent whose consent the dispatcher carries as a human actor', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await createItem(seed.workItems, { stages: ['planning'] });
    const service = new FactoryTransitionService({
      storage: seed.workItems,
      configVersion: 'audit-test',
      audit: seed.audit,
    });

    const moved = await service.transition({
      ...request(item, { identity: 'decision-1' }),
      actor: { type: 'human', id: 'agent:binding-7' },
      ingress: { type: 'rule', identity: 'decision-1' },
      cause: 'rule_decision',
    });
    expect(moved.status).toBe('accepted');

    const { events } = await seed.audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID });
    expect(events).toEqual([expect.objectContaining({ actorId: 'agent:binding-7', actorType: 'agent' })]);
  });

  it('records a re-entry onto the stage the card already holds', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await createItem(seed.workItems, { stages: ['planning'] });
    const service = new FactoryTransitionService({
      storage: seed.workItems,
      configVersion: 'audit-test',
      audit: seed.audit,
    });
    const moved = await service.transition(request(item, { identity: 'move-1' }));
    assert(moved.status === 'accepted');

    const reentered = await service.transition({
      ...request(item, { identity: 'reenter-1', expectedRevision: moved.revision }),
      actor: { type: 'system', id: 'factory-rule-dispatcher' },
      ingress: { type: 'rule', identity: 'reenter-1' },
      cause: 'rule_decision',
      reenter: true,
    });
    expect(reentered).toMatchObject({ status: 'accepted', stage: 'execute' });

    const { events } = await seed.audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID });
    expect(events).toHaveLength(2);
    expect(events.map(event => event.metadata)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'execute', to: 'execute', reenter: true }),
        expect.objectContaining({ from: 'planning', to: 'execute' }),
      ]),
    );
  });

  it('records a rejection aimed at a work item that no longer exists', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await createItem(seed.workItems);
    const service = new FactoryTransitionService({
      storage: seed.workItems,
      configVersion: 'audit-test',
      audit: seed.audit,
    });

    const rejected = await service.transition({
      ...request(item, { identity: 'gone-1' }),
      workItemId: '00000000-0000-4000-8000-000000000000',
    });
    expect(rejected).toMatchObject({ status: 'rejected', code: 'invalid_transition' });

    const { events } = await seed.audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID });
    expect(events).toEqual([
      expect.objectContaining({
        action: 'factory.work_item.transition_rejected',
        targets: [{ type: 'work_item', id: '00000000-0000-4000-8000-000000000000' }],
      }),
    ]);
    expect(events[0]?.metadata).not.toHaveProperty('from');
  });

  it('does not call entering the stage a card already holds a move', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await createItem(seed.workItems);
    const service = new FactoryTransitionService({
      storage: seed.workItems,
      configVersion: 'audit-test',
      audit: seed.audit,
    });

    expect(await service.transition({ ...request(item, { stage: 'intake' }), initialEntry: true })).toMatchObject({
      status: 'accepted',
    });

    expect((await seed.audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).events).toEqual([]);
  });
});

describe('phase semantics', () => {
  it.each([
    ['triage', 'triage'],
    ['planning', 'work'],
    ['execute', 'work'],
    ['review', 'work'],
  ] as const)('seats a human kickoff into Work %s with the %s role', async (stage, role) => {
    const storage = (await createFactoryStorageForTests()).workItems;
    // Building is entered from Planning; every other lane from Intake.
    const item = await createItem(storage, { stages: [stage === 'execute' ? 'planning' : 'intake'] });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    const result = await service.transition({ ...request(item, { stage }), cause: 'board_drag' });

    assert(result.status === 'accepted');
    expect(
      result.decisions.find(decision => decision.type === 'sendMessage' || decision.type === 'invokeSkill'),
    ).toMatchObject({ role });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeInstanceOf(Date);
  });

  it('seats a human kickoff into Review review with the review role', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { source: 'github-pr', stages: ['intake'] });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    const result = await service.transition({
      ...request(item, { board: 'review', stage: 'review' }),
      cause: 'board_drag',
    });

    assert(result.status === 'accepted');
    expect(result.decisions[0]).toMatchObject({ role: 'review' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeInstanceOf(Date);
  });

  it('guards an agent moving an externally authored card into work and out of Planning', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['intake'], metadata: { authorTrusted: false } });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });
    const agent = { type: 'agent' as const, bindingId: 'agent', role: 'work' };

    await expect(service.transition({ ...request(item, { stage: 'planning' }), actor: agent })).resolves.toMatchObject({
      status: 'rejected',
      code: 'approval_required',
    });

    const moved = await service.transition({
      ...request(item, { stage: 'planning', identity: 'human-1' }),
      cause: 'board_drag',
    });
    assert(moved.status === 'accepted');
    await expect(
      service.transition({
        ...request(item, { stage: 'execute', expectedRevision: moved.revision, identity: 'agent-2' }),
        actor: agent,
      }),
    ).resolves.toMatchObject({ status: 'rejected', code: 'approval_required' });
  });

  describe('custom board declarations', () => {
    async function setup(stages: string[] = ['queued']) {
      const storage = (await createFactoryStorageForTests()).workItems;
      const item = await createItem(storage, { board: 'release', stages });
      const onTerminalStage = vi.fn();
      const service = new FactoryTransitionService({
        configVersion: 'rules-v1',
        boards: createBoardRegistry({ boards: [createTestBoard()], includeDefaultBoards: false }),
        storage,
        onTerminalStage,
      });
      return { storage, item, service, onTerminalStage };
    }

    it('arms autonomy and seats the declared role when a person moves into a working phase', async () => {
      const { storage, item, service, onTerminalStage } = await setup();

      const result = await service.transition({
        ...request(item, { board: 'release', stage: 'shipping' }),
        cause: 'board_drag',
      });

      assert(result.status === 'accepted');
      expect(result.decisions[0]).toMatchObject({ type: 'sendMessage', role: 'release', prepareBinding: true });
      expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeInstanceOf(Date);
      expect(onTerminalStage).not.toHaveBeenCalled();
    });

    it('disarms, sends an unseated notice, and releases resources when a person moves into a terminal phase', async () => {
      const { storage, item, service, onTerminalStage } = await setup(['shipping']);

      const result = await service.transition({
        ...request(item, { board: 'release', stage: 'shipped' }),
        cause: 'board_drag',
      });

      assert(result.status === 'accepted');
      expect(result.decisions[0]).toMatchObject({ type: 'sendMessage' });
      expect(result.decisions[0]).not.toHaveProperty('role');
      expect(result.decisions[0]).not.toHaveProperty('prepareBinding');
      expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeNull();
      expect(onTerminalStage).toHaveBeenCalledWith(
        expect.objectContaining({ workItemId: item.id, stage: 'shipped', revision: result.revision }),
      );
    });

    it('guards an agent moving an externally authored card from a custom resting phase into work', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const item = await createItem(storage, {
        board: 'release',
        stages: ['queued'],
        metadata: { authorTrusted: false },
      });
      const service = new FactoryTransitionService({
        configVersion: 'rules-v1',
        boards: createBoardRegistry({ boards: [createTestBoard()], includeDefaultBoards: false }),
        storage,
      });

      await expect(
        service.transition({
          ...request(item, { board: 'release', stage: 'shipping' }),
          actor: { type: 'agent', bindingId: 'agent', role: 'release' },
        }),
      ).resolves.toMatchObject({ status: 'rejected', code: 'approval_required' });
    });

    it('gives a board that reuses Work phase names exactly what it declared', async () => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const board = defineBoard({
        id: 'bot-board',
        title: 'Bot board',
        initialPhase: 'intake',
        phases: {
          intake: { title: 'Intake', kind: 'resting', outcomes: { start: 'triage', finish: 'done' } },
          triage: { title: 'Triage', kind: 'working', role: 'bot', outcomes: { next: 'execute', finish: 'done' } },
          execute: { title: 'Execute', kind: 'working', role: 'bot', outcomes: { park: 'done' } },
          // Named like Work's terminal phase but declared working: the card stays seated here.
          done: { title: 'Done', kind: 'working', role: 'bot', outcomes: { reopen: 'intake' } },
        },
      });
      const onTerminalStage = vi.fn();
      const service = new FactoryTransitionService({
        configVersion: 'rules-v1',
        boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
        storage,
        onTerminalStage,
      });
      const item = await createItem(storage, { board: board.id, stages: ['intake'] });

      const triaged = await service.transition({
        ...request(item, { board: board.id, stage: 'triage' }),
        cause: 'board_drag',
      });
      assert(triaged.status === 'accepted');
      expect(triaged.decisions[0]).toMatchObject({ role: 'bot', prepareBinding: true });

      const done = await service.transition({
        ...request(item, { board: board.id, stage: 'done', expectedRevision: triaged.revision, identity: 'human-2' }),
        cause: 'board_drag',
      });
      assert(done.status === 'accepted');
      expect(done.decisions[0]).toMatchObject({ role: 'bot', prepareBinding: true });
      expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeInstanceOf(Date);
      expect(onTerminalStage).not.toHaveBeenCalled();
    });
  });
});

describe('Work board plan-approval gate on the stock planning handoff', () => {
  async function planningItem(storage: WorkItemsStorage, sourceKey: string) {
    return createItem(storage, { stages: ['planning'], sourceKey, metadata: { authorTrusted: true } });
  }

  /** Work, except Planning's submit_plan is auto-approved: the only way a plan skips a person now. */
  const autoApprovingWork = defineBoard({
    id: 'auto-approving-work',
    name: 'Auto-approving Work',
    initialPhase: 'intake',
    tools: workBoard.tools,
    phases: {
      ...workBoard.phases,
      planning: { ...workBoard.phases.planning, exitTool: { id: 'submit_plan', autoApprove: true } },
    },
  });

  function planAgentToExecute(item: { id: string; revision: number; board?: string | null }, identity: string) {
    return {
      ...request(item, { board: item.board ?? 'work', stage: 'execute', identity }),
      actor: { type: 'agent' as const, bindingId: 'plan-binding', role: 'plan' },
      ingress: { type: 'agent' as const, identity },
    };
  }

  it('refuses a plan agent moving planning -> execute when plans are not auto-approved', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({
      configVersion: 'plan-gate-v1',
      storage,
    });
    const item = await planningItem(storage, 'no-auto-approve');

    const result = await service.transition(planAgentToExecute(item, 'plan-execute'));

    expect(result).toMatchObject({ status: 'rejected', code: 'approval_required' });
    // The card rests in Planning and no build is queued off the rejected move.
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
      revision: item.revision,
      stages: ['planning'],
    });
  });

  it('refuses the move when no resolver is wired and the item is not preapproved', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({ configVersion: 'plan-gate-v1', storage });
    const item = await planningItem(storage, 'no-resolver');

    expect(await service.transition(planAgentToExecute(item, 'plan-execute'))).toMatchObject({
      status: 'rejected',
      code: 'approval_required',
    });
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({ stages: ['planning'] });
  });

  it('lets the plan agent advance only where the board auto-approves submit_plan, never on Work itself', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({
      configVersion: 'plan-gate-v1',
      storage,
      boards: createBoardRegistry({ boards: [autoApprovingWork] }),
    });
    const onWork = await planningItem(storage, 'work-plan');
    expect(await service.transition(planAgentToExecute(onWork, 'work-execute'))).toMatchObject({
      status: 'rejected',
      code: 'approval_required',
    });

    const item = await createItem(storage, {
      board: autoApprovingWork.id,
      stages: ['planning'],
      sourceKey: 'auto-approve',
      metadata: { authorTrusted: true },
    });

    const result = await service.transition(planAgentToExecute(item, 'plan-execute'));

    expect(result).toMatchObject({ status: 'accepted', stage: 'execute' });
    assert(result.status === 'accepted');
    expect(result.decisions).toContainEqual(expect.objectContaining({ type: 'invokeSkill', role: 'work' }));
  });

  it('does not treat legacy item preapproval as permission to skip plan approval', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({
      configVersion: 'plan-gate-v1',
      storage,
    });
    let item = await planningItem(storage, 'preapproved');
    const updated = await storage.update({
      orgId: 'org-1',
      id: item.id,
      userId: 'user-1',
      patch: { plansPreapproved: true },
    });
    assert(updated);
    item = updated.item;

    expect(await service.transition(planAgentToExecute(item, 'plan-execute'))).toMatchObject({
      status: 'rejected',
      code: 'approval_required',
    });
  });

  it('does not gate a human moving planning -> execute from the UI', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({
      configVersion: 'plan-gate-v1',
      storage,
    });
    const item = await planningItem(storage, 'human-move');

    const result = await service.transition({
      ...request(item, { stage: 'execute', identity: 'human-execute' }),
      cause: 'board_drag',
    });

    expect(result).toMatchObject({ status: 'accepted', stage: 'execute' });
  });

  it.each(['work', 'triage'])('blocks a %s-role agent moving planning -> execute', async role => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({
      configVersion: 'plan-gate-v1',
      storage,
    });
    const item = await planningItem(storage, `${role}-agent`);

    const result = await service.transition({
      ...planAgentToExecute(item, `${role}-execute`),
      actor: { type: 'agent', bindingId: `${role}-binding`, role },
    });

    expect(result).toMatchObject({ status: 'rejected', code: 'approval_required' });
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({ stages: ['planning'] });
  });

  it('blocks a system rule moving planning -> execute without plan approval', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({
      configVersion: 'plan-gate-v1',
      storage,
    });
    const item = await planningItem(storage, 'unapproved-system-rule');

    const result = await service.transition({
      ...request(item, { stage: 'execute', identity: 'unapproved-system-rule' }),
      actor: { type: 'system', id: 'factory-tool-result-rule' },
      ingress: { type: 'rule', identity: 'unapproved-system-rule' },
    });

    expect(result).toMatchObject({ status: 'rejected', code: 'approval_required' });
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({ stages: ['planning'] });
  });

  it('allows a transition that consumes an explicitly approved plan result', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({
      configVersion: 'plan-gate-v1',
      storage,
    });
    const item = await planningItem(storage, 'approved-plan-result');

    const result = await service.transition({
      ...request(item, { stage: 'execute', identity: 'approved-plan-result' }),
      actor: { type: 'system', id: 'factory-tool-result-rule' },
      ingress: { type: 'rule', identity: 'approved-plan-result' },
      planApproved: true,
    });

    expect(result).toMatchObject({ status: 'accepted', stage: 'execute' });
  });

  it.each([
    ['intake', false],
    ['triage', false],
    ['intake', true],
    ['triage', true],
  ])(
    'blocks a triage agent skipping Planning from %s into Building (plans auto-approved: %s)',
    async (stage, autoApprove) => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const service = new FactoryTransitionService({
        configVersion: 'plan-gate-v1',
        storage,
        boards: createBoardRegistry({ boards: [autoApprovingWork] }),
      });
      const item = await createItem(storage, {
        board: autoApprove ? autoApprovingWork.id : 'work',
        stages: [stage],
        sourceKey: `skip-${stage}`,
        metadata: { authorTrusted: true },
      });

      const result = await service.transition({
        ...request(item, { board: item.board ?? 'work', stage: 'execute', identity: `skip-${stage}` }),
        actor: { type: 'agent', bindingId: 'triage-binding', role: 'triage' },
        ingress: { type: 'agent', identity: `skip-${stage}` },
      });

      expect(result).toMatchObject({ status: 'rejected', code: 'invalid_transition' });
      expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({
        revision: item.revision,
        stages: [stage],
      });
    },
  );

  it('keeps a person from skipping Planning too: a plan comes before Building', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({
      configVersion: 'plan-gate-v1',
      storage,
    });
    const item = await createItem(storage, {
      stages: ['triage'],
      sourceKey: 'fast-route',
      metadata: { authorTrusted: true },
    });

    const person = await service.transition(request(item, { stage: 'execute', identity: 'person-route' }));
    expect(person).toMatchObject({ status: 'rejected', code: 'invalid_transition' });
    assert(person.status === 'rejected');
    expect(person.reason).toContain('intake, planning, done, canceled');

    const planned = await service.transition(request(item, { stage: 'planning', identity: 'person-plan' }));
    expect(planned).toMatchObject({ status: 'accepted', stage: 'planning' });
  });
});

describe('onTransitionCommitted', () => {
  async function setup(
    onTransitionCommitted: ConstructorParameters<typeof FactoryTransitionService>[0]['onTransitionCommitted'],
  ) {
    const storage = (await createFactoryStorageForTests()).workItems;
    const board = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'approval',
      phases: {
        approval: { title: 'Approval', kind: 'resting', next: 'shipped' },
        shipped: { title: 'Shipped', kind: 'resting' },
      },
    });
    const item = await createItem(storage, { board: 'release', stages: ['approval'] });
    const service = new FactoryTransitionService({
      storage,
      configVersion: 'notify-test',
      boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
      onTransitionCommitted,
    });
    return { item, service, storage };
  }

  it('reports a committed stage change once, even when the request is replayed', async () => {
    const onTransitionCommitted = vi.fn();
    const { item, service } = await setup(onTransitionCommitted);
    const input = request(item, { stage: 'shipped' });

    expect(await service.transition(input)).toMatchObject({ status: 'accepted' });
    expect(await service.transition(input)).toMatchObject({ status: 'accepted' });

    await vi.waitFor(() => expect(onTransitionCommitted).toHaveBeenCalledOnce());
    expect(onTransitionCommitted).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      fromStage: 'approval',
      toStage: 'shipped',
    });
  });

  it('says nothing for a rejected transition or a same-stage commit', async () => {
    const onTransitionCommitted = vi.fn();
    const { item, service } = await setup(onTransitionCommitted);

    expect(
      await service.transition(
        request(item, { stage: 'shipped', expectedRevision: item.revision + 1, identity: 'stale' }),
      ),
    ).toMatchObject({ status: 'rejected' });
    expect(await service.transition(request(item, { stage: 'approval', identity: 'same' }))).toMatchObject({
      status: 'accepted',
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(onTransitionCommitted).not.toHaveBeenCalled();
  });

  it.each([
    [
      'throws',
      () => {
        throw new Error('notify failed');
      },
    ],
    ['rejects', async () => Promise.reject(new Error('notify failed'))],
  ])('keeps the transition when the notifier %s', async (_label, notifier) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onTransitionCommitted = vi.fn(notifier);
    const { item, service, storage } = await setup(onTransitionCommitted);

    expect(await service.transition(request(item, { stage: 'shipped' }))).toMatchObject({ status: 'accepted' });
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages[0]).toBe('shipped');
    warn.mockRestore();
  });
});

describe('pull request cards on the Work board', () => {
  async function prCard(
    storage: WorkItemsStorage,
    overrides: { source?: 'github-pr' | 'gitlab-pr'; stages?: string[]; metadata?: Record<string, unknown> } = {},
  ) {
    return createItem(storage, {
      board: 'work',
      source: overrides.source ?? 'github-pr',
      stages: overrides.stages ?? ['intake'],
      metadata: overrides.metadata ?? { authorTrusted: true },
    });
  }

  it('runs the PR reviewer in its own review seat when a person clicks Review, into PR review', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await prCard(storage);
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
      selfReviewEnabled: async () => true,
    });

    const result = await service.transition({ ...request(item, { stage: 'pr-review' }), cause: 'card_action' });

    expect(result).toMatchObject({
      status: 'accepted',
      stage: 'pr-review',
      decisions: [{ type: 'invokeSkill', role: 'review', skillName: 'factory-review' }],
    });
    // Neither self-review nor a builder session: only the PR reviewer.
    expect(result.status === 'accepted' && result.decisions).toHaveLength(1);
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.board).toBe('work');
  });

  it('runs the GitLab reviewer for a merge request card', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await prCard(storage, { source: 'gitlab-pr' });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    await expect(service.transition(request(item, { stage: 'pr-review' }))).resolves.toMatchObject({
      status: 'accepted',
      decisions: [{ type: 'invokeSkill', role: 'review', skillName: 'factory-gitlab-review' }],
    });
  });

  it('re-reviews from Done with the full re-review skill, and supersedes a live pass on re-entry', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const done = await prCard(storage, {
      stages: ['done'],
      metadata: { authorTrusted: true, reviewVerdict: 'approve' },
    });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    const fromDone = await service.transition(request(done, { stage: 'pr-review', identity: 'from-done' }));
    expect(fromDone).toMatchObject({
      status: 'accepted',
      decisions: [{ type: 'invokeSkill', role: 'review', skillName: 'factory-rereview' }],
    });
    assert(fromDone.status === 'accepted');
    expect(fromDone.decisions[0]).not.toHaveProperty('cancelInFlight');

    const reviewing = (await storage.get({ orgId: 'org-1', id: done.id }))!;
    const again = await service.transition({
      ...request(reviewing, { stage: 'pr-review', identity: 'again' }),
      reenter: true,
    });
    expect(again).toMatchObject({
      status: 'accepted',
      decisions: [{ type: 'invokeSkill', role: 'review', skillName: 'factory-rereview', cancelInFlight: true }],
    });
  });

  it.each(['triage', 'planning', 'execute'] as const)('keeps a PR card out of %s', async stage => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await prCard(storage);
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    await expect(service.transition(request(item, { stage }))).resolves.toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
    });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
  });

  it('lets the reviewer close a PR card: the review prompts, not the board, keep Done for the merge', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await prCard(storage, {
      stages: ['pr-review'],
      metadata: { authorTrusted: true, reviewVerdict: 'approve' },
    });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    const result = await service.transition({
      ...request(item, { stage: 'done' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'review' },
      ingress: { type: 'agent', identity: 'agent-done' },
    });

    expect(result).toMatchObject({ status: 'accepted', stage: 'done' });
  });

  it('lets a person close or cancel a PR card', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await prCard(storage, { stages: ['pr-review'] });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    await expect(service.transition(request(item, { stage: 'canceled' }))).resolves.toMatchObject({
      status: 'accepted',
      stage: 'canceled',
    });
  });

  it('refuses an agent pulling an untrusted PR card into PR review', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await prCard(storage, { metadata: { authorTrusted: false } });
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    const result = await service.transition({
      ...request(item, { stage: 'pr-review' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'review' },
      ingress: { type: 'agent', identity: 'self-resume' },
    });

    expect(result).toMatchObject({ status: 'rejected', code: 'approval_required' });
  });

  it('still runs self-review, not the PR reviewer, for an issue card entering Review', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { board: 'work', stages: ['execute'] });
    const service = new FactoryTransitionService({
      configVersion: 'rules-v1',
      storage,
      selfReviewEnabled: async () => true,
    });

    await expect(service.transition(request(item, { stage: 'review' }))).resolves.toMatchObject({
      status: 'accepted',
      decisions: [{ type: 'invokeSkill', role: 'review', skillName: 'factory-self-review' }],
    });
  });

  it('keeps PR review for pull request cards: an issue card cannot enter it, nor a PR card self-review', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const issue = await createItem(storage, { board: 'work', stages: ['intake'] });
    const pr = await prCard(storage);
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage });

    await expect(service.transition(request(issue, { stage: 'pr-review' }))).resolves.toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
    });
    await expect(
      service.transition(request(pr, { stage: 'review', identity: 'pr-self-review' })),
    ).resolves.toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
    });
    expect((await storage.get({ orgId: 'org-1', id: issue.id }))?.stages).toEqual(['intake']);
    expect((await storage.get({ orgId: 'org-1', id: pr.id }))?.stages).toEqual(['intake']);
  });

  it('keeps the PR review run applicable in PR review and overtaken once the card leaves it', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await prCard(storage);
    const boards = createBoardRegistry();
    const service = new FactoryTransitionService({ configVersion: 'rules-v1', storage, boards });

    await service.transition(request(item, { stage: 'pr-review' }));
    const [record] = (await storage.listDeferredDecisions('org-1', PROJECT_ID)).filter(
      row => row.decision.type === 'invokeSkill',
    );
    assert(record);
    const reviewing = (await storage.get({ orgId: 'org-1', id: item.id }))!;
    expect(decisionOvertaken({ boards, item: reviewing, record, role: 'review', siblings: [record] })).toBe(false);

    await new Promise(resolve => setTimeout(resolve, 5));
    await service.transition(request(reviewing, { stage: 'canceled', identity: 'cancel' }));
    const canceled = (await storage.get({ orgId: 'org-1', id: item.id }))!;
    expect(decisionOvertaken({ boards, item: canceled, record, role: 'review', siblings: [record] })).toBe(true);
  });
});

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

/** Work items on LibSQL, or on PostgreSQL when FACTORY_TEST_POSTGRES_URL names a disposable database. */
async function workItemsOn(backend: 'libsql' | 'pg'): Promise<WorkItemsStorage> {
  if (backend === 'libsql') return (await createFactoryStorageForTests()).workItems;
  const storage = new PgFactoryStorage({ id: `transition-${randomUUID()}`, connectionString: postgresUrl! });
  const workItems = storage.registerDomain(new WorkItemsStorage());
  const boards = createBoardRegistry();
  workItems.useTerminalPhasePredicate(item => workItemPhaseSemantics(boards, item)?.kind === 'terminal');
  await storage.init();
  onTestFinished(() => storage.close());
  return workItems;
}

describe.each(postgresUrl ? (['libsql', 'pg'] as const) : (['libsql'] as const))(
  'Work and Review board rules for agents on %s',
  backend => {
    // Each test gets its own org, so runs sharing one PostgreSQL database never see each other's cards.
    let org = 'org-1';
    const agent = (role: string, identity: string) => ({
      actor: { type: 'agent' as const, bindingId: `${role}-binding`, role },
      ingress: { type: 'agent' as const, identity },
    });

    async function card(stage: string, metadata: Record<string, unknown> = {}) {
      org = `org-${randomUUID()}`;
      const storage = await workItemsOn(backend);
      const item = await createItem(storage, {
        orgId: org,
        sourceKey: org,
        stages: [stage],
        metadata: { authorTrusted: true, ...metadata },
      });
      const service = new FactoryTransitionService({ configVersion: 'work-rules', storage });
      return { storage, item, service };
    }

    it('lets the triage agent send an open non-bug back to Intake, and a person moving it on is the approval', async () => {
      const { storage, item } = await card('triage');
      const onAccepted = vi.fn();
      const service = new FactoryTransitionService({ configVersion: 'work-rules', storage, onAccepted });
      await expect(
        service.transition({
          ...request(item, { orgId: org, stage: 'intake' }),
          ...agent('triage', 'feature-request'),
        }),
      ).resolves.toMatchObject({ status: 'accepted', stage: 'intake' });
      const resting = await storage.get({ orgId: org, id: item.id });
      expect(resting).toMatchObject({ stages: ['intake'], triageType: null, acceptedAt: null });
      expect(onAccepted).not.toHaveBeenCalled();

      await expect(
        service.transition({ ...request(resting!, { orgId: org, stage: 'planning', identity: 'approve' }) }),
      ).resolves.toMatchObject({ status: 'accepted', stage: 'planning' });
      await vi.waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));
      expect(onAccepted.mock.calls[0]![0]).toMatchObject({ orgId: org, workItemId: item.id });
      expect(await storage.get({ orgId: org, id: item.id })).toMatchObject({
        stages: ['planning'],
        triageType: null,
        acceptedAt: null,
      });
    });

    it('fires the approval hook only for a person, not for an agent or a board rule moving the card on', async () => {
      for (const mover of [
        agent('work', 'agent-plan'),
        {
          actor: { type: 'system' as const, id: 'factory-rule-dispatcher' },
          ingress: { type: 'rule' as const, identity: 'rule-plan' },
        },
      ]) {
        const { storage, item } = await card('intake');
        const onAccepted = vi.fn();
        const service = new FactoryTransitionService({ configVersion: 'work-rules', storage, onAccepted });
        await expect(
          service.transition({ ...request(item, { orgId: org, stage: 'planning' }), ...mover }),
        ).resolves.toMatchObject({ status: 'accepted' });
        expect(onAccepted).not.toHaveBeenCalled();
      }
    });

    it.each([
      ['with no pull request', 'execute', {}],
      ['once self-review approves', 'review', { selfReviewVerdict: 'approve' }],
      ['once a review approves', 'review', { reviewVerdict: 'approve', openPullRequestNumber: null }],
      // Done is not guarded in code: the build and self-review prompts say when work is finished.
      ['while its pull request is still open', 'review', { selfReviewVerdict: 'approve', openPullRequestNumber: 17 }],
      ['while a review requests changes', 'review', { reviewVerdict: 'request changes' }],
      ['before self-review has a verdict', 'review', {}],
    ])('lets the builder close work %s', async (_label, stage, metadata) => {
      const { item, service } = await card(stage, metadata);
      await expect(
        service.transition({ ...request(item, { orgId: org, stage: 'done' }), ...agent('work', 'close') }),
      ).resolves.toMatchObject({ status: 'accepted', stage: 'done' });
    });

    it('lets the builder hand a pushed branch to Review', async () => {
      const { item, service } = await card('execute');
      await expect(
        service.transition({ ...request(item, { orgId: org, stage: 'review' }), ...agent('work', 'hand-off') }),
      ).resolves.toMatchObject({ status: 'accepted', stage: 'review' });
    });

    it('moves every card along the Work flow, for people and agents alike', async () => {
      const flow: Record<string, readonly string[]> = {
        intake: ['triage', 'planning', 'review', 'done', 'canceled'],
        triage: ['intake', 'planning', 'done', 'canceled'],
        planning: ['execute', 'intake', 'done', 'canceled'],
        execute: ['review', 'planning', 'done', 'canceled'],
        review: ['execute', 'intake', 'done', 'canceled'],
        done: ['review'],
        canceled: ['intake'],
      };
      org = `org-${randomUUID()}`;
      const storage = await workItemsOn(backend);
      const service = new FactoryTransitionService({ configVersion: 'work-rules', storage });
      const seen: string[] = [];
      for (const [from, allowed] of Object.entries(flow)) {
        for (const to of Object.keys(flow).filter(stage => stage !== from)) {
          const item = await createItem(storage, {
            orgId: org,
            sourceKey: `${org}-${from}-${to}`,
            stages: [from],
            metadata: { authorTrusted: true },
          });
          const byPerson = await service.transition(
            request(item, { orgId: org, stage: to as FactoryRuleStage, identity: `person-${from}-${to}` }),
          );
          if (allowed.includes(to)) {
            expect(byPerson, `${from} -> ${to}`).toMatchObject({ status: 'accepted', stage: to });
            seen.push(`${from}->${to}`);
            continue;
          }
          expect(byPerson, `${from} -> ${to}`).toMatchObject({ status: 'rejected', code: 'invalid_transition' });
          const byAgent = await service.transition({
            ...request(item, { orgId: org, stage: to as FactoryRuleStage, identity: `agent-${from}-${to}` }),
            ...agent('work', `${from}-${to}`),
          });
          expect(byAgent, `${from} -> ${to}`).toMatchObject({ status: 'rejected', code: 'invalid_transition' });
          expect((await storage.get({ orgId: org, id: item.id }))?.stages).toEqual([from]);
        }
      }
      expect(seen).toHaveLength(Object.values(flow).flat().length);
    });

    it('resumes a card self-review parked in Intake through Review, never straight into Building', async () => {
      const parked = { selfReviewVerdict: 'request changes', selfReviewRounds: 3, selfReviewNeedsHuman: true };
      const { storage, item, service } = await card('intake', parked);
      await expect(
        service.transition({ ...request(item, { orgId: org, stage: 'execute' }), cause: 'board_drag' }),
      ).resolves.toMatchObject({ status: 'rejected', code: 'invalid_transition' });
      const resumed = await service.transition({
        ...request(item, { orgId: org, stage: 'review', identity: 'resume' }),
        cause: 'board_drag',
      });
      expect(resumed).toMatchObject({ status: 'accepted', stage: 'review' });
      const reviewing = (await storage.get({ orgId: org, id: item.id }))!;
      await expect(
        service.transition({ ...request(reviewing, { orgId: org, stage: 'execute' }), ...agent('review', 'changes') }),
      ).resolves.toMatchObject({ status: 'accepted', stage: 'execute' });
    });

    it('leaves Done on the Review board to its own flow: the review prompts keep it for the merge', async () => {
      org = `org-${randomUUID()}`;
      const storage = await workItemsOn(backend);
      const service = new FactoryTransitionService({ configVersion: 'review-rules', storage });
      const reviewCard = (key: string, stage = 'review') =>
        createItem(storage, {
          orgId: org,
          board: 'review',
          source: 'github-pr',
          sourceKey: `${org}-${key}`,
          stages: [stage],
          metadata: { authorTrusted: true, reviewVerdict: 'approve' },
        });

      for (const [key, mover] of [
        ['agent', agent('review', 'review-done')],
        [
          'merge',
          {
            actor: { type: 'system' as const, id: 'factory-rule-dispatcher' },
            ingress: { type: 'rule' as const, identity: 'merge' },
          },
        ],
        ['person', {}],
      ] as const) {
        const reviewed = await reviewCard(key);
        await expect(
          service.transition({ ...request(reviewed, { orgId: org, stage: 'done', identity: key }), ...mover }),
        ).resolves.toMatchObject({ status: 'accepted', stage: 'done' });
      }
      // Done reopens only into review; nobody files a finished pull request back into Intake.
      const finished = await reviewCard('finished', 'done');
      await expect(
        service.transition(request(finished, { orgId: org, board: 'review', stage: 'intake', identity: 'reopen' })),
      ).resolves.toMatchObject({ status: 'rejected', code: 'invalid_transition' });
    });
  },
);
