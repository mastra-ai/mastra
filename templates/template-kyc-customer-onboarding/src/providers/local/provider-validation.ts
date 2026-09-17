import type { z } from 'zod';

import {
  providerExecutionContextSchema,
  type ProviderExecutionContext,
} from '../../contracts/shared/execution-context.js';
import {
  ProviderError,
  ProviderRejectedInputError,
  ProviderResultInvalidError,
  ProviderUnavailableError,
  type ProviderOperation,
} from '../../contracts/shared/provider.js';

type BoundaryIdentity = Readonly<{
  providerId: string;
  operation: ProviderOperation;
}>;

export const parseProviderBoundary = <InputSchema extends z.ZodType>(
  schema: InputSchema,
  input: unknown,
  context: unknown,
  identity: BoundaryIdentity,
): Readonly<{ input: z.output<InputSchema>; context: ProviderExecutionContext }> => {
  const parsedInput = schema.safeParse(input);
  if (!parsedInput.success) {
    throw new ProviderRejectedInputError({
      ...identity,
      safeMessage: 'The provider input is invalid',
    });
  }
  const parsedContext = providerExecutionContextSchema.safeParse(context);
  if (!parsedContext.success) {
    throw new ProviderRejectedInputError({
      ...identity,
      safeMessage: 'The provider execution context is invalid',
    });
  }
  return { input: parsedInput.data, context: parsedContext.data };
};

export const parseProviderResult = <ResultSchema extends z.ZodType>(
  schema: ResultSchema,
  result: unknown,
  identity: BoundaryIdentity,
): z.output<ResultSchema> => {
  const parsed = schema.safeParse(result);
  if (!parsed.success) {
    throw new ProviderResultInvalidError({
      ...identity,
      safeMessage: 'The provider result is invalid',
    });
  }
  return parsed.data;
};

export const executeProviderOperation = async <Result>(
  identity: BoundaryIdentity,
  operation: () => Result | Promise<Result>,
): Promise<Result> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderUnavailableError({
      ...identity,
      safeMessage: 'The provider could not complete the operation',
    });
  }
};
