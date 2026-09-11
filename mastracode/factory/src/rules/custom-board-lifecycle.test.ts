import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry, defineBoard, workItemPhaseSemantics } from '../boards/index.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { createTerminalStageCleanup } from './terminal-cleanup.js';
import { FactoryTransitionService } from './transition-service.js';
import type { FactoryStageRuleContext, FactoryRuleHandler } from './types.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function setup(options: { reject?: 'exit' | 'enter'; advance?: boolean } = {}) {
  const seed = await createFactoryStorageForTests();
  const storage = seed.workItems;
  const calls: Array<{ event: string; context: FactoryStageRuleContext }> = [];
  const handler =
    (event: string): FactoryRuleHandler<FactoryStageRuleContext> =>
    context => {
      calls.push({ event, context });
      if (
        (options.reject === 'exit' && event === 'queued:exit') ||
        (options.reject === 'enter' && event === 'preparing:enter')
      ) {
        return { type: 'reject', code: 'forbidden', reason: 'Release blocked' };
      }
      if (event === 'queued:exit')
        return { type: 'transition', idempotencyKey: 'finish-release', board: 'release', stage: 'shipped' };
      if (event === 'preparing:enter' && options.advance)
        return {
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'distribution',
          board: 'distribution',
          stage: 'waiting',
          source: 'github-issue',
          sourceKey: 'distribution:42',
          title: 'Distribute release',
          url: 'https://github.com/mastra-ai/mastra/issues/42',
        };
    };
  const wrongSource = vi.fn();
  const wrongBoard = vi.fn();
  const release = defineBoard({
    id: 'release',
    title: 'Release',
    initialPhase: 'queued',
    phases: {
      queued: {
        title: 'Queued',
        kind: 'resting',
        next: 'preparing',
        onEnter: { issue: handler('queued:enter'), 'pull-request': wrongSource },
        onExit: { issue: handler('queued:exit') },
      },
      preparing: {
        title: 'Preparing',
        kind: 'working',
        role: 'release-preparer',
        next: 'shipped',
        onEnter: { issue: handler('preparing:enter') },
        onExit: { issue: handler('preparing:exit') },
      },
      shipped: { title: 'Shipped', kind: 'terminal', onEnter: { issue: handler('shipped:enter') } },
    },
  });
  const distribution = defineBoard({
    id: 'distribution',
    title: 'Distribution',
    initialPhase: 'waiting',
    phases: {
      waiting: { title: 'Waiting', kind: 'resting', onEnter: { issue: handler('waiting:enter') } },
    },
  });
  const unrelated = defineBoard({
    id: 'unrelated',
    title: 'Unrelated',
    initialPhase: 'queued',
    phases: {
      queued: { title: 'Queued', kind: 'resting', onEnter: { issue: wrongBoard } },
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
    calls,
    wrongSource,
    wrongBoard,
    dispatcher,
    releaseSandboxes,
  };
}

describe('custom board lifecycle integration without built-in boards', () => {
  it('runs source-specific entry, exit-before-entry, deferred lifecycle decisions and terminal cleanup', async () => {
    const h = await setup({ advance: true });
    expect(await h.move('queued', 'initial', { initialEntry: true })).toMatchObject({ status: 'accepted' });
    expect(h.calls.map(call => call.event)).toEqual(['queued:enter']);
    expect(await h.move('preparing', 'prepare')).toMatchObject({ status: 'accepted' });
    expect(h.calls.map(call => call.event)).toEqual(['queued:enter', 'queued:exit', 'preparing:enter']);
    expect(h.calls[1]!.context).toMatchObject({
      board: 'release',
      actor: { type: 'system', id: 'release-coordinator' },
      configVersion: 'custom-lifecycle-v1',
      source: 'issue',
      stage: 'queued',
      fromStage: 'queued',
      toStage: 'preparing',
      tenant: { orgId: 'org-1', projectId: PROJECT_ID },
    });
    expect(h.calls[2]!.context).toMatchObject({
      board: 'release',
      source: 'issue',
      stage: 'preparing',
      fromStage: 'queued',
      toStage: 'preparing',
    });
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
    await h.dispatcher.runOnce();
    await h.dispatcher.runOnce();
    expect(await h.storage.listRunBindings('org-1', PROJECT_ID)).toEqual([
      expect.objectContaining({ id: prepared.binding.id, status: 'revoked' }),
    ]);
    expect(await h.storage.get({ orgId: 'org-1', id: h.item.id })).toMatchObject({
      board: 'release',
      stages: ['shipped'],
    });
    expect(h.calls.map(call => call.event)).toEqual(
      expect.arrayContaining(['preparing:exit', 'shipped:enter', 'waiting:enter']),
    );
    expect(h.releaseSandboxes).toHaveBeenCalledOnce();
    expect(h.wrongSource).not.toHaveBeenCalled();
    expect(h.wrongBoard).not.toHaveBeenCalled();
    const effects = await h.storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(effects).toHaveLength(2);
    expect(effects.map(effect => ({ type: effect.decision.type, status: effect.status }))).toEqual(
      expect.arrayContaining([
        { type: 'transition', status: 'succeeded' },
        { type: 'upsertLinkedWorkItem', status: 'succeeded' },
      ]),
    );
    const linkedItems = (await h.storage.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).filter(
      item => item.board === 'distribution',
    );
    expect(linkedItems).toEqual([
      expect.objectContaining({
        board: 'distribution',
        stages: ['waiting'],
        parentWorkItemId: h.item.id,
        revision: 1,
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'distribution:42',
          url: 'https://github.com/mastra-ai/mastra/issues/42',
        },
      }),
    ]);
    const audits = await h.db.findMany('factory_rule_evaluations', {});
    expect(audits.length).toBeGreaterThanOrEqual(4);
    expect(audits.every(row => row.rule_set_version === 'custom-lifecycle-v1')).toBe(true);
    const count = h.calls.length;
    const terminal = await h.storage.get({ orgId: 'org-1', id: h.item.id });
    for (const effect of effects) {
      await h.db.updateAtomic('factory_deferred_decisions', { id: effect.id }, () => ({ status: 'pending' }));
    }
    await h.dispatcher.runOnce();
    expect(h.calls).toHaveLength(count);
    expect(h.releaseSandboxes).toHaveBeenCalledOnce();
    expect(await h.storage.get({ orgId: 'org-1', id: h.item.id })).toMatchObject({ revision: terminal!.revision });
    expect(await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual(
      effects.map(effect =>
        expect.objectContaining({
          id: effect.id,
          decision: effect.decision,
          status: 'succeeded',
          attempts: effect.attempts + 1,
        }),
      ),
    );
    expect(await h.db.findMany('factory_rule_evaluations', {})).toEqual(audits);
    expect(
      (await h.storage.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).filter(
        item => item.board === 'distribution',
      ),
    ).toEqual(linkedItems);
  });

  it.each(['exit', 'enter'] as const)(
    'keeps state and accumulated lifecycle effects atomic when %s rejects',
    async reject => {
      const h = await setup({ reject });
      expect(await h.move('preparing', 'rejected')).toMatchObject({ status: 'rejected', code: 'forbidden' });
      expect(await h.storage.get({ orgId: 'org-1', id: h.item.id })).toMatchObject({
        stages: ['queued'],
        revision: h.item.revision,
      });
      expect(await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).toHaveLength(0);
      expect(h.calls.map(call => call.event)).toEqual(
        reject === 'exit' ? ['queued:exit'] : ['queued:exit', 'preparing:enter'],
      );
      await h.dispatcher.runOnce();
      expect(h.releaseSandboxes).not.toHaveBeenCalled();
    },
  );

  it('does nothing for an undeclared source on an installed custom board', async () => {
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
    expect(h.calls).toEqual([]);
    expect(h.wrongSource).not.toHaveBeenCalled();
    expect(h.wrongBoard).not.toHaveBeenCalled();
    expect(await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });

  it('distinguishes committed replay from explicit reentry', async () => {
    const h = await setup();
    const result = await h.move('queued', 'initial', { initialEntry: true });
    expect(await h.move('queued', 'initial', { initialEntry: true })).toEqual(result);
    expect(h.calls.map(call => call.event)).toEqual(['queued:enter']);
    expect(await h.move('queued', 'reenter', { reenter: true })).toMatchObject({ status: 'accepted' });
    expect(h.calls.map(call => call.event)).toEqual(['queued:enter', 'queued:enter']);
    expect(await h.storage.listDeferredDecisions('org-1', PROJECT_ID)).toHaveLength(0);
  });
});
