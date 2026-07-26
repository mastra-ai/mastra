import { describe, expect, it } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryTransitionApprovalService } from './approval-service.js';
import { defaultFactoryRules, requireSupervisorApproval } from './defaults.js';
import { FactoryTransitionService } from './transition-service.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function createPendingApproval(storage: WorkItemsStorage) {
  const item = (
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: '1' },
        title: 'Fix the bug',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    })
  ).item;
  const rules = defaultFactoryRules({
    version: 'rules-v1',
    overrides: {
      work: {
        intake: {
          issue: {
            onExit: context =>
              requireSupervisorApproval(context, {
                reason: 'Supervisor approval required.',
                summary: 'Move Fix the bug to execute',
              }),
          },
        },
        execute: {
          issue: {
            onEnter: () => ({ type: 'notify', idempotencyKey: 'approved-effect', title: 'Execution approved' }),
          },
        },
      },
    },
  });
  const result = await new FactoryTransitionService({ rules, storage }).transition({
    orgId: 'org-1',
    factoryProjectId: PROJECT_ID,
    workItemId: item.id,
    board: 'work',
    stage: 'execute',
    expectedRevision: item.revision,
    actor: { type: 'agent', bindingId: 'binding-1', role: 'work' },
    ingress: { type: 'agent', identity: 'tool:call-1' },
    cause: 'agent_tool',
  });
  if (result.status !== 'pending_approval') throw new Error('Expected pending approval.');
  return { item, approvalId: result.approvalId };
}

describe('FactoryTransitionApprovalService', () => {
  it('atomically approves the captured revision, effects, notifications, and audit once', async () => {
    const seed = await createFactoryStorageForTests();
    const { item, approvalId } = await createPendingApproval(seed.workItems);
    const service = new FactoryTransitionApprovalService({ storage: seed.workItems });
    const now = new Date('2030-01-01T00:00:00.000Z');

    const [first, second] = await Promise.all([
      service.resolve({
        orgId: 'org-1',
        factoryProjectId: PROJECT_ID,
        approvalId,
        decision: 'approve',
        resolvedBy: 'supervisor-1',
        resolverType: 'agent',
        now,
      }),
      service.resolve({
        orgId: 'org-1',
        factoryProjectId: PROJECT_ID,
        approvalId,
        decision: 'approve',
        resolvedBy: 'supervisor-1',
        resolverType: 'agent',
        now,
      }),
    ]);

    expect([first, second].map(result => result.status)).toEqual(['approved', 'approved']);
    expect([first, second].filter(result => result.status !== 'missing' && result.replayed)).toHaveLength(1);
    expect((await seed.workItems.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['execute']);
    expect((await seed.workItems.get({ orgId: 'org-1', id: item.id }))?.revision).toBe(item.revision + 1);
    const deferred = await seed.workItems.listDeferredDecisions('org-1', PROJECT_ID);
    expect(deferred.map(record => record.idempotencyKey)).toEqual([
      'approved-effect',
      `${approvalId}:stage-changed`,
      `${approvalId}:resolution:approved`,
    ]);
    expect(deferred.every(record => record.causalChain.at(-1)?.decisionType === 'requestApproval')).toBe(true);
    expect(deferred.every(record => record.causalChain.at(-1)?.ingressId === approvalId)).toBe(true);
    expect(
      (await seed.audit.list({ orgId: 'org-1', factoryProjectId: PROJECT_ID })).events.map(event => event.action),
    ).toEqual(['factory.approval.approved', 'factory.approval.requested']);
  });

  it('rejects without moving the item and persists one worker notification', async () => {
    const seed = await createFactoryStorageForTests();
    const { item, approvalId } = await createPendingApproval(seed.workItems);
    const service = new FactoryTransitionApprovalService({ storage: seed.workItems });

    const result = await service.resolve({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      approvalId,
      decision: 'reject',
      resolvedBy: 'supervisor-1',
      resolverType: 'agent',
      resolutionReason: 'Needs more evidence.',
    });

    expect(result).toMatchObject({ status: 'rejected', replayed: false });
    expect((await seed.workItems.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
    expect(
      (await seed.workItems.listDeferredDecisions('org-1', PROJECT_ID)).map(record => record.idempotencyKey),
    ).toEqual([`${approvalId}:resolution:rejected`]);
  });

  it('marks an approval stale without moving or dispatching captured effects when the revision changes', async () => {
    const seed = await createFactoryStorageForTests();
    const { item, approvalId } = await createPendingApproval(seed.workItems);
    await seed.workItems.update({ orgId: 'org-1', id: item.id, userId: 'user-2', patch: { title: 'Updated title' } });
    const service = new FactoryTransitionApprovalService({ storage: seed.workItems });

    const result = await service.resolve({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      approvalId,
      decision: 'approve',
      resolvedBy: 'supervisor-1',
      resolverType: 'agent',
    });

    expect(result).toMatchObject({ status: 'stale', replayed: false });
    expect((await seed.workItems.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['intake']);
    expect(
      (await seed.workItems.listDeferredDecisions('org-1', PROJECT_ID)).map(record => record.idempotencyKey),
    ).toEqual([`${approvalId}:resolution:stale`]);
  });

  it('marks an approval stale when the captured item was deleted', async () => {
    const seed = await createFactoryStorageForTests();
    const { item, approvalId } = await createPendingApproval(seed.workItems);
    await seed.workItems.delete({ orgId: 'org-1', id: item.id });

    const result = await new FactoryTransitionApprovalService({ storage: seed.workItems }).resolve({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      approvalId,
      decision: 'approve',
      resolvedBy: 'supervisor-1',
      resolverType: 'agent',
    });

    expect(result).toMatchObject({ status: 'stale', replayed: false, item: null });
  });

  it('does not expose or resolve approvals across tenants or projects', async () => {
    const seed = await createFactoryStorageForTests();
    const { approvalId } = await createPendingApproval(seed.workItems);
    const service = new FactoryTransitionApprovalService({ storage: seed.workItems });

    await expect(
      service.resolve({
        orgId: 'other-org',
        factoryProjectId: PROJECT_ID,
        approvalId,
        decision: 'approve',
        resolvedBy: 'supervisor-1',
        resolverType: 'agent',
      }),
    ).resolves.toEqual({ status: 'missing' });
    await expect(service.get({ orgId: 'org-1', factoryProjectId: 'other-project', approvalId })).resolves.toBeNull();
  });
});
