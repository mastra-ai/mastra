import { SERVER_ERROR_CODES, getServerErrorInfo } from '@mastra/server/error-codes';
import type { ServerErrorInfo } from '@mastra/server/error-codes';
import { formatZodError, isZodError } from '@mastra/server/handlers/error';
import {
  formatErrorResponse,
  getCustomHTTPExceptionResponseWithCode,
  HTTPException as MastraHTTPException,
} from '@mastra/server/server-adapter';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ValidationError } from '../services/route-handler.service';

interface NormalizedError {
  status: number;
  error: string;
  issues?: Array<{ field?: string; path?: string[]; message: string }>;
}

/**
 * Global exception filter that normalizes all errors to a consistent format.
 *
 * Response format:
 * ```json
 * {
 *   "error": "Error message",
 *   "code": "BUSINESS_ERROR_CODE",
 *   "metadata": { ... },
 *   "issues": [{ "field": "fieldName", "message": "..." }],
 *   "requestId": "...",
 *   "timestamp": "..."
 * }
 * ```
 */
@Catch()
export class MastraExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MastraExceptionFilter.name);

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Don't try to send response if already sent
    if (response.headersSent) {
      return;
    }

    if (exception instanceof ValidationError) {
      response.status(exception.status).json(exception.body);
      return;
    }

    const customResponse = await getCustomHTTPExceptionResponseWithCode(exception);
    if (customResponse) {
      customResponse.headers.forEach((value, name) => {
        if (name.toLowerCase() !== 'set-cookie') {
          response.setHeader(name, value);
        }
      });
      const setCookies = customResponse.headers.getSetCookie();
      if (setCookies.length > 0) {
        response.setHeader('set-cookie', setCookies);
      }
      response.status(customResponse.status).send(Buffer.from(await customResponse.arrayBuffer()));
      return;
    }

    if (exception instanceof MastraHTTPException) {
      const { status, body } = formatErrorResponse(exception);
      response.status(status).json(body);
      return;
    }

    const normalized = this.normalizeError(exception);
    const rawRequestId = request.headers['x-request-id'];
    const requestId =
      (Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId) || (request as any).mastraRequestId;

    // Log error
    if (normalized.status >= 500) {
      this.logger.error(
        `${request.method} ${request.path} - ${normalized.status} ${normalized.error}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.path} - ${normalized.status} ${normalized.error}`);
    }

    response.status(normalized.status).json({
      error: normalized.error,
      ...this.resolveErrorInfo(exception, normalized),
      ...(normalized.issues && { issues: normalized.issues }),
      ...(requestId && { requestId }),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resolve the business code for an error. Exceptions thrown by Mastra code carry their own
   * code; Nest exceptions without one were thrown on purpose and are uncategorized;
   * express body-parser failures are mapped by type.
   */
  private resolveErrorInfo(exception: unknown, normalized: NormalizedError): ServerErrorInfo {
    if (exception instanceof HttpException) {
      return getServerErrorInfo(exception.getResponse()) ?? { code: SERVER_ERROR_CODES.UNCATEGORIZED_ERROR };
    }

    if (isZodError(exception)) {
      return { code: SERVER_ERROR_CODES.REQUEST_VALIDATION_FAILED };
    }

    const bodyParserType = typeof exception === 'object' && exception !== null ? (exception as any).type : undefined;
    if (bodyParserType === 'entity.too.large') {
      return { code: SERVER_ERROR_CODES.REQUEST_BODY_TOO_LARGE };
    }
    if (bodyParserType === 'entity.parse.failed') {
      return { code: SERVER_ERROR_CODES.REQUEST_BODY_INVALID_JSON };
    }

    const { code, metadata } = formatErrorResponse(exception).body;
    return { code, metadata };
  }

  /**
   * Normalize any error type to a consistent format.
   */
  private normalizeError(exception: unknown): NormalizedError {
    // NestJS HttpException (includes all standard exceptions)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (status >= 500) {
        return {
          status,
          error: 'An internal error occurred',
        };
      }

      if (typeof response === 'string') {
        return {
          status,
          error: response,
        };
      }

      if (typeof response === 'object' && response !== null) {
        const resp = response as any;
        const message = Array.isArray(resp.message) ? resp.message.join(', ') : resp.message;
        return {
          status,
          error: message || resp.error || exception.message,
          issues: resp.issues,
        };
      }

      return {
        status,
        error: exception.message,
      };
    }

    // Zod validation error
    if (isZodError(exception)) {
      const formatted = formatZodError(exception, 'request');
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Validation failed',
        issues: formatted.issues,
      };
    }

    // Our ValidationError (wraps ZodError with context)
    if (exception instanceof ValidationError) {
      const formatted = formatZodError(exception.zodError, 'request');
      return {
        status: HttpStatus.BAD_REQUEST,
        error: exception.message,
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
        };
      }
    }

    // Standard Error
    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'An internal error occurred',
      };
    }

    // Unknown error type
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'An unexpected error occurred',
    };
  }
}
