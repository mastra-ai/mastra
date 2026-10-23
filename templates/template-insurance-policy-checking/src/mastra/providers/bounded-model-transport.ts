import type { OperationContext } from '../domain/contracts.js';
import { IntakeError } from '../domain/errors.js';
import type { ProcessingAttempt, ReconciliationRepository } from '../storage/reconciliation.js';

export interface ProcessingReservation {
  id: string;
  inputTokens: number;
}

/** Per-generation transport control. The SDK owns request construction and response parsing. */
export function createBoundedModelTransport(
  repository: ReconciliationRepository,
  context: OperationContext,
  attempt: ProcessingAttempt,
  stage: string,
  endpoint: string,
) {
  const binding = structuredClone({ context, attempt });
  const budget = binding.attempt.input.budget;
  let failure: IntakeError | undefined;
  let reservation: ProcessingReservation | undefined;
  const boundedFetch: typeof fetch = async (url, init) => {
    try {
      if (reservation) throw new Error('Unexpected additional native request');
      if (String(url) !== `${endpoint}/responses` || init?.method !== 'POST' || typeof init.body !== 'string')
        throw new Error('Unexpected native request');
      const inputTokens = Buffer.byteLength(init.body, 'utf8') + 512;
      const id = await repository.reserve(
        binding.context,
        binding.attempt.id,
        inputTokens,
        budget.maxOutputTokensPerRequest,
        stage,
      );
      reservation = { id, inputTokens };
      init.signal?.throwIfAborted();
      const response = await fetch(url, {
        ...init,
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
    reservation: () => reservation,
  };
}
