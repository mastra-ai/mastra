import { z } from 'zod';

import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';

export const factoryPlanContentSchema = z
  .object({
    title: z.string().trim().min(1).max(512),
    content: z.string().trim().min(1).max(65_536),
    path: z.string().trim().min(1).max(2_048).optional(),
  })
  .strict();

/** Server-created evidence carried with the durable transition, never accepted from a browser. */
export const factoryPlanApprovalSchema = z
  .object({
    bindingId: z.string().min(1),
    threadId: z.string().min(1),
    revision: z.number().int().positive(),
    submissionKey: z.string().min(1).max(512),
    approved: z.boolean(),
    submission: factoryPlanContentSchema.optional(),
  })
  .strict();

export type FactoryPlanApproval = z.infer<typeof factoryPlanApprovalSchema>;
export type FactoryPlanContent = z.infer<typeof factoryPlanContentSchema>;

export function isApprovedSubmitPlan(value: unknown): boolean {
  if (typeof value === 'string') return value.startsWith('Plan approved.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (
    'submittedPlan' in value &&
    value.submittedPlan &&
    typeof value.submittedPlan === 'object' &&
    'action' in value.submittedPlan
  ) {
    return value.submittedPlan.action === 'approved';
  }
  return 'content' in value && typeof value.content === 'string' && value.content.startsWith('Plan approved.');
}

export async function isCurrentFactoryPlan(
  storage: WorkItemsStorage,
  item: WorkItemRow,
  plan: FactoryPlanApproval,
): Promise<boolean> {
  if (item.board !== 'work' && item.board != null) return false;
  if (item.stages.length !== 1 || item.stages[0] !== 'planning' || item.planSubmissionKey !== plan.submissionKey)
    return false;
  const bindings = await storage.listRunBindings(item.orgId, item.factoryProjectId, item.id);
  return bindings.some(
    binding =>
      binding.id === plan.bindingId &&
      binding.status === 'active' &&
      binding.threadId === plan.threadId &&
      binding.role === 'plan',
  );
}
