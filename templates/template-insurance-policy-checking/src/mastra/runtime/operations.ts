import { ConsoleLogger } from '@mastra/core/logger';
import { z } from 'zod';

export const privateFrameworkLogger = new ConsoleLogger({ name: 'insurance-framework', filter: () => false });
const logger = new ConsoleLogger({ name: 'insurance-policy', level: 'info' });
const metadataSchema = z
  .object({
    stage: z.enum(['processing', 'draft', 'review', 'finalization', 'startup', 'provider']),
    outcome: z.enum(['started', 'completed', 'failed', 'recovered', 'revised', 'approved', 'rejected', 'recorded']),
    caseId: z.uuid().optional(),
    runId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,200}$/)
      .optional(),
    attemptId: z.uuid().optional(),
    reportId: z.uuid().optional(),
    durationMs: z.number().nonnegative().optional(),
    turnaroundMs: z.number().nonnegative().optional(),
    checked: z.number().int().nonnegative().optional(),
    classifications: z
      .object({
        match: z.number().int().nonnegative(),
        discrepancy: z.number().int().nonnegative(),
        authorized: z.number().int().nonnegative(),
        unresolved: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    version: z.number().int().positive().optional(),
    revision: z.number().int().positive().optional(),
    overrides: z.number().int().nonnegative().optional(),
    errorCode: z
      .string()
      .regex(/^[A-Z_]{1,80}$/)
      .optional(),
    recovery: z.enum(['read_status', 'read_report', 'retry_publication']).optional(),
    estimatedCostMicros: z.number().int().nonnegative().nullable().optional(),
    inputTokens: z.number().int().nonnegative().nullable().optional(),
    outputTokens: z.number().int().nonnegative().nullable().optional(),
    costMicros: z.number().int().nonnegative().nullable(),
  })
  .strict();

/** General operations never accept source text, identity, review prose or provider errors. */
export function operation(metadata: z.input<typeof metadataSchema>) {
  logger.info('insurance.operation', metadataSchema.parse(metadata));
}
