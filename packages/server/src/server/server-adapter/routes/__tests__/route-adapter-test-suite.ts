import { describe, it, expect } from 'vitest';
import type { ServerRoute } from '../index';
import { expectValidSchema } from './test-helpers';
import { buildRouteRequest, type RouteRequestOverrides, type RouteRequestPayload } from './route-test-utils';

export interface RouteExecutionContext {
  route: ServerRoute;
  request: RouteRequestPayload;
}

export type RouteExecutionResult =
  | {
      type: 'json';
      status: number;
      data: unknown;
      headers?: Record<string, string>;
    }
  | {
      type: 'stream';
      status: number;
      stream: unknown;
      headers?: Record<string, string>;
    };

export interface RouteAdapterTestSuiteConfig {
  suiteName?: string;
  routes: ServerRoute[];
  executeRoute: (context: RouteExecutionContext) => Promise<RouteExecutionResult>;
  buildRequestOverrides?: (route: ServerRoute) => RouteRequestOverrides;
  skipRoute?: (route: ServerRoute) => boolean;
  transformResponse?: (route: ServerRoute, data: unknown) => unknown;
}

/**
 * Generates integration-style tests for adapter implementations.
 * The caller is responsible for translating the request payload into concrete HTTP calls.
 */
export function createRouteAdapterTestSuite(config: RouteAdapterTestSuiteConfig) {
  const {
    suiteName = 'Route Adapter Integration',
    routes,
    executeRoute,
    buildRequestOverrides,
    skipRoute,
    transformResponse,
  } = config;

  describe(suiteName, () => {
    routes.forEach(route => {
      if (skipRoute?.(route)) {
        return;
      }

      const testName = `${route.method} ${route.path}`;

        it(`should execute ${testName}`, async () => {
          const requestOverrides = buildRequestOverrides?.(route) ?? {};
        const request = buildRouteRequest(route, requestOverrides);

        const result = await executeRoute({ route, request });

        expect(result.status).toBeLessThan(400);
        if (route.responseType === 'json') {
          expect(result.type).toBe('json');
          const jsonResult = result as Extract<RouteExecutionResult, { type: 'json' }>;
          const hydratedData = reviveDates(
            transformResponse ? transformResponse(route, jsonResult.data) : jsonResult.data,
          );
          if (route.responseSchema) {
            expectValidSchema(route.responseSchema, hydratedData);
          }
        } else {
          expect(result.type).toBe('stream');
          const streamResult = result as RouteExecutionResult & { type: 'stream' };
          expect(streamResult.stream).toBeDefined();
          const hasReader =
            streamResult.stream && typeof (streamResult.stream as { getReader?: () => unknown }).getReader === 'function';
          const isAsyncIterable = streamResult.stream && typeof (streamResult.stream as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function';
          expect(hasReader || isAsyncIterable).toBe(true);
        }
      });
    });
  });
}

function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => reviveDates(item)) as unknown as T;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, reviveDates(val)]);
    return Object.fromEntries(entries) as T;
  }

  if (typeof value === 'string' && isIsoDateString(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date as unknown as T;
    }
  }

  return value;
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}
