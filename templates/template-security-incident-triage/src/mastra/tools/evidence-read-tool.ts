import { createTool } from '@mastra/core/tools';

import {
  EvidenceProviderIdSchema,
  EvidenceProviderInputSchema,
  EvidenceProviderResultSchema,
  EvidenceToolOutputSchema,
  type EvidenceProviderInput,
  type EvidenceProviderResult,
  type EvidenceSourceV1,
} from '../../evidence/contracts.js';
import { DomainError } from '../../domain/errors.js';
import type { ReadOnlyEvidenceProvider } from '../../providers/evidence-provider.js';

export const EvidenceRequestContextSchema = EvidenceProviderInputSchema;

const trustedContextKeys = [
  'tenantId',
  'incidentId',
  'subjectId',
  'workflowRunId',
  'incidentKind',
  'occurredAt',
  'sessionId',
  'deviceId',
  'ip',
] as const satisfies readonly (keyof EvidenceProviderInput)[];

export async function runProviderInspection(input: {
  source: EvidenceSourceV1;
  provider: ReadOnlyEvidenceProvider;
  request: EvidenceProviderInput;
  toolCallId: string;
  timeoutMs: number;
  parentSignal?: AbortSignal;
}) {
  if (input.provider.source !== input.source) throw new DomainError('CONFLICT');
  const providerId = EvidenceProviderIdSchema.parse(input.provider.providerId);
  const request = EvidenceProviderInputSchema.parse(input.request);
  const controller = new AbortController();
  let currentAttempt: 1 | 2 = 1;
  let resolveAbort!: (result: EvidenceProviderResult) => void;
  let abortSettled = false;
  const abortOutcome = new Promise<EvidenceProviderResult>(resolve => {
    resolveAbort = resolve;
  });
  const settleAbort = (code: 'ABORTED' | 'TIMEOUT') => {
    if (abortSettled) return;
    abortSettled = true;
    controller.abort();
    resolveAbort(providerFailure(providerId, code === 'ABORTED' ? 'aborted' : 'timeout', code, false, currentAttempt));
  };
  const abort = () => settleAbort('ABORTED');
  input.parentSignal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => settleAbort('TIMEOUT'), input.timeoutMs);
  if (input.parentSignal?.aborted) abort();

  const inspect = async (attempt: 1 | 2): Promise<EvidenceProviderResult> => {
    currentAttempt = attempt;
    try {
      const untrusted = await input.provider.inspect(request, {
        signal: controller.signal,
        attempt,
      });
      const parsed = EvidenceProviderResultSchema.safeParse(untrusted);
      if (!parsed.success || parsed.data.provider !== providerId) {
        return providerFailure(providerId, 'invalid_response', 'INVALID_RESPONSE', false, attempt);
      }
      if (parsed.data.status === 'success') return parsed.data;
      return EvidenceProviderResultSchema.parse({
        ...parsed.data,
        error: {
          ...parsed.data.error,
          attempt,
          safeRef: `provider:${providerId}:attempt-${attempt}`,
        },
      });
    } catch (error) {
      if (isTimeoutException(error)) return providerFailure(providerId, 'timeout', 'TIMEOUT', false, attempt);
      if (controller.signal.aborted) return providerFailure(providerId, 'aborted', 'ABORTED', false, attempt);
      return providerFailure(providerId, 'operational_error', 'UNAVAILABLE', false, attempt);
    }
  };

  try {
    let result = await Promise.race([inspect(1), abortOutcome]);
    if (isLocallyRetryable(result) && !controller.signal.aborted) {
      result = await Promise.race([inspect(2), abortOutcome]);
    }
    return EvidenceToolOutputSchema.parse({
      toolCallId: input.toolCallId,
      result,
    });
  } finally {
    clearTimeout(timer);
    input.parentSignal?.removeEventListener('abort', abort);
  }
}

function isLocallyRetryable(result: EvidenceProviderResult): boolean {
  return result.status === 'unavailable' || result.status === 'rate_limited';
}

function isTimeoutException(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = 'code' in error ? Reflect.get(error, 'code') : undefined;
  return error.name === 'TimeoutError' || code === 'TIMEOUT';
}

export async function executeEvidenceRead(input: {
  source: EvidenceSourceV1;
  provider: ReadOnlyEvidenceProvider;
  trustedContext: EvidenceProviderInput;
  request: EvidenceProviderInput;
  toolCallId: string;
  timeoutMs: number;
  parentSignal?: AbortSignal;
}) {
  const trusted = EvidenceProviderInputSchema.parse(input.trustedContext);
  const request = EvidenceProviderInputSchema.parse(input.request);
  for (const key of trustedContextKeys) {
    if (trusted[key] !== request[key]) throw new DomainError('CONFLICT');
  }
  return runProviderInspection({
    source: input.source,
    provider: input.provider,
    request,
    toolCallId: input.toolCallId,
    timeoutMs: input.timeoutMs,
    ...(input.parentSignal ? { parentSignal: input.parentSignal } : {}),
  });
}

export function createEvidenceReadTool(input: {
  id: 'identity-read-tool' | 'endpoint-read-tool' | 'cloud-read-tool';
  source: EvidenceSourceV1;
  description: string;
  provider: ReadOnlyEvidenceProvider;
  timeoutMs: number;
}) {
  if (input.id !== `${input.source}-read-tool`) throw new DomainError('CONFLICT');
  return createTool({
    id: input.id,
    description: input.description,
    inputSchema: EvidenceProviderInputSchema,
    outputSchema: EvidenceToolOutputSchema,
    requestContextSchema: EvidenceRequestContextSchema,
    strict: true,
    execute: async (request, context) => {
      const trustedContext = EvidenceProviderInputSchema.parse(
        Object.fromEntries(trustedContextKeys.map(key => [key, context.requestContext.get(key)])),
      );
      const toolCallId = context.agent?.toolCallId ?? `${input.id}-server-call`;
      return context.observe.span(
        `${input.id}.execute`,
        () =>
          executeEvidenceRead({
            source: input.source,
            provider: input.provider,
            trustedContext,
            request,
            toolCallId,
            timeoutMs: input.timeoutMs,
            ...(context.abortSignal ? { parentSignal: context.abortSignal } : {}),
          }),
        {
          toolType: 'function',
          toolCallId,
          source: input.source,
        },
      );
    },
  });
}

export type EvidenceReadTool = ReturnType<typeof createEvidenceReadTool>;

function providerFailure(
  provider: string,
  status:
    | 'not_found'
    | 'timeout'
    | 'aborted'
    | 'unavailable'
    | 'rate_limited'
    | 'operational_error'
    | 'invalid_response',
  code: 'NOT_FOUND' | 'TIMEOUT' | 'UNAVAILABLE' | 'RATE_LIMITED' | 'INVALID_RESPONSE' | 'ABORTED',
  retryable: boolean,
  attempt: 1 | 2,
): EvidenceProviderResult {
  return EvidenceProviderResultSchema.parse({
    status,
    provider,
    error: {
      code,
      retryable,
      safeRef: `provider:${provider}:attempt-${attempt}`,
      attempt,
    },
  });
}
