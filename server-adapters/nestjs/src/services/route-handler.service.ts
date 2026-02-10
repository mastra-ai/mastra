import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import type { ServerRoute, ServerContext } from '@mastra/server/server-adapter';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ZodError } from 'zod';

import { MASTRA, MASTRA_OPTIONS } from '../constants';
import type { MastraModuleOptions } from '../mastra.module';

export interface RouteMatch {
  route: ServerRoute;
  pathParams: Record<string, string>;
}

export interface RouteHandlerParams {
  /** URL path parameters (e.g., { agentId: '123' }) */
  pathParams: Record<string, string>;
  /** Query string parameters */
  queryParams: Record<string, unknown>;
  /** Request body (for POST/PUT/PATCH) */
  body: unknown;
  /** Request context (user, session, etc.) */
  requestContext: RequestContext;
  /** Abort signal for request cancellation */
  abortSignal: AbortSignal;
}

export interface RouteHandlerResult {
  /** The result data from the handler */
  data: unknown;
  /** Response type determines how to send the response */
  responseType: 'json' | 'stream' | 'datastream-response' | 'mcp-http' | 'mcp-sse';
  /** Stream format (only for 'stream' responseType) */
  streamFormat?: 'sse' | 'stream';
}

/**
 * Service that bridges NestJS controllers to Mastra route handlers.
 * Handles parameter validation and invokes the appropriate handler.
 */
@Injectable()
export class RouteHandlerService {
  private readonly logger = new Logger(RouteHandlerService.name);
  private readonly routeMap: Map<string, ServerRoute>;

  constructor(
    @Inject(MASTRA) private readonly mastra: Mastra,
    @Inject(MASTRA_OPTIONS) private readonly options: MastraModuleOptions,
  ) {
    // Build a map of path+method to route for fast lookup
    this.routeMap = new Map();
    for (const route of SERVER_ROUTES) {
      const key = this.getRouteKey(route.method, route.path);
      this.routeMap.set(key, route);
    }
  }

  /**
   * Find a route by exact method and path pattern.
   * Use matchRoute() for parameterized path matching.
   */
  findRoute(method: string, path: string): ServerRoute | undefined {
    const key = this.getRouteKey(method, path);
    return this.routeMap.get(key);
  }

  /**
   * Match a request method and path against registered routes.
   * Handles both exact matches and parameterized path patterns.
   *
   * @param method - HTTP method (GET, POST, etc.)
   * @param path - Request path to match
   * @returns Route match with path parameters, or null if no match
   */
  matchRoute(method: string, path: string): RouteMatch | null {
    // Handle ALL method routes (OPTIONS preflight)
    const methodsToCheck = method === 'OPTIONS' ? ['ALL', method] : [method, 'ALL'];

    for (const checkMethod of methodsToCheck) {
      // First check exact match (fast path)
      const exactKey = this.getRouteKey(checkMethod, path);
      const exactRoute = this.routeMap.get(exactKey);
      if (exactRoute) {
        return { route: exactRoute, pathParams: {} };
      }

      // Then check parameterized routes
      for (const route of SERVER_ROUTES) {
        if (route.method.toUpperCase() !== checkMethod) {
          continue;
        }

        const pathParams = this.matchPath(route.path, path);
        if (pathParams) {
          return { route, pathParams };
        }
      }
    }

    return null;
  }

  /**
   * Get all routes (for dynamic controller generation).
   */
  getAllRoutes(): ServerRoute[] {
    return SERVER_ROUTES;
  }

  /**
   * Match a path against a route pattern.
   * Returns path parameters if matched, null otherwise.
   */
  private matchPath(pattern: string, path: string): Record<string, string> | null {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    // Must have same number of parts
    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      // These should always be defined since we checked array lengths match
      if (patternPart === undefined || pathPart === undefined) {
        return null;
      }

      if (patternPart.startsWith(':')) {
        // This is a parameter - decode with error handling
        const paramName = patternPart.slice(1);
        try {
          params[paramName] = decodeURIComponent(pathPart);
        } catch {
          // Invalid percent encoding - throw a proper 400 error
          throw new BadRequestException(`Invalid URL encoding in path parameter: ${paramName}`);
        }
      } else if (patternPart !== pathPart) {
        // Literal parts must match exactly
        return null;
      }
    }

    return params;
  }

  /**
   * Execute a route handler with the given parameters.
   */
  async executeHandler(route: ServerRoute, params: RouteHandlerParams): Promise<RouteHandlerResult> {
    let validatedPathParams = params.pathParams;
    if (route.pathParamSchema) {
      try {
        validatedPathParams = await route.pathParamSchema.parseAsync(params.pathParams);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new ValidationError('Invalid path parameters', error);
        }
        throw error;
      }
    }

    let validatedQueryParams = params.queryParams;
    if (route.queryParamSchema) {
      try {
        validatedQueryParams = await route.queryParamSchema.parseAsync(params.queryParams);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new ValidationError('Invalid query parameters', error);
        }
        throw error;
      }
    }

    let validatedBody = params.body;
    if (route.bodySchema && params.body) {
      try {
        validatedBody = await route.bodySchema.parseAsync(params.body);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new ValidationError('Invalid request body', error);
        }
        throw error;
      }
    }

    const context: ServerContext = {
      mastra: this.mastra,
      requestContext: params.requestContext,
      registeredTools: this.options.tools,
      taskStore: this.options.taskStore,
      abortSignal: params.abortSignal,
      routePrefix: this.options.prefix,
    };

    const handlerParams = {
      ...validatedPathParams,
      ...validatedQueryParams,
      ...(typeof validatedBody === 'object' && validatedBody !== null ? validatedBody : {}),
      ...context,
    };

    const data = await route.handler(handlerParams);

    return {
      data,
      responseType: route.responseType,
      streamFormat: route.streamFormat,
    };
  }

  private getRouteKey(method: string, path: string): string {
    return `${method.toUpperCase()}:${path}`;
  }
}

/**
 * Error class for validation failures with Zod error details.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError: ZodError,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
