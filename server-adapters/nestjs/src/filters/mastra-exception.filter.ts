import { formatZodError } from '@mastra/server/handlers/error';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { ValidationError } from '../services/route-handler.service';

interface NormalizedError {
  status: number;
  error: string;
  code?: string;
  issues?: Array<{ field?: string; path?: string[]; message: string }>;
}

/**
 * Global exception filter that normalizes all errors to a consistent format.
 *
 * Response format:
 * ```json
 * {
 *   "error": "Error message",
 *   "code": "ERROR_CODE",
 *   "issues": [{ "field": "fieldName", "message": "..." }],
 *   "requestId": "...",
 *   "timestamp": "..."
 * }
 * ```
 */
@Catch()
export class MastraExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MastraExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Don't try to send response if already sent
    if (response.headersSent) {
      return;
    }

    const normalized = this.normalizeError(exception);
    const requestId = request.headers['x-request-id'] || (request as any).mastraRequestId;

    // Log error
    if (normalized.status >= 500) {
      this.logger.error(
        `${request.method} ${request.path} - ${normalized.status} ${normalized.error}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.path} - ${normalized.status} ${normalized.error}`);
    }

    response.status(normalized.status).json({
      error: normalized.error,
      ...(normalized.code && { code: normalized.code }),
      ...(normalized.issues && { issues: normalized.issues }),
      ...(requestId && { requestId }),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Normalize any error type to a consistent format.
   */
  private normalizeError(exception: unknown): NormalizedError {
    // NestJS HttpException (includes all standard exceptions)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          status,
          error: response,
          code: this.getErrorCode(status),
        };
      }

      if (typeof response === 'object' && response !== null) {
        const resp = response as any;
        const message = Array.isArray(resp.message) ? resp.message.join(', ') : resp.message;
        return {
          status,
          error: message || resp.error || exception.message,
          code: resp.code || this.getErrorCode(status),
          issues: resp.issues,
        };
      }

      return {
        status,
        error: exception.message,
        code: this.getErrorCode(status),
      };
    }

    // Zod validation error
    if (exception instanceof ZodError) {
      const formatted = formatZodError(exception, 'request');
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        issues: formatted.issues,
      };
    }

    // Our ValidationError (wraps ZodError with context)
    if (exception instanceof ValidationError) {
      const formatted = formatZodError(exception.zodError, 'request');
      return {
        status: HttpStatus.BAD_REQUEST,
        error: exception.message,
        code: 'VALIDATION_ERROR',
        issues: formatted.issues,
      };
    }

    // HTTPException from Mastra (has status property)
    if (exception !== null && typeof exception === 'object' && 'status' in exception) {
      const status = (exception as any).status;

      if (typeof status === 'number') {
        return {
          status,
          error: status >= 500 ? 'An internal error occurred' : (exception as any).message || 'An error occurred',
          code: this.getErrorCode(status),
        };
      }
    }

    // MastraError with status in details
    if (
      exception !== null &&
      typeof exception === 'object' &&
      'details' in exception &&
      (exception as any).details &&
      typeof (exception as any).details === 'object' &&
      'status' in (exception as any).details
    ) {
      const status = (exception as any).details.status;

      if (typeof status === 'number') {
        return {
          status,
          error: status >= 500 ? 'An internal error occurred' : (exception as any).message || 'An error occurred',
          code: (exception as any).code || this.getErrorCode(status),
        };
      }
    }

    // Standard Error
    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      };
    }

    // Unknown error type
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    };
  }

  /**
   * Get error code from HTTP status.
   */
  private getErrorCode(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 413:
        return 'PAYLOAD_TOO_LARGE';
      case 429:
        return 'RATE_LIMIT_EXCEEDED';
      case 500:
        return 'INTERNAL_ERROR';
      case 502:
        return 'BAD_GATEWAY';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      case 504:
        return 'GATEWAY_TIMEOUT';
      default:
        return 'ERROR';
    }
  }
}
