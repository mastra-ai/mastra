import { z } from 'zod';

import { DomainError } from '../domain/errors.js';
import { publicErrorSchema } from './public-schemas.js';

export class HttpBoundaryError extends DomainError {
  constructor(
    code: string,
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(code, message);
  }
}

export const safeErrorResponse = (error: unknown, correlationId: string) => {
  if (error instanceof HttpBoundaryError) {
    return {
      status: error.status,
      body: publicErrorSchema.parse({
        code: error.code,
        message: error.message,
        correlationId,
        ...(error.details === undefined ? {} : { details: error.details }),
      }),
    } as const;
  }
  if (error instanceof DomainError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code.includes('CONFLICT') ? 409 : 400;
    return {
      status,
      body: publicErrorSchema.parse({ code: error.code, message: error.message, correlationId }),
    } as const;
  }
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: publicErrorSchema.parse({
        code: 'INVALID_REQUEST',
        message: 'The request is invalid',
        correlationId,
      }),
    } as const;
  }
  return {
    status: 500,
    body: publicErrorSchema.parse({
      code: 'INTERNAL_ERROR',
      message: 'The request could not be completed',
      correlationId,
    }),
  } as const;
};
