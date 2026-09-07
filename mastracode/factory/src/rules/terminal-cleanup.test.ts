import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defaultFactoryRules } from './defaults.js';
import { createTerminalStageCleanup } from './terminal-cleanup.js';
import { FactoryTransitionService } from './transition-service.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

async function prepareBinding(
  storage: WorkItemsStorage,
  options: { issue?: number; role?: 'work' | 'review'; session?: string; kickoffKey?: string } = {},
) {
  const issue = options.issue ?? 1;
  const session = options.session ?? 'session-1';
  return storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: `github-issue:${issue}`,
        },
        title: `Issue ${issue}`,
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    },
    role: options.role ?? 'work',
    session: { sessionId: session, branch: `factory/issue-${issue}`, threadId: `thread-${session}` },
    resourceId: 'resource-1',
    kickoffKey: options.kickoffKey ?? `kickoff-${issue}-${session}`,
    kickoffMessage: null,
  });
}

describe('createTerminalStageCleanup', () => {
  it('reconciles then revokes every active binding for the work item and leaves other items alone', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const work = await prepareBinding(storage, { issue: 1, role: 'work', session: 'session-1' });
    const review = await prepareBinding(storage, { issue: 1, role: 'review', session: 'session-2' });
    const other = await prepareBinding(storage, { issue: 2, session: 'session-3' });

    const order: string[] = [];
    const reconcileBinding = vi.fn(async () => {
      order.push('reconcile');
    });
    const revoke = storage.revokeRunBindingsForWorkItem.bind(storage);
    vi.spyOn(storage, 'revokeRunBindingsForWorkItem').mockImplementation(async input => {
      order.push('revoke');
      return revoke(input);
    });
    const cleanup = createTerminalStageCleanup({ workItems: storage, reconcileBinding });

    await cleanup({ orgId: 'org-1', factoryProjectId: PROJECT_ID, workItemId: work.item.id });

    // Both bindings reconcile before the single revocation pass: revoking
    // first would drop the trailing tool results this cleanup exists to ingest.
    expect(order).toEqual(['reconcile', 'reconcile', 'revoke']);
    expect(reconcileBinding).toHaveBeenCalledTimes(2);
    expect(reconcileBinding.mock.calls.map(([b]: any[]) => b.id).sort()).toEqual(
      [work.binding.id, review.binding.id].sort(),
    );
    const bindings = await storage.listRunBindings('org-1', PROJECT_ID, work.item.id);
    expect(bindings.every(b => b.status === 'revoked')).toBe(true);
    await expect(storage.listRunBindings('org-1', PROJECT_ID, other.item.id)).resolves.toEqual([
      expect.objectContaining({ id: other.binding.id, status: 'active' }),
    ]);
  });

  it('does not revoke a re-entered card after terminal cleanup becomes stale', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);
    const releaseSandboxes = vi.fn();
    const cleanup = createTerminalStageCleanup({ workItems: storage, releaseSandboxes });

    await cleanup({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: prepared.item.id,
      revision: prepared.item.revision + 1,
    });

    await expect(storage.listRunBindings('org-1', PROJECT_ID, prepared.item.id)).resolves.toEqual([
      expect.objectContaining({ id: prepared.binding.id, status: 'active' }),
    ]);
    expect(releaseSandboxes).not.toHaveBeenCalled();
  });

  it('skips reconcile for bindings that are already revoked', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);
    await storage.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });

    const reconcileBinding = vi.fn(async () => {});
    const cleanup = createTerminalStageCleanup({ workItems: storage, reconcileBinding });
    await cleanup({ orgId: 'org-1', factoryProjectId: PROJECT_ID, workItemId: prepared.item.id });

    expect(reconcileBinding).not.toHaveBeenCalled();
  });

  it('still revokes when the final reconcile fails', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);

    const cleanup = createTerminalStageCleanup({
      workItems: storage,
      reconcileBinding: vi.fn().mockRejectedValue(new Error('reconcile boom')),
    });
    await cleanup({ orgId: 'org-1', factoryProjectId: PROJECT_ID, workItemId: prepared.item.id });

    await expect(storage.listRunBindings('org-1', PROJECT_ID, prepared.item.id)).resolves.toEqual([
      expect.objectContaining({ id: prepared.binding.id, status: 'revoked' }),
    ]);
  });

  it('supersedes the runs still parked on the item, since a finished item cannot answer them', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({ type: 'invokeSkill', role: 'work', skillName: 'factory-plan', idempotencyKey: 'p-1' }),
            },
          },
        },
      },
    });
    await new FactoryTransitionService({ storage, rules }).transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: prepared.item.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: prepared.item.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-1' },
      cause: 'test',
    });
    const now = new Date('2030-01-01T00:00:00Z');
    const [claimed] = await storage.claimDeferredDecisions({
      ownerId: 'dispatcher',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    await storage.proposeDeferredDecision(
      { id: claimed!.id, orgId: 'org-1', factoryProjectId: PROJECT_ID, ownerId: 'dispatcher' },
      now,
    );

    const cleanup = createTerminalStageCleanup({ workItems: storage });
    await cleanup({ orgId: 'org-1', factoryProjectId: PROJECT_ID, workItemId: prepared.item.id });

    const decisions = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(decisions).toEqual([expect.objectContaining({ id: claimed!.id, status: 'superseded' })]);
  });

  it('supersedes failed skill runs when their item becomes terminal', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBinding(storage);
    const rules = defaultFactoryRules({
      version: 'rules-v1',
      overrides: {
        work: {
          execute: {
            issue: {
              onEnter: () => ({ type: 'invokeSkill', role: 'work', skillName: 'factory-plan', idempotencyKey: 'p-2' }),
            },
          },
        },
      },
    });
    await new FactoryTransitionService({ storage, rules }).transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: prepared.item.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: prepared.item.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'move-2' },
      cause: 'test',
    });
    const now = new Date('2030-01-01T00:00:00Z');
    const [claimed] = await storage.claimDeferredDecisions({
      ownerId: 'dispatcher',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    if (!claimed) throw new Error('Expected a claimed decision');
    await storage.failDeferredDecision({
      id: claimed.id,
      orgId: claimed.orgId,
      factoryProjectId: claimed.factoryProjectId,
      ownerId: 'dispatcher',
      now,
      availableAt: now,
      lastError: 'Repository preparation failed.',
      failureCode: 'repository_clone_failed',
      terminal: true,
    });

    const cleanup = createTerminalStageCleanup({ workItems: storage });
    await cleanup({ orgId: 'org-1', factoryProjectId: PROJECT_ID, workItemId: prepared.item.id });

    expect((await storage.listDeferredDecisions('org-1', PROJECT_ID))[0]?.status).toBe('superseded');
  });

  it('never throws and still releases sandboxes when revocation fails', async () => {
    const releaseSandboxes = vi.fn(async () => {});
    const cleanup = createTerminalStageCleanup({
      workItems: {
        get: vi.fn().mockResolvedValue({ revision: 1 }),
        listRunBindings: vi.fn().mockRejectedValue(new Error('storage down')),
        revokeRunBindingsForWorkItem: vi.fn(),
        supersedeTerminalDecisionsForWorkItem: vi.fn().mockRejectedValue(new Error('storage down')),
      },
      releaseSandboxes,
    });

    await expect(
      cleanup({ orgId: 'org-1', factoryProjectId: PROJECT_ID, workItemId: 'item-1' }),
    ).resolves.toBeUndefined();
    expect(releaseSandboxes).toHaveBeenCalledExactlyOnceWith({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: 'item-1',
    });
  });
});
