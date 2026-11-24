import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { systemClock, type Clock } from '../domain/clock.js';
import type { OperationalStore } from '../db/operational-store.js';
import type { ApprovalRequestedResultSchema } from './contracts.js';
import { decideApprovalAndIssueResumeToken, authorizeResumeToken } from '../db/approval-operations.js';

/** A simulated operator decision, accepted only by a server-configured local
 * Studio workflow. Never use this as authentication for external providers. */
export const StudioLocalDecisionSchema = z
  .object({
    localDemoDecision: z.literal(true),
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();

const localResumeSecret = randomBytes(32).toString('hex');

export async function resolveStudioLocalDecision(
  store: OperationalStore,
  input: Extract<z.infer<typeof ApprovalRequestedResultSchema>, { status: 'approval-requested' }>,
  decision: z.infer<typeof StudioLocalDecisionSchema>,
  clock: Clock = systemClock,
): Promise<string> {
  const { plan, approval } = input;
  const state = await store.execute({
    sql: 'SELECT version FROM incidents WHERE tenant_id=? AND id=? AND current_run_id=?',
    args: [plan.tenantId, plan.incidentId, input.workflowRunId],
  });
  if (!state.rows[0]) throw new Error('STUDIO_LOCAL_SCOPE_MISMATCH');
  const issued = await decideApprovalAndIssueResumeToken(
    store,
    {
      decision: {
        schemaVersion: 1,
        approvalId: approval.approvalId,
        planId: plan.planId,
        incidentId: plan.incidentId,
        tenantId: plan.tenantId,
        planHashVersion: 1,
        planHash: plan.planHash,
        decision: decision.decision,
        reason: decision.reason,
        decidedBy: 'studio-soc-manager',
        decidedByRole: 'soc_manager',
        decidedAt: clock.now(),
      },
      expectedIncidentVersion: Number(state.rows[0].version),
      runId: input.workflowRunId,
      correlationId: input.correlationId,
      resumeSecret: localResumeSecret,
    },
    { clock },
  );
  const receipt = await authorizeResumeToken(
    store,
    {
      token: issued.resumeToken,
      tenantId: plan.tenantId,
      incidentId: plan.incidentId,
      workflowRunId: input.workflowRunId,
      approvalId: approval.approvalId,
    },
    { clock },
  );
  return receipt.resumeReceiptId;
}
