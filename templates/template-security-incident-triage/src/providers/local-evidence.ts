import {
  EvidenceProviderInputSchema,
  EvidenceProviderResultSchema,
  type EvidenceFact,
  type EvidenceProviderInput,
  type EvidenceProviderResult,
} from '../evidence/contracts.js';
import { DomainError } from '../domain/errors.js';
import type { LocalProviderBehavior, SafeProviderCall } from './evidence-provider.js';

export type LocalProviderOptions = Readonly<{
  behavior?: LocalProviderBehavior;
  release?: Promise<void>;
  onStart?: () => void;
}>;

export async function executeLocalInspection(input: {
  provider: 'local-identity' | 'local-endpoint' | 'local-cloud';
  providerRef: 'identity' | 'endpoint' | 'cloud';
  request: EvidenceProviderInput;
  signal: AbortSignal;
  attempt: 1 | 2;
  behavior: LocalProviderBehavior;
  release?: Promise<void>;
  onStart?: () => void;
  callLog: SafeProviderCall[];
  facts: (request: EvidenceProviderInput) => readonly EvidenceFact[] | Promise<readonly EvidenceFact[]>;
}): Promise<EvidenceProviderResult> {
  const request = EvidenceProviderInputSchema.safeParse(input.request);
  if (!request.success) throw new DomainError('VALIDATION_FAILED');
  input.callLog.push({
    tenantId: request.data.tenantId,
    incidentId: request.data.incidentId,
    subjectId: request.data.subjectId,
    workflowRunId: request.data.workflowRunId,
    attempt: input.attempt,
  });
  input.onStart?.();
  if (input.signal.aborted) return failure(input, 'ABORTED', false, 'aborted');
  if (input.release) {
    await Promise.race([
      input.release,
      new Promise<void>(resolve => input.signal.addEventListener('abort', () => resolve(), { once: true })),
    ]);
  }
  if (input.signal.aborted) return failure(input, 'ABORTED', false, 'aborted');
  if (input.behavior !== 'success') {
    const mapping = {
      not_found: ['NOT_FOUND', false],
      timeout: ['TIMEOUT', false],
      unavailable: ['UNAVAILABLE', true],
      rate_limited: ['RATE_LIMITED', true],
      invalid_response: ['INVALID_RESPONSE', false],
    } as const;
    const [code, retryable] = mapping[input.behavior];
    return failure(input, code, retryable, input.behavior);
  }
  return EvidenceProviderResultSchema.parse({
    status: 'success',
    provider: input.provider,
    facts: await input.facts(request.data),
  });
}

function failure(
  input: Parameters<typeof executeLocalInspection>[0],
  code: 'NOT_FOUND' | 'TIMEOUT' | 'UNAVAILABLE' | 'RATE_LIMITED' | 'INVALID_RESPONSE' | 'ABORTED',
  retryable: boolean,
  status: 'not_found' | 'timeout' | 'aborted' | 'unavailable' | 'rate_limited' | 'invalid_response',
): EvidenceProviderResult {
  return EvidenceProviderResultSchema.parse({
    status,
    provider: input.provider,
    error: {
      code,
      retryable,
      safeRef: `provider:${input.providerRef}:attempt-${input.attempt}`,
      attempt: input.attempt,
    },
  });
}
