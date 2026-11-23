import { z } from 'zod';

import { WorkflowExecutionError } from '../../domain/errors.js';
import { complianceReviewSuspendSchema, missingInformationSuspendSchema } from '../workflows/durable-kyc-onboarding.js';

export const workflowPendingActionSchema = z.union([missingInformationSuspendSchema, complianceReviewSuspendSchema]);

export const parseWorkflowPendingAction = (value: unknown): z.infer<typeof workflowPendingActionSchema> => {
  const visited = new WeakSet<object>();
  const visit = (candidate: unknown, depth: number): z.infer<typeof workflowPendingActionSchema> | null => {
    const direct = workflowPendingActionSchema.safeParse(candidate);
    if (direct.success) return direct.data;
    if (depth >= 12 || typeof candidate !== 'object' || candidate === null) return null;
    if (visited.has(candidate)) return null;
    visited.add(candidate);
    for (const nested of Object.values(candidate)) {
      const parsed = visit(nested, depth + 1);
      if (parsed !== null) return parsed;
    }
    return null;
  };
  const parsed = visit(value, 0);
  if (parsed !== null) return parsed;
  throw new WorkflowExecutionError();
};
