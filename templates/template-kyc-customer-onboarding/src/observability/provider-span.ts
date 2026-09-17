import { SpanType, type TracingContext } from '@mastra/core/observability';

import { ProviderError } from '../contracts/shared/provider.js';

type ProviderSpanInput = Readonly<{
  providerId: string;
  operation: string;
  tenantRef: string;
  caseRef: string | null;
  attempt: number;
}>;

const safeErrorClass = (error: unknown): string =>
  error instanceof ProviderError
    ? error.details.code
    : error instanceof Error
      ? error.constructor.name
      : 'UnknownError';

export const withKycProviderSpan = async <Result>(
  tracingContext: TracingContext | undefined,
  input: ProviderSpanInput,
  operation: () => Promise<Result>,
): Promise<Result> => {
  const span = tracingContext?.currentSpan?.createChildSpan({
    name: `kyc.provider.${input.operation.toLowerCase().replaceAll('_', '.')}`,
    type: SpanType.GENERIC,
    metadata: {
      provider: input.providerId,
      operation: input.operation,
      tenantRef: input.tenantRef,
      caseRef: input.caseRef,
      attempt: input.attempt,
    },
  });
  try {
    const result = await operation();
    span?.end({ output: { outcome: 'success' } });
    return result;
  } catch (error) {
    span?.error({ error: new Error(safeErrorClass(error)), endSpan: true });
    throw error;
  }
};
