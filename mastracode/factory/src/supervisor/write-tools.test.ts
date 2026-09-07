import { describe, expect, it, vi } from 'vitest';

import { defaultFactoryRules } from '../rules/defaults.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactorySupervisorWriteTools } from './write-tools.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const SCOPE = { orgId: 'org-1', factoryProjectId: PROJECT_ID };
const NOW = new Date('2026-09-03T12:00:00.000Z');
const CLAIM_NOW = new Date('2100-01-01T00:00:00.000Z');

async function createItem(storage: WorkItemsStorage, number: number, stage = 'intake') {
  return (
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: `github-issue:${number}` },
        title: `Issue ${number}`,
        stages: [stage],
        sessions: {},
        metadata: { number },
      },
    })
  ).item;
}

async function bindRun(storage: WorkItemsStorage, item: Awaited<ReturnType<typeof createItem>>, number: number) {
  return storage.prepareRunStart({
    ...SCOPE,
    userId: 'user-1',
    workItem: { id: item.id, input: { title: item.title, stages: item.stages } },
    role: 'work',
    session: { sessionId: `session-${number}`, branch: `branch-${number}`, threadId: `thread-${number}` },
    resourceId: `session-${number}`,
    kickoffKey: `kickoff-${number}`,
    kickoffMessage: null,
  });
}

async function queueDecision(storage: WorkItemsStorage, number: number) {
  const item = await createItem(storage, number);
  const rules = defaultFactoryRules({
    version: 'rules-v1',
    overrides: {
      work: {
        execute: {
          issue: {
            onEnter: () => ({
              type: 'invokeSkill',
              role: 'work',
              skillName: 'factory-work',
              idempotencyKey: `work-${number}`,
            }),
          },
        },
      },
    },
  });
  const transitions = new FactoryTransitionService({ storage, rules });
  const moved = await transitions.transition({
    ...SCOPE,
    workItemId: item.id,
    board: 'work',
    stage: 'execute',
    expectedRevision: item.revision,
    actor: { type: 'human', id: 'user-1' },
    ingress: { type: 'human', identity: `move-${number}` },
    cause: 'board_drag',
  });
  expect(moved.status).toBe('accepted');
  const [decision] = await storage.claimDeferredDecisions({
    ownerId: 'test',
    now: CLAIM_NOW,
    leaseExpiresAt: new Date(CLAIM_NOW.getTime() + 30_000),
    limit: 1,
  });
  return { item: (await storage.get({ orgId: 'org-1', id: item.id }))!, decision: decision! };
}

function execute<T>(tool: unknown, input: unknown): Promise<T> {
  return (tool as { execute: (input: unknown, ctx: unknown) => Promise<T> }).execute(input, {});
}

async function setup() {
  const seed = await createFactoryStorageForTests();
  const onAccepted = vi.fn();
  const transitionService = new FactoryTransitionService({
    storage: seed.workItems,
    rules: defaultFactoryRules({ version: 'rules-v1' }),
    onAccepted,
  });
  const reconcileAcceptanceLabels = vi.fn().mockResolvedValue(undefined);
  const signalSession = vi.fn().mockResolvedValue(undefined);
  const tools = createFactorySupervisorWriteTools({
    scope: SCOPE,
    userId: 'user-supervisor',
    workItems: seed.workItems,
    audit: seed.audit,
    transitionService,
    reconcileAcceptanceLabels,
    signalSession,
    now: () => NOW,
  });
  return { ...seed, tools, transitionService, reconcileAcceptanceLabels, signalSession, onAccepted };
}

async function latestAudit(audit: Awaited<ReturnType<typeof setup>>['audit']) {
  return (await audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID, limit: 10 })).events[0];
}

async function auditByAction(audit: Awaited<ReturnType<typeof setup>>['audit'], action: string) {
  return (await audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID, limit: 10 })).events.find(
    event => event.action === action,
  );
}

