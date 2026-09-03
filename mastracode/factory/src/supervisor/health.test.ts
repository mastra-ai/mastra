import { describe, expect, it } from 'vitest';

import { NEEDS_APPROVAL_LABEL } from '../integrations/github/acceptance-labels.js';
import type {
  FactoryDeferredDecisionRecord,
  FactoryPendingStartRecord,
  FactoryRunBindingRecord,
  WorkItemRow,
} from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { computeFactoryHealth, DEFAULT_HEALTH_THRESHOLDS, runFactoryHealthCheck } from './health.js';

const NOW = new Date('2026-09-03T12:00:00.000Z');
const HOUR = 60 * 60_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function item(overrides: Partial<WorkItemRow> & { id: string }): WorkItemRow {
  const stage = overrides.stages?.[0] ?? 'execute';
  return {
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    externalSource: null,
    parentWorkItemId: null,
    title: `Card ${overrides.id}`,
    stages: [stage],
    stageHistory: [{ stage, enteredAt: ago(2 * HOUR).toISOString(), by: 'user-1' }],
    sessions: {},
    metadata: { number: 42 },
    triageType: 'bug',
    autonomyArmedAt: null,
    plansPreapprovedAt: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdBy: 'user-1',
    createdAt: ago(3 * HOUR),
    updatedAt: ago(HOUR),
    ...overrides,
  };
}

function decision(
  overrides: Partial<FactoryDeferredDecisionRecord> & { id: string; status: FactoryDeferredDecisionRecord['status'] },
): FactoryDeferredDecisionRecord {
  return {
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    evaluationId: 'eval-1',
    workItemId: 'item-1',
    idempotencyKey: overrides.id,
    effectOrdinal: 0,
    effectHash: 'hash',
    causalChain: [],
    actor: null,
    decision: { type: 'invokeSkill', role: 'plan' },
    attempts: 1,
    deliveryGeneration: 0,
    failureOccurrence: 0,
    availableAt: ago(HOUR),
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: null,
    failureCode: null,
    approvedAt: null,
    approvedBy: null,
    completedAt: null,
    createdAt: ago(HOUR),
    updatedAt: ago(HOUR),
    ...overrides,
  };
}

function binding(overrides: Partial<FactoryRunBindingRecord> & { id: string }): FactoryRunBindingRecord {
  return {
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    workItemId: 'item-1',
    role: 'work',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    sessionId: 'session-1',
    branch: 'factory/1',
    status: 'active',
    createdAt: ago(HOUR),
    revokedAt: null,
    ...overrides,
  };
}

function pendingStart(
  overrides: Partial<FactoryPendingStartRecord> & { id: string; status: FactoryPendingStartRecord['status'] },
): FactoryPendingStartRecord {
  return {
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    bindingId: 'binding-1',
    kickoffKey: overrides.id,
    message: null,
    attempts: 1,
    availableAt: ago(HOUR),
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: null,
    failureCode: null,
    completedAt: null,
    createdAt: ago(HOUR),
    updatedAt: ago(HOUR),
    ...overrides,
  };
}

const empty = { items: [], decisions: [], bindings: [], pendingStarts: [] };

