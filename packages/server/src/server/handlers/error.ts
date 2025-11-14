import { HTTPException } from '../http-exception';
import type { StatusCode } from '../http-exception';
import type { ApiError } from '../types';

// Helper to handle errors consistently
export function handleError(error: unknown, defaultMessage: string): never {
  const apiError = error as ApiError;

  const apiErrorStatus = apiError.status || apiError.details?.status || 500;

  throw new HTTPException(apiErrorStatus as StatusCode, {
    message: apiError.message || defaultMessage,
    stack: apiError.stack,
    cause: apiError.cause,
  });
}
