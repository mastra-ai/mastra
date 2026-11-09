/**
 * Retrying, approving and dismissing Factory decisions, shared by the board's
 * routes and the Factory tools so both refuse and audit the same way.
 */

import type { BoardRegistry } from '../boards/index.js';
import { factoryDecisionType } from '../routes/attention.js';
import { decisionRetryable, overtakenDecisionIds } from '../rules/decision-applicability.js';
import type { FactoryDeferredDecisionRecord, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactoryAuditEmit } from './create-work-item.js';

export type FactoryDecisionActionResult =
  | { ok: true; decision: FactoryDeferredDecisionRecord }
  | { ok: false; code: 'decision_not_retryable' | 'decision_not_proposed'; message: string };

interface DecisionActionArgs {
  workItems: WorkItemsStorage;
  orgId: string;
  factoryProjectId: string;
  decisionId: string;
}

const notRetryable = (message: string): FactoryDecisionActionResult => ({
  ok: false,
  code: 'decision_not_retryable',
  message,
});

/** Re-queue a failed run, unless its failure can't be fixed by retrying or the card has left the run's phase. */
export async function retryFactoryDecision({
  workItems,
  boards,
  orgId,
  factoryProjectId,
  decisionId,
}: DecisionActionArgs & { boards: BoardRegistry }): Promise<FactoryDecisionActionResult> {
  await workItems.ensureReady();
  const current = await workItems.getDeferredDecision(orgId, factoryProjectId, decisionId);
  if (!current || !decisionRetryable(current, false)) {
    return notRetryable('The decision is not a retryable failure, no longer exists, or belongs to another Factory.');
  }
  // A run decided for a phase the card has left would seat the old role on it.
  if ((await overtakenDecisionIds(workItems, boards, { orgId, factoryProjectId }, [current])).size > 0) {
    return notRetryable('The work item has moved on from the phase this run was decided for; it cannot be retried.');
  }
  const decision = await workItems.retryDeferredDecision(orgId, factoryProjectId, decisionId, new Date());
  if (!decision) {
    return notRetryable('The decision is not a retryable failure, no longer exists, or belongs to another Factory.');
  }
  return { ok: true, decision };
}

/**
 * Release (approve) or drop (dismiss) a parked proposal as `userId`, audited as
 * consent. Approval arms the item's autonomy inside the same storage
 * transaction (see approveDeferredDecision), so follow-up runs no longer wait.
 */
export async function resolveFactoryProposal({
  workItems,
  audit,
  orgId,
  factoryProjectId,
  userId,
  decisionId,
  action,
}: DecisionActionArgs & {
  audit: FactoryAuditEmit;
  userId: string;
  action: 'approve' | 'dismiss';
}): Promise<FactoryDecisionActionResult> {
  await workItems.ensureReady();
  const now = new Date();
  const decision =
    action === 'approve'
      ? await workItems.approveDeferredDecision(orgId, factoryProjectId, decisionId, now, userId)
      : await workItems.dismissDeferredDecision(orgId, factoryProjectId, decisionId, now);
  if (!decision) {
    return {
      ok: false,
      code: 'decision_not_proposed',
      message: 'The decision is not an open proposal, no longer exists, or belongs to another Factory.',
    };
  }
  await audit({
    action: action === 'approve' ? 'factory.run.approved' : 'factory.run.dismissed',
    factoryProjectId,
    targets: decision.workItemId
      ? [{ type: 'work_item', id: decision.workItemId }]
      : [{ type: 'rule_decision', id: decision.id }],
    metadata: { decisionId: decision.id, effect: factoryDecisionType(decision) },
  });
  return { ok: true, decision };
}

/** Drop a parked proposal; the same as dismissing it through {@link resolveFactoryProposal}. */
export function dismissFactoryDecision(
  args: DecisionActionArgs & { audit: FactoryAuditEmit; userId: string },
): Promise<FactoryDecisionActionResult> {
  return resolveFactoryProposal({ ...args, action: 'dismiss' });
}
