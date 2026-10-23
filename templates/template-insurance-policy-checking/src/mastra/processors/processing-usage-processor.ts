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
  usage: reportedUsageSchema.nullish(),
});

/** Validate raw counters: the SDK's normalized usage recomputes provider totals. */
export function createProcessingUsageProcessor(
  repository: ReconciliationRepository,
  budget: ProcessingBudget,
  reservation: () => ProcessingReservation | undefined,
): InputProcessor {
  return {
    id: 'processing-usage',
    async processLLMResponse({ rawResponse, abortSignal }) {
      const metadata = responseMetadataSchema.safeParse(
        rawResponse && typeof rawResponse === 'object' && 'body' in rawResponse ? rawResponse.body : undefined,
      );
      const reserved = reservation();
      if (!metadata.success || !reserved)
        throw new IntakeError(
          'MODEL_INCOMPLETE',
          'The model returned incomplete processing metadata.',
          'Inspect the failed attempt before an explicit bounded retry.',
        );
      const usage = metadata.data.usage ?? null;
      await repository.usage(reserved.id, usage);
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
