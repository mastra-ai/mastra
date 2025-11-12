import { describe, it, expect, beforeEach } from 'vitest';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { Mastra } from '@mastra/core';
import type { Tool } from '@mastra/core/tools';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { buildRouteRequest, expectValidSchema } from '@mastra/server/server-adapter';
import { createDefaultTestContext, parseDatesInResponse } from './mock-helpers';

/**
 * Test context for adapter integration tests
 * Convention: Create entities with IDs that match auto-generated values in getDefaultValidPathParams:
 * - agentId: 'test-agent'
 * - workflowId: 'test-workflow'
 * - toolId: 'test-tool'
 * - etc.
 */
export interface AdapterTestContext {
  mastra: Mastra;
  tools?: Record<string, Tool>;
  taskStore?: InMemoryTaskStore;
  customRouteAuthConfig?: Map<string, boolean>;
  playground?: boolean;
  isDev?: boolean;
}

/**
 * HTTP request to execute through adapter
 */
export interface HttpRequest {
  method: string;
  path: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * HTTP response from adapter
 */
export interface HttpResponse {
  status: number;
  type: 'json' | 'stream';
  data?: unknown;
  stream?: ReadableStream | AsyncIterable<unknown>;
  headers: Record<string, string>;
}

/**
 * Configuration for adapter integration test suite
 */
export interface RouteAdapterTestSuiteConfig {
  /** Name for the test suite */
  suiteName?: string;

  /** Routes to test */
  routes: ServerRoute[];

  /**
   * Setup adapter and app for testing
   * Called once before all tests
   */
  setupAdapter: (context: AdapterTestContext) => {
    adapter: any;
    app: any;
  };

  /**
   * Execute HTTP request through the adapter's framework (Express/Hono)
   * - Express: Use supertest
   * - Hono: Use app.request() or app.fetch()
   */
  executeHttpRequest: (app: any, request: HttpRequest) => Promise<HttpResponse>;

  /**
   * Create test context with Mastra instance, agents, etc.
   * Convention: Create entities with IDs matching auto-generated values
   * Optional - uses createDefaultTestContext() if not provided
   */
  createTestContext?: () => Promise<AdapterTestContext> | AdapterTestContext;
}

/**
 * Creates a standardized integration test suite for server adapters (Express/Hono)
 *
 * Tests the complete HTTP request/response cycle:
 * - Parameter extraction from URL/query/body
 * - Schema validation
 * - Handler execution
 * - Response formatting
 *
 * Uses auto-generated test data from route schemas.
 * For specific test scenarios, write additional tests outside the factory.
 */
export function createRouteAdapterTestSuite(config: RouteAdapterTestSuiteConfig) {
  const {
    suiteName = 'Route Adapter Integration',
    routes,
    setupAdapter,
    executeHttpRequest,
    createTestContext,
  } = config;

  describe(suiteName, () => {
    let context: AdapterTestContext;
    let app: any;

    beforeEach(async () => {
      // Create test context - use provided or default
      if (createTestContext) {
        const result = createTestContext();
        context = result instanceof Promise ? await result : result;
      } else {
        context = await createDefaultTestContext();
      }

      // Setup adapter and app
      const setup = setupAdapter(context);
      app = setup.app;
    });

    routes.forEach(route => {
      const testName = `${route.method} ${route.path}`;
      describe(testName, () => {
        it('should execute with valid request', async () => {
          // Build HTTP request with auto-generated test data
          const request = buildRouteRequest(route);

          // Convert to HttpRequest format
          const httpRequest: HttpRequest = {
            method: request.method,
            path: request.path,
            query: request.query,
            body: request.body,
          };

          // Execute through adapter
          const response = await executeHttpRequest(app, httpRequest);

          // Validate response
          expect(response.status).toBeLessThan(400);

          if (route.responseType === 'json') {
            expect(response.type).toBe('json');
            expect(response.data).toBeDefined();

            // Validate response schema (if defined)
            if (route.responseSchema) {
              const parsedData = parseDatesInResponse(response.data);
              expectValidSchema(route.responseSchema, parsedData);
            }

            // Verify JSON is serializable (no circular refs, functions, etc)
            expect(() => JSON.stringify(response.data)).not.toThrow();
          } else if (route.responseType === 'stream') {
            expect(response.type).toBe('stream');
            expect(response.stream).toBeDefined();

            // Verify stream is consumable (has getReader or is async iterable)
            const hasReader = response.stream && typeof (response.stream as any).getReader === 'function';
            const isAsyncIterable =
              response.stream &&
              typeof (response.stream as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function';
            expect(hasReader || isAsyncIterable).toBe(true);
          }
        });

        // Error handling tests for routes with entity IDs
        if (route.path.includes(':agentId')) {
          it('should return 404 when agent not found', async () => {
            // Build request with non-existent agent
            const request = buildRouteRequest(route, {
              pathParams: { agentId: 'non-existent-agent' },
            });

            const httpRequest: HttpRequest = {
              method: request.method,
              path: request.path,
              query: request.query,
              body: request.body,
            };

            const response = await executeHttpRequest(app, httpRequest);

            // Expect 404 status
            expect(response.status).toBe(404);
          });
        }

        if (route.path.includes(':workflowId')) {
          it('should return 404 when workflow not found', async () => {
            const request = buildRouteRequest(route, {
              pathParams: { workflowId: 'non-existent-workflow' },
            });

            const httpRequest: HttpRequest = {
              method: request.method,
              path: request.path,
              query: request.query,
              body: request.body,
            };

            const response = await executeHttpRequest(app, httpRequest);

            expect(response.status).toBe(404);
          });
        }

        // Stream consumption test
        if (route.responseType === 'stream') {
          it('should be consumable via stream reader', async () => {
            const request = buildRouteRequest(route);

            const httpRequest: HttpRequest = {
              method: request.method,
              path: request.path,
              query: request.query,
              body: request.body,
            };

            const response = await executeHttpRequest(app, httpRequest);

            expect(response.status).toBeLessThan(400);
            expect(response.stream).toBeDefined();

            // Try to consume the stream
            if (typeof (response.stream as any).getReader === 'function') {
              // Web Streams API
              const reader = (response.stream as ReadableStream).getReader();
              const firstChunk = await reader.read();
              expect(firstChunk).toBeDefined();
              // Don't validate chunk structure - that's handler's job
              reader.releaseLock();
            } else if (typeof (response.stream as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
              // Async iterable
              const iterator = (response.stream as AsyncIterable<unknown>)[Symbol.asyncIterator]();
              const firstChunk = await iterator.next();
              expect(firstChunk).toBeDefined();
            }
          });
        }
      });
    });
  });
}