describe('createFactorySupervisorWriteTools', () => {
  it('retries a failed decision and attributes the repair to the person', async () => {
    const context = await setup();
    const { decision } = await queueDecision(context.workItems, 1);
    await context.workItems.failDeferredDecision({
      id: decision.id,
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      ownerId: 'test',
      now: NOW,
      availableAt: NOW,
      lastError: 'boom',
      failureCode: 'unknown',
      terminal: true,
    });

    await expect(execute(context.tools.factory_retry_decision, { decisionId: decision.id })).resolves.toMatchObject({
      decisionId: decision.id,
      status: 'retry',
    });
    expect(await latestAudit(context.audit)).toMatchObject({
      actorId: 'user-supervisor',
      actorType: 'human',
      action: 'factory.run.retry',
      metadata: expect.objectContaining({ cause: 'supervisor' }),
    });
  });

  it('approves and dismisses proposals through the existing decision lifecycle', async () => {
    const approvedContext = await setup();
    const approved = await queueDecision(approvedContext.workItems, 2);
    await approvedContext.workItems.proposeDeferredDecision(
      { id: approved.decision.id, orgId: 'org-1', factoryProjectId: PROJECT_ID, ownerId: 'test' },
      NOW,
    );
    await expect(
      execute(approvedContext.tools.factory_resolve_proposal, {
        decisionId: approved.decision.id,
        resolution: 'approve',
      }),
    ).resolves.toMatchObject({ status: 'pending', resolution: 'approve' });
    expect(await latestAudit(approvedContext.audit)).toMatchObject({
      actorId: 'user-supervisor',
      actorType: 'human',
      action: 'factory.run.approved',
      metadata: expect.objectContaining({ cause: 'supervisor', workItemId: approved.item.id }),
    });

    const dismissedContext = await setup();
    const dismissed = await queueDecision(dismissedContext.workItems, 3);
    await dismissedContext.workItems.proposeDeferredDecision(
      { id: dismissed.decision.id, orgId: 'org-1', factoryProjectId: PROJECT_ID, ownerId: 'test' },
      NOW,
    );
    await expect(
      execute(dismissedContext.tools.factory_dismiss_decision, { decisionId: dismissed.decision.id }),
    ).resolves.toMatchObject({ status: 'dismissed' });
    expect(await latestAudit(dismissedContext.audit)).toMatchObject({
      actorId: 'user-supervisor',
      actorType: 'human',
      action: 'factory.run.dismissed',
      metadata: expect.objectContaining({ cause: 'supervisor', workItemId: dismissed.item.id }),
    });
  });

  it('throws when a requested transition is rejected', async () => {
    const context = await setup();
    const item = await createItem(context.workItems, 6);
    vi.spyOn(context.transitionService, 'transition').mockResolvedValue({
      status: 'rejected',
      code: 'stale_revision',
      reason: 'The work item changed before the transition was applied.',
      transitionId: 'transition-rejected',
    });

    await expect(
      execute(context.tools.factory_transition_work_item, { workItemId: item.id, stage: 'planning' }),
    ).rejects.toThrow('The transition was rejected (stale_revision)');
    expect(await auditByAction(context.audit, 'factory.work_item.transition_rejected')).toMatchObject({
      actorId: 'user-supervisor',
      actorType: 'human',
      metadata: expect.objectContaining({ cause: 'supervisor', code: 'stale_revision' }),
    });
  });

  it('moves a held card as a human so acceptance is remembered', async () => {
    const context = await setup();
    const item = await createItem(context.workItems, 4, 'triage');
    await context.workItems.commitTransition({
      ...SCOPE,
      workItemId: item.id,
      expectedRevision: item.revision,
      destinationStage: 'triage',
      actorId: 'triage-agent',
      ingress: { identity: 'classify-4', triggerType: 'tool', transitionId: 'classify-4' },
      ruleSetVersion: 'rules-v1',
      causalChain: [],
      evaluation: { outcome: 'accepted', decisions: [] },
      triageType: 'feature-request',
    });

    await expect(
      execute(context.tools.factory_transition_work_item, { workItemId: item.id, stage: 'planning' }),
    ).resolves.toMatchObject({ status: 'accepted', stage: 'planning' });
    const moved = await context.workItems.get({ orgId: 'org-1', id: item.id });
    expect(moved?.acceptedAt).toBeInstanceOf(Date);
    await vi.waitFor(() =>
      expect(context.onAccepted).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          factoryProjectId: PROJECT_ID,
          workItemId: item.id,
          item: expect.objectContaining({ acceptedAt: expect.any(Date) }),
        }),
      ),
    );
    expect(await latestAudit(context.audit)).toMatchObject({
      actorId: 'user-supervisor',
      actorType: 'human',
      action: 'factory.work_item.stage_moved',
      metadata: expect.objectContaining({ cause: 'supervisor', to: 'planning' }),
    });

    await expect(execute(context.tools.factory_reconcile_labels, { workItemId: item.id })).resolves.toEqual({
      workItemId: item.id,
      reconciled: true,
    });
    expect(context.reconcileAcceptanceLabels).toHaveBeenCalledWith({
      ...SCOPE,
      item: expect.objectContaining({ id: item.id, acceptedAt: expect.any(Date) }),
    });
    expect(await auditByAction(context.audit, 'factory.work_item.labels_reconciled')).toMatchObject({
      actorId: 'user-supervisor',
      actorType: 'human',
      action: 'factory.work_item.labels_reconciled',
      metadata: expect.objectContaining({ cause: 'supervisor' }),
    });
  });

  it('revokes a stale binding and audits its role', async () => {
    const context = await setup();
    const item = await createItem(context.workItems, 5, 'execute');
    const { binding } = await bindRun(context.workItems, item, 5);

    await expect(execute(context.tools.factory_revoke_binding, { bindingId: binding.id })).resolves.toMatchObject({
      status: 'revoked',
      role: 'work',
    });
    expect(await latestAudit(context.audit)).toMatchObject({
      actorId: 'user-supervisor',
      actorType: 'human',
      action: 'factory.intake.binding_updated',
      metadata: expect.objectContaining({ cause: 'supervisor', role: 'work' }),
    });
  });

  it('signals only a session bound to this factory', async () => {
    const context = await setup();
    const item = await createItem(context.workItems, 6, 'execute');
    await bindRun(context.workItems, item, 6);

    await expect(
      execute(context.tools.factory_signal_session, { sessionId: 'session-6', message: 'Please stop after tests.' }),
    ).resolves.toMatchObject({ delivered: true, workItemId: item.id });
    expect(context.signalSession).toHaveBeenCalledWith({
      sessionId: 'session-6',
      message: 'Please stop after tests.',
      userId: 'user-supervisor',
    });
    expect(await latestAudit(context.audit)).toMatchObject({
      actorId: 'user-supervisor',
      actorType: 'human',
      action: 'factory.agent.signaled',
      metadata: expect.objectContaining({ cause: 'supervisor', workItemId: item.id, role: 'work' }),
    });
    await expect(
      execute(context.tools.factory_signal_session, { sessionId: 'foreign', message: 'No.' }),
    ).rejects.toThrow('does not belong to this factory');
  });
});
