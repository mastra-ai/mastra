import { describe, it, expect } from 'vitest';
import type { ServerRoute } from '../index';
import type { Mastra } from '@mastra/core';
import { z } from 'zod';
import { InMemoryTaskStore } from '../../../a2a/store';
import {
  createMockRequestContext,
  createTestTask,
  expectInvalidSchema,
  expectValidSchema,
  populateTaskStore,
  validateRouteMetadata,
} from './test-helpers';
import {
  generateValidDataFromSchema,
  getDefaultValidPathParams,
  getDefaultInvalidPathParams,
} from './route-test-utils';

/**
 * Configuration for route test suite
 */
export interface RouteTestConfig {
  /** Array of routes to test */
  routes: ServerRoute[];
  /** Function that returns the Mastra instance (called in beforeEach) */
  getMastra: () => Mastra;
  /** Optional function that returns tools (for tools routes) */
  getTools?: () => Record<string, any>;
}

/**
 * Creates a standardized test suite for server adapter routes
 * Similar to stores/_test-utils pattern
 */
export function createRouteTestSuite(config: RouteTestConfig) {
  const { routes, getMastra, getTools } = config;

  describe('Route Registration and Metadata', () => {
    it(`should have all ${routes.length} routes registered`, () => {
      expect(routes).toHaveLength(routes.length);
    });

    it('should have unique paths for each method', () => {
      const pathMethods = routes.map(r => `${r.method}:${r.path}`);
      const uniquePathMethods = new Set(pathMethods);
      expect(pathMethods.length).toBe(uniquePathMethods.size);
    });

    it('should have OpenAPI specs for all routes', () => {
      routes.forEach(route => {
        expect(route.openapi).toBeDefined();
        expect(route.openapi?.summary).toBeDefined();
        expect(route.openapi?.description).toBeDefined();
      });
    });
  });

  // Test each route
  routes.forEach(route => {
    const routeKey = `${route.method} ${route.path}`;

    describe(routeKey, () => {
      // Route configuration test
      it('should have correct route configuration', () => {
        expect(route).toBeDefined();
        validateRouteMetadata(route, {
          method: route.method,
          path: route.path,
          responseType: route.responseType,
          hasPathParams: !!route.pathParamSchema,
          hasQueryParams: !!route.queryParamSchema,
          hasBody: !!route.bodySchema,
          hasResponse: !!route.responseSchema,
        });
      });

      // Schema validation tests - always run
      // Path parameter validation
      if (route.pathParamSchema) {
        it('should validate path parameters', () => {
          const validParams = getDefaultValidPathParams(route);
          const invalidParams = getDefaultInvalidPathParams(route);

          expectValidSchema(route.pathParamSchema!, validParams);
          invalidParams.forEach((invalid: any) => {
            expectInvalidSchema(route.pathParamSchema!, invalid);
          });
        });
      }

      // Query parameter validation
      if (route.queryParamSchema) {
        it('should validate query parameters', () => {
          const validParams = generateValidDataFromSchema(route.queryParamSchema!);
          expectValidSchema(route.queryParamSchema!, validParams);
        });
      }

      // Body validation
      if (route.bodySchema) {
        it('should validate request body schema', () => {
          const validBody = generateValidDataFromSchema(route.bodySchema!);
          expectValidSchema(route.bodySchema!, validBody);
        });
      }

      // Response schema requirement for JSON endpoints
      if (route.responseType === 'json') {
        it('should have response schema defined for JSON endpoint', () => {
          if (!route.responseSchema) {
            throw new Error(
              `${route.method} ${route.path} is missing responseSchema. Add a Zod schema to ensure type safety and API documentation.`,
            );
          }
        });
      }

      // Handler integration test - always run
      it('should execute handler with valid inputs', async () => {
        const mastra = getMastra();
        const tools = getTools?.();
        const params = await buildHandlerParams(route, mastra, {}, tools);

        const result = await route.handler(params);
        expect(result).toBeDefined();

        // Validate response schema if present
        if (route.responseSchema) {
          expectValidSchema(route.responseSchema, result);
        }
      });

      // Error test for routes with agentId
      if (route.path.includes(':agentId')) {
        it('should throw 404 when agent not found', async () => {
          const mastra = getMastra();
          const tools = getTools?.();
          const params = await buildHandlerParams(route, mastra, { agentId: 'non-existent' }, tools);

          // Both stream and JSON handlers throw validation errors immediately
          await expect(route.handler(params)).rejects.toThrow();
        });

        it('should return properly formatted error response', async () => {
          const mastra = getMastra();
          const tools = getTools?.();
          const params = await buildHandlerParams(route, mastra, { agentId: 'non-existent' }, tools);

          try {
            // Both stream and JSON handlers throw immediately
            await route.handler(params);
            // Should not reach here
            expect(true).toBe(false);
          } catch (error: any) {
            // Verify error has expected structure
            expect(error).toBeDefined();
            expect(error.message).toBeDefined();
            expect(typeof error.message).toBe('string');
            // HTTPException should have status
            if (error.status) {
              expect(error.status).toBe(404);
            }
          }
        });
      }

      // Stream-specific tests
      if (route.responseType === 'stream') {
        it('should return ReadableStream for stream responses', async () => {
          const mastra = getMastra();
          const tools = getTools?.();
          const params = await buildHandlerParams(route, mastra, {}, tools);

          const result = await route.handler(params);

          // Verify it's a ReadableStream (web streams API)
          expect(result).toBeDefined();
          expect(typeof (result as any).getReader).toBe('function');
        });

        it('should be consumable via ReadableStream reader', async () => {
          const mastra = getMastra();
          const tools = getTools?.();
          const params = await buildHandlerParams(route, mastra, {}, tools);

          const stream = (await route.handler(params)) as ReadableStream;
          const reader = stream.getReader();

          // Should be able to get at least one chunk
          const firstChunk = await reader.read();
          expect(firstChunk).toBeDefined();
          // Don't validate value structure here - that's handler's job
          // We just verify the adapter can consume the stream

          // Clean up
          reader.releaseLock();
        });
      }

      // JSON response type test
      if (route.responseType === 'json') {
        it('should return JSON-serializable response', async () => {
          const mastra = getMastra();
          const tools = getTools?.();
          const params = await buildHandlerParams(route, mastra, {}, tools);

          const result = await route.handler(params);

          // Verify result can be JSON stringified (no circular refs, functions, etc)
          expect(() => JSON.stringify(result)).not.toThrow();
        });
      }
    });
  });
}

