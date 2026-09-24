import { z } from 'zod';

export const taskPolicySchema = z
  .object({
    plan: z.enum(['flex', '2c-4g', '2c-8g', '4c-8g', '4c-16g']).optional(),
    timeoutSeconds: z.number().int().min(30).max(86400).optional(),
    retry: z
      .object({
        maxRetries: z.number().int().min(0),
        waitDurationMs: z.number().int().min(0),
        backoffScaling: z.number().finite().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type TaskPolicy = z.infer<typeof taskPolicySchema>;
export const DEFAULT_RETRY = { maxRetries: 3, waitDurationMs: 1000, backoffScaling: 2 };
export const NO_RETRY = { maxRetries: 0, waitDurationMs: 1000, backoffScaling: 2 };

export function taskPolicy(value?: TaskPolicy, defaults?: TaskPolicy): TaskPolicy {
  return taskPolicySchema.parse({ plan: 'flex', ...defaults, ...value });
}