describe('computeFactoryHealth', () => {
  it('reports nothing for a healthy factory', () => {
    const report = computeFactoryHealth(
      {
        items: [item({ id: 'item-1' })],
        decisions: [decision({ id: 'd-ok', status: 'succeeded' })],
        bindings: [binding({ id: 'b-1' })],
        pendingStarts: [pendingStart({ id: 's-1', status: 'sent' })],
      },
      NOW,
    );
    expect(report.findings).toEqual([]);
    expect(Object.values(report.counts).every(count => count === 0)).toBe(true);
    expect(report.checkedAt).toBe(NOW.toISOString());
  });

  it('flags a terminally failed decision with its error and a retry repair', () => {
    const report = computeFactoryHealth(
      {
        ...empty,
        items: [item({ id: 'item-1' })],
        bindings: [binding({ id: 'b-1' })],
        decisions: [
          decision({
            id: 'd-fail',
            status: 'failed',
            attempts: 5,
            failureCode: 'session_unavailable',
            lastError: 'No active Factory binding for role plan.',
          }),
        ],
      },
      NOW,
    );
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: 'decision-failed',
        id: 'decision-failed:d-fail',
        workItemId: 'item-1',
        workItemNumber: 42,
        suggestedRepair: { action: 'retry-decision', decisionId: 'd-fail' },
      }),
    ]);
    expect(report.findings[0]!.evidence).toContain('invokeSkill (plan)');
    expect(report.findings[0]!.evidence).toContain('[session_unavailable]');
    expect(report.findings[0]!.evidence).toContain('No active Factory binding');
  });

  it('flags retry decisions the dispatcher never picked up, but not ones inside their backoff', () => {
    const report = computeFactoryHealth(
      {
        ...empty,
        items: [item({ id: 'item-1' })],
        bindings: [binding({ id: 'b-1' })],
        decisions: [
          decision({ id: 'd-stuck', status: 'retry', availableAt: ago(DEFAULT_HEALTH_THRESHOLDS.stuckDecisionMs + 1) }),
          decision({ id: 'd-fresh', status: 'retry', availableAt: ago(1_000) }),
        ],
      },
      NOW,
    );
    expect(report.findings.map(f => f.id)).toEqual(['decision-stuck:d-stuck']);
    expect(report.findings[0]!.suggestedRepair).toBeNull();
  });

  it('flags a lease that outlived its worker', () => {
    const report = computeFactoryHealth(
      {
        ...empty,
        items: [item({ id: 'item-1' })],
        bindings: [binding({ id: 'b-1' })],
        decisions: [
          decision({
            id: 'd-lease',
            status: 'leased',
            leaseOwner: 'dispatcher-old',
            leaseExpiresAt: ago(DEFAULT_HEALTH_THRESHOLDS.expiredLeaseMs + 1),
          }),
          decision({ id: 'd-live', status: 'leased', leaseOwner: 'dispatcher', leaseExpiresAt: ago(-10_000) }),
        ],
      },
      NOW,
    );
    expect(report.findings.map(f => f.id)).toEqual(['decision-stuck:d-lease']);
    expect(report.findings[0]!.evidence).toContain('dispatcher-old');
  });

  it('flags a stalled or failed pending start against its seat', () => {
    const report = computeFactoryHealth(
      {
        ...empty,
        items: [item({ id: 'item-1' })],
        bindings: [binding({ id: 'binding-1' })],
        pendingStarts: [
          pendingStart({
            id: 's-old',
            status: 'pending',
            createdAt: ago(DEFAULT_HEALTH_THRESHOLDS.stalledStartMs + 1),
          }),
          pendingStart({ id: 's-failed', status: 'failed', createdAt: ago(1_000), lastError: 'sandbox boot failed' }),
          pendingStart({ id: 's-new', status: 'pending', createdAt: ago(1_000) }),
        ],
      },
      NOW,
    );
    expect(report.findings.map(f => f.id).sort()).toEqual(['start-stalled:s-failed', 'start-stalled:s-old']);
    for (const finding of report.findings) {
      expect(finding.suggestedRepair).toEqual({ action: 'revoke-binding', bindingId: 'binding-1' });
      expect(finding.evidence).toContain('work seat');
    }
  });

  it('flags active seats on terminal or missing cards as orphaned', () => {
    const report = computeFactoryHealth(
      {
        ...empty,
        items: [item({ id: 'done-1', stages: ['done'] })],
        bindings: [
          binding({ id: 'b-done', workItemId: 'done-1' }),
          binding({ id: 'b-gone', workItemId: 'missing-1' }),
          binding({ id: 'b-revoked', workItemId: 'missing-1', status: 'revoked', revokedAt: ago(1_000) }),
        ],
      },
      NOW,
    );
    expect(report.findings.map(f => f.id).sort()).toEqual(['seat-orphaned:b-done', 'seat-orphaned:b-gone']);
    expect(report.findings.every(f => f.suggestedRepair?.action === 'revoke-binding')).toBe(true);
  });

  it('flags a working-lane card with no seat and nothing in flight, naming the role to start', () => {
    const report = computeFactoryHealth(
      {
        ...empty,
        items: [
          item({ id: 'stranded', stages: ['planning'] }),
          item({ id: 'in-flight', stages: ['execute'] }),
          item({ id: 'resting', stages: ['intake'] }),
        ],
        decisions: [decision({ id: 'd-pending', status: 'pending', workItemId: 'in-flight', availableAt: ago(1_000) })],
      },
      NOW,
    );
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: 'seat-missing',
        workItemId: 'stranded',
        ageMs: 2 * HOUR,
        suggestedRepair: { action: 'start-run', workItemId: 'stranded', role: 'plan' },
      }),
    ]);
  });

  it('treats a triaged non-bug card as held, and only nags once it has waited long enough', () => {
    const fresh = item({ id: 'fresh', stages: ['triage'], triageType: 'feature request' });
    const stale = item({
      id: 'stale',
      stages: ['triage'],
      triageType: 'feature request',
      stageHistory: [
        { stage: 'triage', enteredAt: ago(2 * DEFAULT_HEALTH_THRESHOLDS.waitingOnPersonMs).toISOString(), by: 'agent' },
      ],
    });
    const report = computeFactoryHealth({ ...empty, items: [fresh, stale] }, NOW);
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: 'held-waiting',
        workItemId: 'stale',
        suggestedRepair: { action: 'accept-work-item', workItemId: 'stale' },
      }),
    ]);
    expect(report.findings[0]!.evidence).toContain('feature request');
  });

  it('flags a proposal a person has left waiting', () => {
    const report = computeFactoryHealth(
      {
        ...empty,
        items: [item({ id: 'item-1' })],
        bindings: [binding({ id: 'b-1' })],
        decisions: [
          decision({
            id: 'd-old',
            status: 'proposed',
            createdAt: ago(DEFAULT_HEALTH_THRESHOLDS.waitingOnPersonMs + 1),
          }),
          decision({ id: 'd-new', status: 'proposed', createdAt: ago(1_000) }),
        ],
      },
      NOW,
    );
    expect(report.findings.map(f => f.id)).toEqual(['proposal-waiting:d-old']);
    expect(report.findings[0]!.suggestedRepair).toEqual({ action: 'resolve-proposal', decisionId: 'd-old' });
  });

  it('flags an accepted card that still wears the needs-approval label', () => {
    const report = computeFactoryHealth(
      {
        ...empty,
        items: [
          item({
            id: 'drift',
            stages: ['execute'],
            triageType: 'feature request',
            acceptedAt: ago(HOUR),
            metadata: { number: 7, labels: ['bug', NEEDS_APPROVAL_LABEL] },
          }),
        ],
        bindings: [binding({ id: 'b-1', workItemId: 'drift' })],
      },
      NOW,
    );
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: 'label-drift',
        workItemNumber: 7,
        suggestedRepair: { action: 'reconcile-labels', workItemId: 'drift' },
      }),
    ]);
  });

  it('orders findings oldest first and counts them by kind', () => {
    const report = computeFactoryHealth(
      {
        ...empty,
        items: [item({ id: 'item-1' })],
        bindings: [binding({ id: 'b-1' })],
        decisions: [
          decision({ id: 'd-recent', status: 'failed', updatedAt: ago(1_000) }),
          decision({ id: 'd-older', status: 'failed', updatedAt: ago(HOUR) }),
        ],
      },
      NOW,
    );
    expect(report.findings.map(f => f.id)).toEqual(['decision-failed:d-older', 'decision-failed:d-recent']);
    expect(report.counts['decision-failed']).toBe(2);
    expect(report.counts['seat-missing']).toBe(0);
  });
});

