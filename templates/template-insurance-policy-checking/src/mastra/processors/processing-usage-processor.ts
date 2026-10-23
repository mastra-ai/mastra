import { operation } from '../runtime/operations.js';
import type { InputProcessor } from '@mastra/core/processors';
import { z } from 'zod';
import { IntakeError } from '../domain/errors.js';
import type { ProcessingBudget } from '../domain/reconciliation-contracts.js';
import type { ProcessingReservation } from '../providers/bounded-model-transport.js';
import type { ReconciliationRepository } from '../storage/reconciliation.js';

const reportedUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative().safe(),
  output_tokens: z.number().int().nonnegative().safe(),
  total_tokens: z.number().int().nonnegative().safe(),
});
const consistentUsageSchema = reportedUsageSchema.refine(
  usage => usage.total_tokens === usage.input_tokens + usage.output_tokens,
);
const responseMetadataSchema = z.object({
  status: z.literal('completed'),
});

/** Validate raw counters: the SDK's normalized usage recomputes provider totals. */
export function createProcessingUsageProcessor(
  repository: ReconciliationRepository,
  budget: ProcessingBudget,
  reservation: () => ProcessingReservation | undefined,
  correlation?: { caseId: string; attemptId: string; runId: string; sourceId?: string },
): InputProcessor {
  return {
    id: 'processing-usage',
    async processLLMResponse({ rawResponse, abortSignal }) {
      const body =
        rawResponse && typeof rawResponse === 'object' && 'body' in rawResponse ? rawResponse.body : undefined;
      const metadata = responseMetadataSchema.safeParse(body);
      const counters = reportedUsageSchema
        .nullish()
        .safeParse(body && typeof body === 'object' && 'usage' in body ? body.usage : undefined);
      const reserved = reservation();
      if (!reserved)
        throw new IntakeError(
          'MODEL_INCOMPLETE',
          'The model returned incomplete processing metadata.',
          'Inspect the failed attempt before an explicit bounded retry.',
        );
      // Completed output and reported usage are separate facts. Even rejected output
      // may have consumed tokens; keep valid raw counters without releasing its ceiling.
      const usage = counters.success ? (counters.data ?? null) : null;
      await repository.usage(reserved.id, usage);
      operation({
        ...correlation,
        stage: 'provider',
        reservationId: reserved.id,
        outcome: metadata.success && counters.success ? 'completed' : 'failed',
        ...(!metadata.success || !counters.success ? { errorCode: 'MODEL_INCOMPLETE' } : {}),
        inputTokens: usage?.input_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
        costMicros: null,
        estimatedCostMicros: usage
          ? usage.input_tokens * budget.inputMicrosPerToken + usage.output_tokens * budget.outputMicrosPerToken
          : null,
      });
      if (!metadata.success || !counters.success)
        throw new IntakeError(
          'MODEL_INCOMPLETE',
          'The model returned incomplete processing metadata.',
          'Inspect the failed attempt before an explicit bounded retry.',
        );
      abortSignal?.throwIfAborted();
      if (
        usage &&
        (usage.input_tokens > reserved.inputTokens ||
          usage.output_tokens > budget.maxOutputTokensPerRequest ||
          !consistentUsageSchema.safeParse(usage).success)
      )
        throw new IntakeError(
          'MODEL_USAGE_LIMIT',
          'The provider reported usage outside its reserved token allocation.',
          'Stop processing and review provider usage and approved budgets.',
        );
    },
  };
}
