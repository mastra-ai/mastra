import type { ProviderExecutionContext } from '../../contracts/shared/execution-context.js';
import { ProviderTimeoutError, type ProviderOperation } from '../../contracts/shared/provider.js';
import type { Clock } from '../../contracts/technical/primitives.js';

export const providerTimestamp = (
  clock: Clock,
  context: ProviderExecutionContext,
  providerId: string,
  operation: ProviderOperation,
): string => {
  const now = clock.now();
  if (now.getTime() > new Date(context.deadlineAt).getTime()) {
    throw new ProviderTimeoutError({
      providerId,
      operation,
      safeMessage: 'The provider deadline expired before completion',
    });
  }
  return now.toISOString();
};
