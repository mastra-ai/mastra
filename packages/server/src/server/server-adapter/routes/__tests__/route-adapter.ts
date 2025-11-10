import type { Mastra } from '@mastra/core';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import type { ServerRoute } from '../../index';
import { createMockRequestContext } from './test-helpers';

export interface MockRequest {
  method: string;
  path: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface RouteExecutionContext {
  mastra: Mastra;
  tools?: Record<string, unknown>;
  taskStore?: unknown;
  requestContext?: RequestContext;
}

export class RouteAdapter {
  async executeRoute(route: ServerRoute, request: MockRequest, context: RouteExecutionContext): Promise<unknown> {
    const method = request.method.toUpperCase();
    if (route.method !== 'ALL' && route.method !== method) {
      throw new Error(`Method mismatch: expected ${route.method}, received ${method}`);
    }

    const pathParams = this.extractAndValidatePathParams(route, request.path);
    const queryParams = this.validateQueryParams(route, request.query);
    const body = this.validateBody(route, request.body);

    const handlerParams: Record<string, unknown> = {
      mastra: context.mastra,
      requestContext: context.requestContext ?? createMockRequestContext(),
    };

    if (context.tools) {
      handlerParams.tools = context.tools;
    }

    if (context.taskStore) {
      handlerParams.taskStore = context.taskStore;
    }

    Object.assign(handlerParams, pathParams);
    if (queryParams) {
      Object.assign(handlerParams, queryParams);
    }

    if (body !== undefined) {
      handlerParams.body = body;

      if (body && typeof body === 'object' && !Array.isArray(body)) {
        for (const [key, value] of Object.entries(body)) {
          if (handlerParams[key] === undefined) {
            handlerParams[key] = value;
          }
        }
      }
    }

    const response = await route.handler(handlerParams as any);

    if (route.responseType === 'json' && route.responseSchema) {
      const result = route.responseSchema.safeParse(response);
      if (!result.success) {
        throw new Error(`Response validation failed: ${this.formatZodError(result.error)}`);
      }
      return result.data;
    }

    return response;
  }

  private extractAndValidatePathParams(route: ServerRoute, requestPath: string): Record<string, unknown> {
    const params = this.matchPath(route.path, requestPath);

    if (route.pathParamSchema) {
      const result = route.pathParamSchema.safeParse(params);
      if (!result.success) {
        throw new Error(`Path parameter validation failed: ${this.formatZodError(result.error)}`);
      }
      return result.data as Record<string, unknown>;
    }

    return params;
  }

  private validateQueryParams(route: ServerRoute, query: MockRequest['query']): Record<string, unknown> | undefined {
    const rawQuery = query ?? {};

    if (!route.queryParamSchema) {
      return Object.keys(rawQuery).length > 0 ? (rawQuery as Record<string, unknown>) : undefined;
    }

    const result = route.queryParamSchema.safeParse(rawQuery);
    if (!result.success) {
      throw new Error(`Query parameter validation failed: ${this.formatZodError(result.error)}`);
    }

    return result.data as Record<string, unknown>;
  }

  private validateBody(route: ServerRoute, body: unknown): unknown {
    if (!route.bodySchema) {
      return body;
    }

    const payload = body ?? {};
    const result = route.bodySchema.safeParse(payload);
    if (!result.success) {
      throw new Error(`Body validation failed: ${this.formatZodError(result.error)}`);
    }

    return result.data;
  }

  private matchPath(routePath: string, requestPath: string): Record<string, string> {
    const routeSegments = this.normalizePath(routePath).split('/');
    const requestSegments = this.normalizePath(requestPath).split('/');
    const params: Record<string, string> = {};

    if (routeSegments.length !== requestSegments.length) {
      throw new Error(`Path mismatch: expected "${routePath}", received "${requestPath}"`);
    }

    for (let i = 0; i < routeSegments.length; i += 1) {
      const routeSegment = routeSegments[i];
      const requestSegment = requestSegments[i];

      if (routeSegment.startsWith(':')) {
        const key = routeSegment.slice(1);
        params[key] = decodeURIComponent(requestSegment);
        continue;
      }

      if (routeSegment !== requestSegment) {
        throw new Error(`Path mismatch at segment ${i}: expected "${routeSegment}", received "${requestSegment}"`);
      }
    }

    return params;
  }

  private normalizePath(path: string): string {
    if (path === '') {
      return '';
    }

    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    const withoutTrailing = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    return withoutTrailing;
  }

  private formatZodError(error: z.ZodError): string {
    return JSON.stringify(
      error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      null,
      2,
    );
  }
}
