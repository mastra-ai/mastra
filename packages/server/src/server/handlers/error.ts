import { HTTPException } from '../http-exception';
import type { StatusCode } from '../http-exception';
import type { ApiError } from '../types';

// Helper to handle errors consistently
export function handleError(error: unknown, defaultMessage: string): Promise<Response> {
  const apiError = error as ApiError;
  throw new HTTPException((apiError.status || 500) as StatusCode, {
    message: apiError.message || defaultMessage,
  });
}
