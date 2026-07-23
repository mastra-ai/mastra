import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defaultFactoryRules } from './defaults.js';
import { FactoryTransitionService } from './transition-service.js';
import type { FactoryRuleBoard, FactoryRuleStage } from './types.js';
import { MAX_FACTORY_RULE_CAUSAL_DEPTH } from './validation.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function createItem(
  storage: WorkItemsStorage,
  overrides: Partial<{ orgId: string; source: 'github-issue' | 'github-pr'; sourceKey: string; stages: string[] }> = {},
) {
  const orgId = overrides.orgId ?? 'org-1';
  return (
    await storage.upsert({
      orgId,
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: {
          integrationId: 'github',
          type: (overrides.source ?? 'github-issue') === 'github-pr' ? 'pull-request' : 'issue',
          externalId: overrides.sourceKey ?? '1',
        },
        title: 'Fix the bug',
        stages: overrides.stages ?? ['intake'],
        sessions: {},
        metadata: {},
      },
    })
  ).item;
}

function request(
  item: { id: string; revision: number },
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
    board: overrides.board ?? ('work' as const),
    stage: overrides.stage ?? ('execute' as const),
    expectedRevision: overrides.expectedRevision ?? item.revision,
    actor: { type: 'human' as const, id: 'user-1' },
    ingress: { type: 'human' as const, identity: overrides.identity ?? 'request-1' },
    cause: 'test',
    causalChain: overrides.causalChain,
  };
}

describe('FactoryTransitionService', () => {
  it('queues an urgent wake-up when a board drag has no skill follow-up', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['triage'] });
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });

    const result = await service.transition({
      ...request(item, { stage: 'execute' }),
      cause: 'board_drag',
    });

    expect(result).toMatchObject({ status: 'accepted' });
    expect(result.status === 'accepted' ? result.decisions : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'sendMessage',
          role: 'work',
          message: 'This work was moved from the triage stage to the execute stage.',
          priority: 'urgent',
          idleBehavior: 'wake',
          prepareBinding: true,
        }),
      ]),
    );
  });

  it('attaches a persisted notice to a skill triggered by a board drag', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });

    const result = await service.transition({
      ...request(item, { stage: 'triage' }),
      cause: 'board_drag',
    });

    expect(result).toMatchObject({ status: 'accepted' });
    expect(result.status === 'accepted' ? result.decisions : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'invokeSkill',
          role: 'triage',
          skillName: 'factory-triage',
          precedingMessage: 'This work was moved from the intake stage to the triage stage.',
        }),
      ]),
    );
  });

  it('runs onExit before onEnter and atomically persists accepted decisions', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const order: string[] = [];
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
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
      },
    });

    const result = await new FactoryTransitionService({ rules, storage }).transition(request(item));

    expect(order).toEqual(['exit', 'enter']);
    expect(result).toMatchObject({ status: 'accepted', revision: 2, stage: 'execute' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stageHistory.map(entry => entry.stage)).toEqual([
      'intake',
      'execute',
    ]);
    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID)).map(entry => entry.idempotencyKey)).toEqual([
      'notify-exit',
      'message-enter',
    ]);
  });

  it('persists rule rejection without moving or queuing decisions', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: { onEnter: () => ({ type: 'reject', code: 'forbidden', reason: 'Approval is required.' }) },
          },
        },
      },
    });

    const result = await new FactoryTransitionService({ rules, storage }).transition(request(item));

    expect(result).toMatchObject({ status: 'rejected', code: 'forbidden', reason: 'Approval is required.' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });

  it('turns thrown rules into bounded safe rejection', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: { execute: { issue: { onEnter: () => Promise.reject(new Error('provider unavailable')) } } },
      },
    });

    const result = await new FactoryTransitionService({ rules, storage }).transition(request(item));

    expect(result).toMatchObject({ status: 'rejected', code: 'rule_error' });
    expect(result.status === 'rejected' ? result.reason : '').toContain('provider unavailable');
  });

  it('applies one timeout to the full primary evaluation and ignores late resolution', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    let resolveRule!: (value: { type: 'notify'; idempotencyKey: string; title: string }) => void;
    const lateRule = new Promise<{ type: 'notify'; idempotencyKey: string; title: string }>(resolve => {
      resolveRule = resolve;
    });
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: { work: { execute: { issue: { onEnter: () => lateRule } } } },
    });

    vi.useFakeTimers();
    try {
      const transition = new FactoryTransitionService({ rules, storage }).transition(request(item));
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
    const service = new FactoryTransitionService({ rules: defaultFactoryRules({ version: 'rules-v1' }), storage });
    await storage.update({ orgId: 'org-1', id: item.id, userId: 'user-2', patch: { title: 'Changed concurrently' } });

    const result = await service.transition(request(item));

    expect(result).toMatchObject({ status: 'rejected', code: 'stale' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
  });

  it('replays immutable ingress across rule version changes without re-evaluation', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const first = await new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    }).transition(request(item));
    const laterRule = vi.fn(() => ({ type: 'reject' as const, code: 'forbidden' as const, reason: 'new policy' }));
    const rulesV2 = defaultFactoryRules({
      version: 'rules-v2',
      overrides: { work: { execute: { issue: { onEnter: laterRule } } } },
    });

    const replay = await new FactoryTransitionService({ rules: rulesV2, storage }).transition(
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
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: { work: { execute: { issue: { onEnter: handler } } } },
      }),
      storage,
    });
    const missing = { id: '00000000-0000-4000-8000-000000000099', revision: 1 };

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
      rules: defaultFactoryRules({ version: 'rules-v1' }),
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
    const service = new FactoryTransitionService({ rules: defaultFactoryRules({ version: 'rules-v1' }), storage });
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
    const service = new FactoryTransitionService({ rules: defaultFactoryRules({ version: 'rules-v1' }), storage });

    const discard = await service.transition(request(item, { stage: 'canceled', identity: 'discard-1' }));
    expect(discard).toMatchObject({ status: 'accepted', stage: 'canceled' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['canceled']);

    // An item sitting in canceled still has a canonical stage, so it can be
    // pulled back onto the board.
    const revive = await service.transition(
      request({ id: item.id, revision: 2 }, { stage: 'triage', identity: 'revive-1' }),
    );
    expect(revive).toMatchObject({ status: 'accepted', stage: 'triage' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['triage']);
  });

  it('scopes ingress replay and deferred idempotency to the tenant', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const first = await createItem(storage, { orgId: 'org-1', sourceKey: 'github-issue:one' });
    const second = await createItem(storage, { orgId: 'org-2', sourceKey: 'github-issue:two' });
    const handler = () => ({ type: 'notify' as const, idempotencyKey: 'same-effect-key', title: 'Moved' });
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: { work: { execute: { issue: { onEnter: handler } } } },
    });
    const service = new FactoryTransitionService({ rules, storage });

    await service.transition(request(first, { identity: 'same-ingress' }));
    await service.transition(request(second, { orgId: 'org-2', identity: 'same-ingress' }));

    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toHaveLength(1);
    expect(await storage.listDeferredDecisions('org-2', PROJECT_ID)).toHaveLength(1);
  });
});
