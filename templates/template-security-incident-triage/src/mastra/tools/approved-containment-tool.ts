import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ContainmentGateway } from '../../containment/gateway.js';
import { DomainError } from '../../domain/errors.js';
import { ContainmentActionOutcomeSchema, ContainmentPlanSchema } from '../../schemas/containment.js';

type Authority = Omit<Parameters<ContainmentGateway['executeApprovedAction']>[0], 'action'>;
const selectionSchema = z.object({ actionId: z.string().min(1).max(128) }).strict();

/** Only the resumed workflow constructs this tool. Native approval metadata
 * complements, but never replaces, the gateway's persisted domain authority. */
export function createApprovedContainmentTool(gateway: ContainmentGateway, authority: Authority) {
  const trusted = {
    tenantId: authority.tenantId,
    incidentId: authority.incidentId,
    workflowRunId: authority.workflowRunId,
    approvalId: authority.approvalId,
    plan: ContainmentPlanSchema.parse(authority.plan),
  };
  return createTool({
    id: 'approved-containment-action',
    description: 'Execute one exact action from the server-bound, approved incident plan.',
    requireApproval: true,
    inputSchema: selectionSchema,
    outputSchema: ContainmentActionOutcomeSchema,
    execute: async input => {
      const { actionId } = selectionSchema.parse(input);
      const action = trusted.plan.actions.find(item => item.actionId === actionId);
      if (!action) throw new DomainError('VALIDATION_FAILED');
      return gateway.executeApprovedAction({ ...trusted, action });
    },
  });
}
