import type { ServerRoute } from '@mastra/server/server-adapter';
import {
  All,
  Controller,
  Inject,
  NotFoundException,
  Req,
  Res,
  UseGuards,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { MASTRA_OPTIONS } from '../constants';
import { MastraExceptionFilter } from '../filters/mastra-exception.filter';
import { MastraRouteGuard } from '../guards/mastra-route.guard';
import { RequestTrackingInterceptor } from '../interceptors/request-tracking.interceptor';
import { StreamingInterceptor } from '../interceptors/streaming.interceptor';
import { TracingInterceptor } from '../interceptors/tracing.interceptor';
import type { MastraModuleOptions } from '../mastra.module';
import { RequestContextService } from '../services/request-context.service';
import { RouteHandlerService } from '../services/route-handler.service';
import { parseMultipartFormData } from '../utils/parse-multipart';
import { getMastraRoutePath } from '../utils/route-path';

/**
 * Main Mastra controller that handles all routes dynamically.
 * Routes are matched against SERVER_ROUTES from @mastra/server.
 *
 * Auth and rate limiting are handled via MastraRouteGuard, which:
 * 1. Avoids affecting other controllers in the user's NestJS app
 * 2. Enforces auth only for matched Mastra routes
 */
@Controller()
@UseInterceptors(RequestTrackingInterceptor, TracingInterceptor, StreamingInterceptor)
@UseFilters(MastraExceptionFilter)
@UseGuards(MastraRouteGuard)
export class MastraController {
  constructor(
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
    @Inject(RouteHandlerService) private readonly routeHandler: RouteHandlerService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Catch-all handler that matches incoming requests to Mastra routes.
   */
  @All('*')
  async handleRequest(@Req() req: Request, @Res({ passthrough: true }) _res: Response): Promise<unknown> {
    const path = req.path;
    const method = req.method.toUpperCase();

    const routePath = getMastraRoutePath(path, this.options.prefix);

    // Reject paths with double slashes (e.g., /api//agents)
    if (routePath.includes('//')) {
      throw new NotFoundException(`Route not found: ${method} ${path}`);
    }

    // Find matching route using RouteHandlerService's consolidated route matching
    const matchResult = this.routeHandler.matchRoute(method, routePath);

    if (!matchResult) {
      throw new NotFoundException(`Route not found: ${method} ${path}`);
    }

    const { route, pathParams } = matchResult;
    const queryParams = this.parseQueryParams(req.query as Record<string, unknown>);
    const body = await this.parseBody(req, route);

    return this.routeHandler.executeHandler(route, {
      pathParams,
      queryParams,
      body,
      requestContext: this.requestContext.requestContext,
      abortSignal: this.requestContext.abortSignal,
    });
  }

  /**
   * Parse and normalize query parameters.
   * Handles type coercion for numbers, booleans, arrays, and JSON strings.
   */
  private parseQueryParams(query: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);

    for (const [key, value] of Object.entries(query)) {
      // Skip requestContext - it's handled separately
      if (key === 'requestContext') {
        continue;
      }
      if (dangerousKeys.has(key)) {
        continue;
      }

      result[key] = this.coerceQueryValue(value);
    }

    return result;
  }

  /**
   * Coerce a query parameter value to its appropriate type.
   *
   * Type coercion rules:
   * - "true"/"false" → boolean
   * - "null" → null
   * - Numeric strings → number (except IDs with leading zeros like "007")
   * - JSON objects/arrays → parsed object/array
   *
   * @example
   * // Numbers
   * coerceQueryValue("42")      // → 42
   * coerceQueryValue("3.14")    // → 3.14
   * coerceQueryValue("007")     // → "007" (preserved as string)
   *
   * // Booleans
   * coerceQueryValue("true")    // → true
   * coerceQueryValue("false")   // → false
   *
   * // JSON
   * coerceQueryValue('{"a":1}') // → { a: 1 }
   */
  private coerceQueryValue(value: unknown): unknown {
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => this.coerceQueryValue(v));
    }

    // Handle strings
    if (typeof value === 'string') {
      // Boolean coercion
      if (value === 'true') return true;
      if (value === 'false') return false;

      // Null coercion
      if (value === 'null') return null;

      // Number coercion (only if the entire string is a valid number)
      if (value !== '' && !isNaN(Number(value)) && isFinite(Number(value))) {
        // Don't coerce strings that look like phone numbers or IDs with leading zeros
        if (!value.startsWith('0') || value === '0' || value.includes('.')) {
          return Number(value);
        }
      }

      // JSON object/array coercion
      if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
        try {
          return JSON.parse(value);
        } catch {
          // Not valid JSON, use as string
        }
      }
    }

    return value;
  }

  /**
   * Parse request body, handling multipart/form-data and JSON.
   */
  private async parseBody(req: Request, route: ServerRoute): Promise<unknown> {
    // Only parse body for methods that typically have bodies
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return undefined;
    }

    const contentType = req.headers['content-type'] || '';

    // Handle multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      const maxFileSize = route.maxBodySize ?? this.options.bodyLimitOptions?.maxFileSize;
      const allowedMimeTypes = this.options.bodyLimitOptions?.allowedMimeTypes;

      return parseMultipartFormData(req, {
        maxFileSize,
        allowedMimeTypes,
      });
    }

    // JSON body is already parsed by JsonBodyMiddleware
    return req.body;
  }
}
