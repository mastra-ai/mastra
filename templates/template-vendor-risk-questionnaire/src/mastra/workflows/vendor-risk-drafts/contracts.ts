import { z } from 'zod';

import { questionResultSchema } from '../../contracts/answer.ts';
import { defaultExecutionPolicy, executionPolicySchema } from '../../contracts/execution-policy.ts';

export const draftInputSchema = z
  .object({
    runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/),
    evidenceRoot: z.string().min(1).max(2000),
    manifestPath: z.string().min(1).max(2000),
    policy: executionPolicySchema.default(defaultExecutionPolicy),
  })
  .strict();

export const draftQuestionInputSchema = z.object({ runId: z.string(), questionId: z.string() }).strict();

export const draftOutputSchema = z
  .object({
    runId: z.string(),
    state: z.enum(['awaiting_review', 'failed']),
    results: z.array(questionResultSchema).max(100),
  })
  .strict();
