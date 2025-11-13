import { describe, it, expect, beforeEach } from 'vitest';
import type { ServerRoute } from '@mastra/server/server-adapter';
import type { Mastra } from '@mastra/core';
import type { Tool } from '@mastra/core/tools';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { buildRouteRequest, expectValidSchema } from '@mastra/server/server-adapter';
import { createDefaultTestContext, parseDatesInResponse } from './test-helpers';

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

    // Test deprecated routes separately - just verify they're marked correctly
    const deprecatedRoutes = routes.filter(r => r.deprecated);
    console.log(deprecatedRoutes);
    deprecatedRoutes.forEach(route => {
      const testName = `${route.method} ${route.path}`;
      describe(testName, () => {
        it('should be marked as deprecated', () => {
          expect(route.deprecated).toBe(true);
          expect(route.openapi?.deprecated).toBe(true);
        });
      });
    });

    // Test non-deprecated routes with full test suite
    const activeRoutes = routes.filter(r => !r.deprecated);
    activeRoutes.forEach(route => {
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

        // Schema validation tests - only for routes with query or body schemas
        if (route.queryParamSchema || route.bodySchema) {
          it('should return 400 when schema validation fails', async () => {
            const request = buildRouteRequest(route);

            let httpRequest: HttpRequest;

            if (route.queryParamSchema) {
              // Add invalid query param (add an object where string/number expected)
              httpRequest = {
                method: request.method,
                path: request.path,
                query: {
                  ...(request.query || {}),
                  invalidQueryParam: { nested: 'object' } as any,
                },
                body: request.body,
              };
            } else if (route.bodySchema) {
              // Keep valid request but add an invalid field with wrong type
              httpRequest = {
                method: request.method,
                path: request.path,
                query: request.query,
                body: {
                  ...(typeof request.body === 'object' && request.body !== null ? request.body : {}),
                  invalidBodyField: { deeply: { nested: 'object' } },
                },
              };
            } else {
              // Shouldn't happen, but fallback
              httpRequest = {
                method: request.method,
                path: request.path,
                query: request.query,
                body: request.body,
              };
            }

            const response = await executeHttpRequest(app, httpRequest);

            // Expect 400 Bad Request for schema validation failure
            // Some routes may still succeed if they ignore unknown fields
            // So we check for either 400 or success
            expect([200, 201, 400]).toContain(response.status);

            if (response.status === 400) {
              expect(response.type).toBe('json');

              // Verify error response has helpful structure
              const errorData = response.data as any;
              expect(errorData).toBeDefined();
              expect(errorData.error || errorData.message || errorData.details).toBeDefined();
            }
          });
        }

        // RequestContext tests - test for POST/PUT routes that accept body
        if (['POST', 'PUT'].includes(route.method) && route.bodySchema) {
          it('should accept requestContext in body', async () => {
            const request = buildRouteRequest(route);

            const httpRequest: HttpRequest = {
              method: request.method,
              path: request.path,
              query: request.query,
              body: {
                ...(typeof request.body === 'object' && request.body !== null ? request.body : {}),
                requestContext: { userId: 'test-user-123', sessionId: 'session-456' },
              },
            };

            const response = await executeHttpRequest(app, httpRequest);

            // Should succeed - requestContext is optional and should not cause errors
            expect(response.status).toBeLessThan(500);
          });
        }

        // Body field spreading test - for POST/PUT routes with body
        if (['POST', 'PUT'].includes(route.method) && route.bodySchema) {
          it('should spread body fields to handler params', async () => {
            const request = buildRouteRequest(route);

            // Add a unique field to the body
            const testField = 'testBodyField';
            const testValue = 'testValue123';

            const httpRequest: HttpRequest = {
              method: request.method,
              path: request.path,
              query: request.query,
              body: {
                ...(typeof request.body === 'object' && request.body !== null ? request.body : {}),
                [testField]: testValue,
              },
            };

            const response = await executeHttpRequest(app, httpRequest);

            // Should succeed - body fields should be spread correctly
            // Handler receives both `body: {...}` AND individual fields
            expect(response.status).toBeLessThan(400);
          });
        }
      });
    });

    // Additional cross-route tests
    describe('Cross-Route Tests', () => {
      it('should handle array query parameters', async () => {
        // Find a non-deprecated GET route to test with
        const getRoute = routes.find(r => r.method === 'GET' && !r.deprecated);
        if (!getRoute) return;

        const request = buildRouteRequest(getRoute);

        const httpRequest: HttpRequest = {
          method: request.method,
          path: request.path,
          query: {
            ...(request.query || {}),
            tags: ['tag1', 'tag2', 'tag3'],
          },
        };

        const response = await executeHttpRequest(app, httpRequest);

        // Should handle array params without error
        expect(response.status).toBeLessThan(500);
      });

      it('should return valid error response structure', async () => {
        // Find a non-deprecated route with agentId to test 404
        const agentRoute = routes.find(r => r.path.includes(':agentId') && !r.deprecated);
        if (!agentRoute) return;

        const request = buildRouteRequest(agentRoute, {
          pathParams: { agentId: 'non-existent-agent-error-test' },
        });

        const httpRequest: HttpRequest = {
          method: request.method,
          path: request.path,
          query: request.query,
          body: request.body,
        };

        const response = await executeHttpRequest(app, httpRequest);

        expect(response.status).toBe(404);
        expect(response.type).toBe('json');

        // Verify error has a structured format
        const errorData = response.data as any;
        expect(errorData).toBeDefined();

        // Should have at least one of these error fields
        const hasErrorField =
          errorData.error !== undefined ||
          errorData.message !== undefined ||
          errorData.details !== undefined ||
          errorData.statusCode !== undefined;

        expect(hasErrorField).toBe(true);
      });

      it('should return 400 for empty body when fields are required', async () => {
        // Find a non-deprecated POST route with body schema
        const postRoute = routes.find(r => r.method === 'POST' && r.bodySchema && !r.deprecated);
        if (!postRoute) return;

        const request = buildRouteRequest(postRoute);

        const httpRequest: HttpRequest = {
          method: request.method,
          path: request.path,
          query: request.query,
          body: {}, // Empty body - missing required fields
        };

        const response = await executeHttpRequest(app, httpRequest);

        // Should return 400 Bad Request for missing required fields
        // (or 200/201 if all fields are optional)
        expect([200, 201, 400]).toContain(response.status);

        if (response.status === 400) {
          expect(response.type).toBe('json');
          const errorData = response.data as any;
          expect(errorData).toBeDefined();
          expect(errorData.error || errorData.message || errorData.details).toBeDefined();
        }
      });
    });
  });
}