describe('runFactoryHealthCheck', () => {
  const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

  it('reads the project rows and sees a seat vanish when its binding is revoked', async () => {
    const { workItems } = await createFactoryStorageForTests();
    const prepared = await workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:9' },
          title: 'Issue 9',
          stages: ['intake'],
          sessions: {},
          metadata: { number: 9 },
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'factory/issue-9', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-9',
      kickoffMessage: null,
    });
    const scope = { orgId: 'org-1', factoryProjectId: PROJECT_ID };
    const now = new Date();
    await workItems.update({ orgId: 'org-1', id: prepared.item.id, userId: 'user-1', patch: { stages: ['execute'] } });
    const [claimed] = await workItems.claimPendingStarts({
      ownerId: 'test',
      now,
      leaseExpiresAt: new Date(now.getTime() + 30_000),
      limit: 1,
    });
    await workItems.completePendingStart(
      { id: claimed!.id, orgId: 'org-1', factoryProjectId: PROJECT_ID, ownerId: 'test' },
      now,
    );

    expect((await runFactoryHealthCheck(workItems, scope, { now })).findings).toEqual([]);

    await workItems.revokeRunBinding({ ...scope, bindingId: prepared.binding.id, revokedAt: now });
    const report = await runFactoryHealthCheck(workItems, scope, { now });
    expect(report.findings.map(f => f.kind)).toEqual(['seat-missing']);
    expect(report.findings[0]!.workItemNumber).toBe(9);
  });
});
