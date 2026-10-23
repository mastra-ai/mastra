import type { Alert } from '../../src/schemas/alert.js';
import type { ApprovalRequest } from '../../src/schemas/approval.js';
import type { ContainmentPlan } from '../../src/schemas/containment.js';
import { calculatePlanHash } from '../../src/containment/plan-canonicalization.js';
import { persistAuthoritativeTriageResult } from '../../src/db/triage-result-operations.js';
import type { OperationalStore } from '../../src/db/operational-store.js';

export const firstTimestamp = '2026-08-27T12:00:00.000Z';
export const secondTimestamp = '2026-08-27T12:01:00.000Z';
export const expiryTimestamp = '2026-08-27T12:16:00.000Z';
const unsignedDefaultPlan = {
  schemaVersion: 1 as const,
  planId: 'plan-1',
  incidentId: 'incident-1',
  tenantId: 'tenant-1',
  planVersion: 1,
  planHashVersion: 1,
  createdAt: secondTimestamp,
  expiresAt: expiryTimestamp,
  actions: [
    {
      actionId: 'action-1',
      type: 'restore_previous_role' as const,
      targetId: 'subject-1',
      input: { role: 'member' },
      impact: 'Restores the previous authorized role.',
      preconditions: ['Current role is admin.'],
      rollback: 'Restore the admin role after review.',
      verification: 'Confirm the subject role is member.',
    },
  ],
};
export const planHash = calculatePlanHash(unsignedDefaultPlan);

export function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    schemaVersion: 1,
    alertId: 'alert-1',
    source: 'workos',
    sourceEventId: 'source-event-1',
    kind: 'unauthorized_privilege_change',
    occurredAt: firstTimestamp,
    tenantId: 'tenant-1',
    subjectId: 'subject-1',
    actor: { id: 'actor-1', type: 'user' },
    target: { id: 'subject-1', type: 'user' },
    changes: { previousRole: 'member', nextRole: 'admin' },
    rawPayloadRef: 'protected://alerts/1',
    idempotencyKey: 'alert-idempotency-1',
    ...overrides,
  };
}

export function makePlan(overrides: Partial<ContainmentPlan> = {}): ContainmentPlan {
  const unsigned = { ...unsignedDefaultPlan, ...overrides };
  const hash = overrides.planHash ?? calculatePlanHash(unsigned as unknown as Record<string, unknown>);
  return { ...unsigned, planHash: hash };
}

export function makeApprovalRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    schemaVersion: 1,
    approvalId: 'approval-1',
    planId: 'plan-1',
    incidentId: 'incident-1',
    tenantId: 'tenant-1',
    planHashVersion: 1,
    planHash,
    requestedAt: secondTimestamp,
    expiresAt: expiryTimestamp,
    status: 'pending',
    ...overrides,
  };
}

export async function seedAuthoritativeTriageResult(
  store: OperationalStore,
  plan: ContainmentPlan = makePlan(),
  workflowRunId = 'run-1',
): Promise<void> {
  await persistAuthoritativeTriageResult(store, {
    tenantId: plan.tenantId,
    incidentId: plan.incidentId,
    workflowRunId,
    result: {
      status: 'ready-for-approval',
      decision: {
        schemaVersion: 1,
        decisionId: 'decision-1',
        incidentId: plan.incidentId,
        tenantId: plan.tenantId,
        workflowRunId,
        severity: 'high',
        effectiveConfidence: 1,
        rationale: 'Integrity-verified fixture rationale.',
        references: ['[evidence:evidence-1]', '[runbook:RB-IDENTITY-001@1.0.0]'],
        runbookReference: '[runbook:RB-IDENTITY-001@1.0.0]',
        policyVersion: 1,
        reasonCodes: [],
      },
      summary: {
        schemaVersion: 1,
        incidentId: plan.incidentId,
        summary: 'Integrity-verified incident summary.',
        facts: [
          {
            text: 'The persisted evidence supports this plan.',
            references: ['[evidence:evidence-1]'],
          },
        ],
        hypotheses: [],
      },
      plan: { ...plan, planHashVersion: 1 as const },
    },
  });
}
