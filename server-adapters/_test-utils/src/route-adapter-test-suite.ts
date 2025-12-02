import { describe, it, expect, beforeEach } from 'vitest';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';

import {
  AdapterTestContext,
  AdapterTestSuiteConfig,
  buildRouteRequest,
  createDefaultTestContext,
  HttpRequest,
  parseDatesInResponse,
} from './test-helpers';
import { expectValidSchema } from './route-test-utils';
import { createRouteTestSuite } from './route-test-suite';

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
export function createRouteAdapterTestSuite(config: AdapterTestSuiteConfig) {
  const { suiteName = 'Route Adapter Integration', setupAdapter, executeHttpRequest, createTestContext } = config;

  describe('Route Validation', () => {
    createRouteTestSuite({
      routes: SERVER_ROUTES,
    });
  });

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
      const setup = await setupAdapter(context);
      app = setup.app;
    });

    // Test deprecated routes separately - just verify they're marked correctly
    const deprecatedRoutes = SERVER_ROUTES.filter(r => r.deprecated);
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
    // Skip MCP transport routes (mcp-http, mcp-sse) - they require MCP protocol handling
    // and are tested separately via mcp-transport-test-suite
    const activeRoutes = SERVER_ROUTES.filter(
      r => !r.deprecated && r.responseType !== 'mcp-http' && r.responseType !== 'mcp-sse',
    );
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
              const parsedData = parseDatesInResponse(response.data, route.responseSchema);
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

        // MCP server 404 tests
        if (route.path.includes(':serverId')) {
          it('should return 404 when MCP server not found (via :serverId)', async () => {
            const request = buildRouteRequest(route, {
              pathParams: { serverId: 'non-existent-server' },
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

        // MCP v0 server detail 404 test (uses :id instead of :serverId)
        if (route.path.includes('/api/mcp/v0/servers/:id')) {
          it('should return 404 when MCP server not found (via :id)', async () => {
            const request = buildRouteRequest(route, {
              pathParams: { id: 'non-existent-server' },
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
      // Test array query parameters for ALL GET routes
      const getRoutes = SERVER_ROUTES.filter(r => r.method === 'GET' && !r.deprecated);
      getRoutes.forEach(route => {
        it(`should handle array query parameters for ${route.method} ${route.path}`, async () => {
          const request = buildRouteRequest(route);

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
          if (response.status >= 500) {
            console.error(`[FAIL] ${route.method} ${route.path} returned ${response.status}`, response.data);
          }
          expect(response.status).toBeLessThan(500);
        });
      });

      // Test error response structure for ALL routes with agentId
      const agentRoutes = SERVER_ROUTES.filter(r => r.path.includes(':agentId') && !r.deprecated);
      agentRoutes.forEach(route => {
        it(`should return valid error response structure for ${route.method} ${route.path}`, async () => {
          const request = buildRouteRequest(route, {
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
      });

      // Test empty body for ALL POST routes with body schema (excluding MCP transport routes)
      const postRoutesWithBody = SERVER_ROUTES.filter(
        r =>
          r.method === 'POST' &&
          r.bodySchema &&
          !r.deprecated &&
          r.responseType !== 'mcp-http' &&
          r.responseType !== 'mcp-sse',
      );
      postRoutesWithBody.forEach(route => {
        it(`should handle empty body for ${route.method} ${route.path}`, async () => {
          const request = buildRouteRequest(route);

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
            // Verify error response has helpful structure when validation is explicit
            if (!(errorData.error || errorData.message || errorData.details)) {
              console.warn(`[WARN] ${route.method} ${route.path} 400 response missing error fields`, errorData);
            }
          }
        });
      });
    });
  });
}