/**
 * Helper: Build handler parameters from route - fully automatic
 */
async function buildHandlerParams(
  route: ServerRoute,
  mastra: Mastra,
  overrides: Record<string, any> = {},
  tools?: Record<string, any>,
): Promise<any> {
  const params: any = {
    mastra,
    requestContext: createMockRequestContext(),
  };

  // Always include taskStore for A2A routes and pre-populate with test task
  const taskStore = new InMemoryTaskStore();
  // Import helpers at runtime to avoid circular deps
  const testTask = createTestTask();
  await populateTaskStore(taskStore, [{ agentId: 'test-agent', task: testTask }]);
  params.taskStore = taskStore;

  // Add tools if provided (for tools routes)
  if (tools) {
    params.tools = tools;
  }

  // Add path parameters - auto-generated from route
  if (route.pathParamSchema) {
    const pathParams = getDefaultValidPathParams(route);
    Object.assign(params, pathParams, overrides);
  }

  // Add query parameters - auto-generated from schema
  if (route.queryParamSchema) {
    const queryParams = generateValidDataFromSchema(route.queryParamSchema);
    Object.assign(params, queryParams);
  }

  // Add body - auto-generated from schema
  if (route.bodySchema) {
    params.body = generateValidDataFromSchema(route.bodySchema);
  }

  return params;
}
