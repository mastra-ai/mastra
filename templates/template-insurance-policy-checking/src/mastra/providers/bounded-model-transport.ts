import { z } from 'zod';
import type { OperationContext } from '../domain/contracts.js';
import { IntakeError } from '../domain/errors.js';
import type { ProcessingAttempt, ReconciliationRepository } from '../storage/reconciliation.js';

const reportedUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative().safe(),
  output_tokens: z.number().int().nonnegative().safe(),
  total_tokens: z.number().int().nonnegative().safe(),
});
const responseMetadataSchema = z.object({
  status: z.literal('completed'),
  usage: reportedUsageSchema.nullish(),
});

export function processingEndpoint(endpoint = 'https://api.openai.com/v1') {
  if (
    endpoint !== 'https://api.openai.com/v1' &&
    (process.env.NODE_ENV !== 'test' || !/^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(endpoint))
  )
    throw new IntakeError(
      'MODEL_CONFIGURATION',
      'Processing endpoint overrides are limited to controlled loopback tests.',
      'Use the default OpenAI endpoint outside tests.',
    );
  return endpoint;
}

/** Per-generation transport control. The SDK owns request construction and response parsing. */
export function createBoundedModelTransport(
  repository: ReconciliationRepository,
  context: OperationContext,
  attempt: ProcessingAttempt,
  stage: string,
  endpoint: string,
  signal: AbortSignal,
) {
  const binding = structuredClone({ context, attempt });
  const budget = binding.attempt.input.budget;
  let failure: IntakeError | undefined;
  const reservations: { id: string; inputTokens: number }[] = [];
  const boundedFetch: typeof fetch = async (url, init) => {
    try {
      if (String(url) !== `${endpoint}/responses` || init?.method !== 'POST' || typeof init.body !== 'string')
        throw new Error('Unexpected native request');
      // Validate only dispatch controls against the actual SDK payload; never construct its prompt/schema.
      z.object({
        model: z.literal(binding.attempt.input.model),
        store: z.literal(false),
        max_output_tokens: z.literal(budget.maxOutputTokensPerRequest),
        stream: z.literal(false).optional(),
      }).parse(JSON.parse(init.body));
      const inputTokens = Buffer.byteLength(init.body, 'utf8') + 512;
      const id = await repository.reserve(
        binding.context,
        binding.attempt.id,
        inputTokens,
        budget.maxOutputTokensPerRequest,
        stage,
      );
      reservations.push({ id, inputTokens });
      signal.throwIfAborted();
      const response = await fetch(url, {
        ...init,
        signal: init.signal ? AbortSignal.any([signal, init.signal]) : signal,
        redirect: 'error',
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new IntakeError(
          'MODEL_UNAVAILABLE',
          'The processing provider rejected or could not complete the request.',
          'Check model access and saved attempt status before an explicit bounded retry.',
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > budget.maxResponseBytes) {
          await reader.cancel();
          throw new IntakeError(
            'MODEL_OUTPUT_LIMIT',
            'The provider response exceeded the configured byte limit.',
            'Inspect the failed attempt before changing the approved output budget.',
          );
        }
        chunks.push(next.value);
      }
      return new Response(Buffer.concat(chunks), { status: response.status, headers: response.headers });
    } catch (error) {
      failure =
        error instanceof IntakeError
          ? error
          : new IntakeError(
              'MODEL_INVALID_OUTPUT',
              'The bounded provider request was interrupted or invalid.',
              'Read the failed attempt; explicitly retry its unchanged inputs if budget remains.',
            );
      throw failure;
    }
  };
  return {
    fetch: boundedFetch,
    failure: () => failure,
    async verifyMetadata(body: unknown) {
      // The SDK normalizes totals, so retain the provider's reported counters from native response metadata.
      const metadata = responseMetadataSchema.safeParse(body);
      if (!metadata.success || reservations.length !== 1)
        throw new IntakeError(
          'MODEL_INCOMPLETE',
          'The model returned incomplete processing metadata.',
          'Inspect the failed attempt before an explicit bounded retry.',
        );
      const reservation = reservations[0]!;
      const usage = metadata.data.usage ?? null;
      await repository.usage(reservation.id, usage);
      if (
        usage &&
        (usage.input_tokens > reservation.inputTokens ||
          usage.output_tokens > budget.maxOutputTokensPerRequest ||
          usage.total_tokens !== usage.input_tokens + usage.output_tokens)
      )
        throw new IntakeError(
          'MODEL_USAGE_LIMIT',
          'The provider reported usage outside its reserved token allocation.',
          'Stop processing and review provider usage and approved budgets.',
        );
    },
  };
}
