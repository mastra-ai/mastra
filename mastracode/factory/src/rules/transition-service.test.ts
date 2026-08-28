import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defaultFactoryRules } from './defaults.js';
import { FactoryTransitionService } from './transition-service.js';
import type { FactoryRuleBoard, FactoryRuleStage, FactoryStageRuleContext } from './types.js';
import { MAX_FACTORY_RULE_CAUSAL_DEPTH } from './validation.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function createItem(
  storage: WorkItemsStorage,
  overrides: Partial<{
    orgId: string;
    source: 'github-issue' | 'github-pr' | 'slack-thread';
    sourceKey: string;
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
        externalSource: {
          integrationId: source === 'slack-thread' ? 'slack' : 'github',
          type: source === 'slack-thread' ? 'slack-thread' : source === 'github-pr' ? 'pull-request' : 'issue',
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
  it('replays concurrent transitions with the same ingress identity', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });

    const [first, second] = await Promise.all([service.transition(request(item)), service.transition(request(item))]);

    expect(second).toEqual(first);
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.revision).toBe(item.revision + 1);
  });

  it('persists a feature classification without allowing a triage agent into Planning', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const planningRule = vi.fn();
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: { work: { planning: { issue: { onEnter: planningRule } } } },
      }),
      storage,
    });
    const classified = await service.transition({
      ...request(item, { stage: 'intake', identity: 'triage-feature' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'triage' },
      ingress: { type: 'agent', identity: 'triage-feature' },
      triageType: 'feature request',
    });

    expect(classified).toMatchObject({ status: 'accepted', revision: item.revision + 1 });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.triageType).toBe('feature request');
    const rejected = await service.transition({
      ...request({ id: item.id, revision: item.revision + 1 }, { stage: 'planning', identity: 'plan-agent' }),
      actor: { type: 'agent', bindingId: 'binding-2', role: 'triage' },
      ingress: { type: 'agent', identity: 'plan-agent' },
      triageType: 'feature request',
    });

    expect(rejected).toMatchObject({ status: 'rejected', code: 'approval_required' });
    expect(planningRule).not.toHaveBeenCalled();
  });

  it('allows a human to approve a classified feature into Planning', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const service = new FactoryTransitionService({ rules: defaultFactoryRules({ version: 'rules-v1' }), storage });
    await service.transition({
      ...request(item, { stage: 'intake', identity: 'triage-feature' }),
      actor: { type: 'agent', bindingId: 'binding-1', role: 'triage' },
      ingress: { type: 'agent', identity: 'triage-feature' },
      triageType: 'feature request',
    });

    const approved = await service.transition(
      request({ id: item.id, revision: item.revision + 1 }, { stage: 'planning' }),
    );
    expect(approved).toMatchObject({ status: 'accepted', stage: 'planning' });
  });

  it('rejects every non-human ingress at both protected gates even when autonomy is armed', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const planningRule = vi.fn();
    const executeRule = vi.fn();
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: {
          work: {
            planning: { issue: { onEnter: planningRule } },
            execute: { issue: { onEnter: executeRule } },
          },
        },
      }),
      storage,
    });
    const classified = await service.transition({
      ...request(item, { stage: 'intake', identity: 'classify' }),
      actor: { type: 'agent', bindingId: 'triage', role: 'triage' },
      ingress: { type: 'agent', identity: 'classify' },
      triageType: 'feature request',
    });
    const armed = await service.transition({
      ...request(
        { id: item.id, revision: (classified as { revision: number }).revision },
        { stage: 'triage', identity: 'arm' },
      ),
      ingress: { type: 'human', identity: 'arm' },
      cause: 'board_drag',
    });
    const revision = (armed as { revision: number }).revision;
    for (const [actor, ingress] of [
      [
        { type: 'agent', bindingId: 'agent', role: 'triage' },
        { type: 'agent', identity: 'agent-plan' },
      ],
      [
        { type: 'system', id: 'dispatcher' },
        { type: 'rule', identity: 'rule-plan' },
      ],
      [
        { type: 'system', id: 'tool-result' },
        { type: 'toolResult', identity: 'tool-plan' },
      ],
      [
        { type: 'github', login: 'octocat', trusted: true, factoryAuthored: true },
        { type: 'github', identity: 'github-plan' },
      ],
    ] as const) {
      await expect(
        service.transition({
          ...request({ id: item.id, revision }, { stage: 'planning', identity: ingress.identity }),
          actor,
          ingress,
          ...(actor.type === 'agent' && actor.role === 'triage' ? { triageType: 'feature request' as const } : {}),
        }),
      ).resolves.toMatchObject({ status: 'rejected', code: 'approval_required' });
    }
    const approved = await service.transition({
      ...request({ id: item.id, revision }, { stage: 'planning', identity: 'human-plan' }),
      cause: 'board_drag',
    });
    const planningRevision = (approved as { revision: number }).revision;
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
          ...request({ id: item.id, revision: planningRevision }, { stage: 'execute', identity: ingress.identity }),
          actor,
          ingress,
        }),
      ).resolves.toMatchObject({ status: 'rejected', code: 'approval_required' });
    }
    expect(planningRule).toHaveBeenCalledTimes(1);
    expect(executeRule).not.toHaveBeenCalled();
    const executed = await service.transition({
      ...request({ id: item.id, revision: planningRevision }, { stage: 'execute', identity: 'human-execute' }),
      cause: 'board_drag',
    });
    expect(executed).toMatchObject({ status: 'accepted', stage: 'execute' });
    const reviewed = await service.transition(
      request(
        { id: item.id, revision: (executed as { revision: number }).revision },
        { stage: 'review', identity: 'review' },
      ),
    );
    expect(reviewed).toMatchObject({ status: 'accepted', stage: 'review' });
  });

  it('keeps bugs autonomous and leaves grandfathered work and terminal transitions unaffected', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const bug = await createItem(storage);
    const service = new FactoryTransitionService({ rules: defaultFactoryRules({ version: 'rules-v1' }), storage });
    const planned = await service.transition({
      ...request(bug, { stage: 'planning', identity: 'bug-plan' }),
      actor: { type: 'agent', bindingId: 'triage', role: 'triage' },
      ingress: { type: 'agent', identity: 'bug-plan' },
      triageType: 'bug',
    });
    const executed = await service.transition({
      ...request(
        { id: bug.id, revision: (planned as { revision: number }).revision },
        { stage: 'execute', identity: 'bug-execute' },
      ),
      actor: { type: 'agent', bindingId: 'work', role: 'work' },
      ingress: { type: 'agent', identity: 'bug-execute' },
    });
    expect(executed).toMatchObject({ status: 'accepted', stage: 'execute' });
    const legacy = await createItem(storage, { stages: ['planning'], sourceKey: 'legacy' });
    await expect(
      service.transition({
        ...request(legacy, { stage: 'execute', identity: 'legacy-execute' }),
        actor: { type: 'agent', bindingId: 'work', role: 'work' },
        ingress: { type: 'agent', identity: 'legacy-execute' },
      }),
    ).resolves.toMatchObject({ status: 'accepted', stage: 'execute' });
    const closed = await createItem(storage, { sourceKey: 'closed-feature' });
    await expect(
      service.transition({
        ...request(closed, { stage: 'done', identity: 'feature-close' }),
        actor: { type: 'agent', bindingId: 'triage', role: 'triage' },
        ingress: { type: 'agent', identity: 'feature-close' },
        triageType: 'feature request',
      }),
    ).resolves.toMatchObject({ status: 'accepted', stage: 'done' });
  });

  it('does not run GitHub issue rules against a Slack thread card', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { source: 'slack-thread', stages: ['execute'] });
    const issueRule = vi.fn(() => ({ type: 'notify' as const, idempotencyKey: 'issue-effect', title: 'Issue' }));
    const manualRule = vi.fn(() => ({ type: 'notify' as const, idempotencyKey: 'manual-effect', title: 'Manual' }));
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: { work: { review: { issue: { onEnter: issueRule }, manual: { onEnter: manualRule } } } },
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
    const item = await createItem(storage, { metadata: { author: 'octocat' } });
    const rule = vi.fn((_context: FactoryStageRuleContext) => ({
      type: 'notify' as const,
      idempotencyKey: 'effect-1',
      title: 'Ran',
    }));
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: { work: { execute: { issue: { onEnter: rule } } } },
      }),
      storage,
    });

    await service.transition(request(item, { stage: 'execute' }));

    expect(rule.mock.calls[0]?.[0]).toMatchObject({ item: { metadata: { author: 'octocat' } } });
  });

  it('invokes onTerminalStage only after a transition commits into a terminal stage', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const onTerminalStage = vi.fn();
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
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
    });
  });

  it('never fails a committed terminal transition when onTerminalStage throws', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage);
    const onTerminalStage = vi.fn().mockRejectedValue(new Error('release failed'));
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
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
      rules: defaultFactoryRules({ version: 'rules-v1' }),
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
      rules: defaultFactoryRules({ version: 'rules-v1' }),
      storage,
    });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeNull();

    const result = await service.transition({ ...request(item, { stage: 'triage' }), cause: 'board_drag' });

    expect(result.status).toBe('accepted');
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.autonomyArmedAt).toBeInstanceOf(Date);
  });

  it('leaves autonomy unarmed when the mover is not a person', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['intake'] });
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
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

  it('queues an urgent wake-up when a board drag has no skill follow-up', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = await createItem(storage, { stages: ['triage'] });
    const service = new FactoryTransitionService({
      rules: defaultFactoryRules({ version: 'rules-v1' }),
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
          role: 'work',
          message: 'This work was moved from the triage stage to the canceled stage.',
          priority: 'urgent',
          idleBehavior: 'wake',
          prepareBinding: true,
        },
      ],
    });
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
