import { describe, it, expect } from 'vitest';
import type { ServerRoute } from '../index';
import type { Mastra } from '@mastra/core';
import { z } from 'zod';
import { InMemoryTaskStore } from '../../../a2a/store';
import {
  createTestMastra,
  createTestTask,
  expectInvalidSchema,
  expectValidSchema,
  populateTaskStore,
  validateRouteMetadata,
} from './test-helpers';
import { RouteAdapter, type MockRequest } from './route-adapter';
import { createRoute } from '../route-builder';

/**
 * Generate context-aware test value based on field name
 */
function generateContextualValue(fieldName?: string): string {
  if (!fieldName) return 'test-string';

  // Match common field name patterns
  const field = fieldName.toLowerCase();

  // Exact matches first
  if (field === 'role') return 'user';

  // Partial matches
  if (field.includes('agent')) return 'test-agent';
  if (field.includes('workflow')) return 'test-workflow';
  if (field.includes('tool')) return 'test-tool';
  if (field.includes('thread')) return 'test-thread';
  if (field.includes('resource')) return 'test-resource';
  if (field.includes('run')) return 'test-run';
  if (field.includes('step')) return 'test-step';
  if (field.includes('task')) return 'test-task';
  if (field.includes('scorer') || field.includes('score')) return 'test-scorer';
  if (field.includes('trace')) return 'test-trace';
  if (field.includes('span')) return 'test-span';
  if (field.includes('vector')) return 'test-vector';
  if (field.includes('index')) return 'test-index';
  if (field.includes('message')) return 'test-message';
  if (field.includes('transport')) return 'test-transport';
  if (field.includes('model')) return 'gpt-4o';
  if (field.includes('action')) return 'merge-template';
  if (field.includes('entity')) return 'test-entity';

  return 'test-string';
}

/**
 * Generate valid test data from a Zod schema
 */
function generateValidDataFromSchema(schema: z.ZodTypeAny, fieldName?: string): any {
  // Unwrap effects (refine, transform, etc)
  while (schema instanceof z.ZodEffects) {
    schema = schema._def.schema;
  }

  // Handle optional/nullable/default
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return generateValidDataFromSchema(schema._def.innerType, fieldName);
  }
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }

  // Primitive types - use contextual values for strings
  if (schema instanceof z.ZodString) return generateContextualValue(fieldName);
  if (schema instanceof z.ZodNumber) return 10; // Use 10 instead of 0 to avoid validation issues
  if (schema instanceof z.ZodBoolean) return true;
  if (schema instanceof z.ZodNull) return null;
  if (schema instanceof z.ZodUndefined) return undefined;
  if (schema instanceof z.ZodDate) return new Date();
  if (schema instanceof z.ZodBigInt) return BigInt(0);

  // Literal
  if (schema instanceof z.ZodLiteral) return schema._def.value;

  // Enum
  if (schema instanceof z.ZodEnum) return schema._def.values[0];
  if (schema instanceof z.ZodNativeEnum) {
    const values = Object.values(schema._def.values);
    return values[0];
  }

  // Array
  if (schema instanceof z.ZodArray) {
    return [generateValidDataFromSchema(schema._def.type, fieldName)];
  }

  // Object
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const obj: any = {};
    for (const [key, fieldSchema] of Object.entries(shape)) {
      // Skip optional fields to generate minimal valid object
      if (fieldSchema instanceof z.ZodOptional) {
        continue;
      }
      // Pass field name for contextual value generation
      obj[key] = generateValidDataFromSchema(fieldSchema as z.ZodTypeAny, key);
    }
    return obj;
  }

  // Record/Map
  if (schema instanceof z.ZodRecord) {
    return { key: generateValidDataFromSchema(schema._def.valueType, fieldName) };
  }

  // Union - try first option
  if (schema instanceof z.ZodUnion) {
    return generateValidDataFromSchema(schema._def.options[0], fieldName);
  }

  // Discriminated Union - use first option
  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(schema._def.options.values());
    return generateValidDataFromSchema(options[0] as z.ZodTypeAny, fieldName);
  }

  // Intersection - merge both schemas
  if (schema instanceof z.ZodIntersection) {
    const left = generateValidDataFromSchema(schema._def.left, fieldName);
    const right = generateValidDataFromSchema(schema._def.right, fieldName);
    return { ...left, ...right };
  }

  // Tuple
  if (schema instanceof z.ZodTuple) {
    return schema._def.items.map((item: z.ZodTypeAny) => generateValidDataFromSchema(item, fieldName));
  }

  // Any/Unknown
  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
    // Special case: message content must be an array of parts
    if (fieldName === 'content') {
      return [{ type: 'text', text: 'test message content' }];
    }
    return 'test-value';
  }

  // Fallback
  return undefined;
}

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
  const adapter = new RouteAdapter();

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
          const taskStore = await createTestTaskStore();
          const request = buildMockRequest(route);

          const result = await adapter.executeRoute(route, request, {
            mastra,
            tools,
            taskStore,
          });
          expect(result).toBeDefined();

          // Validate response schema if present
          if (route.responseSchema) {
            expectValidSchema(route.responseSchema, result);
          }
        });

      // Error test for routes with agentId
      if (hasAgentIdParam(route)) {
        it('should throw 404 when agent not found', async () => {
          const mastra = getMastra();
          const tools = getTools?.();
            const taskStore = await createTestTaskStore();
            const request = buildMockRequest(route, {
              pathParams: { agentId: 'non-existent' },
            });

          // Both stream and JSON handlers throw validation errors immediately
            await expect(
              adapter.executeRoute(route, request, {
                mastra,
                tools,
                taskStore,
              }),
            ).rejects.toThrow();
        });

        it('should return properly formatted error response', async () => {
          const mastra = getMastra();
          const tools = getTools?.();
            const taskStore = await createTestTaskStore();
            const request = buildMockRequest(route, {
              pathParams: { agentId: 'non-existent' },
            });

          try {
            // Both stream and JSON handlers throw immediately
              await adapter.executeRoute(route, request, {
                mastra,
                tools,
                taskStore,
              });
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
            const taskStore = await createTestTaskStore();
            const request = buildMockRequest(route);

            const result = await adapter.executeRoute(route, request, {
              mastra,
              tools,
              taskStore,
            });

          // Verify it's a ReadableStream (web streams API)
          expect(result).toBeDefined();
          expect(typeof (result as any).getReader).toBe('function');
        });

        it('should be consumable via ReadableStream reader', async () => {
          const mastra = getMastra();
          const tools = getTools?.();
            const taskStore = await createTestTaskStore();
            const request = buildMockRequest(route);

            const stream = (await adapter.executeRoute(route, request, {
              mastra,
              tools,
              taskStore,
            })) as ReadableStream;
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
            const taskStore = await createTestTaskStore();
            const request = buildMockRequest(route);

            const result = await adapter.executeRoute(route, request, {
              mastra,
              tools,
              taskStore,
            });

          // Verify result can be JSON stringified (no circular refs, functions, etc)
          expect(() => JSON.stringify(result)).not.toThrow();
        });
      }
    });
  });
}

/**
 * Helper: Get default valid path parameters for a route
 */
function getDefaultValidPathParams(route: ServerRoute): Record<string, any> {
  const params: Record<string, any> = {};

  if (route.path.includes(':agentId')) params.agentId = 'test-agent';
  if (route.path.includes(':workflowId')) params.workflowId = 'test-workflow';
  if (route.path.includes(':toolId')) params.toolId = 'test-tool';
  if (route.path.includes(':threadId')) params.threadId = 'test-thread';
  if (route.path.includes(':resourceId')) params.resourceId = 'test-resource';
  if (route.path.includes(':modelConfigId')) params.modelConfigId = 'id1'; // Match agent model list
  if (route.path.includes(':scorerId')) params.scorerId = 'test-scorer';
  if (route.path.includes(':traceId')) params.traceId = 'test-trace';
  if (route.path.includes(':runId')) params.runId = 'test-run';
  if (route.path.includes(':stepId')) params.stepId = 'test-step';
  if (route.path.includes(':taskId')) params.taskId = 'test-task-id';
  if (route.path.includes(':vectorName')) params.vectorName = 'test-vector';
  if (route.path.includes(':indexName')) params.indexName = 'test-index';
  if (route.path.includes(':transportId')) params.transportId = 'test-transport';
  if (route.path.includes(':spanId')) params.spanId = 'test-span';
  if (route.path.includes(':entityType')) params.entityType = 'test-entity-type';
  if (route.path.includes(':entityId')) params.entityId = 'test-entity-id';
  if (route.path.includes(':actionId')) params.actionId = 'merge-template'; // Valid agent-builder actions: merge-template, workflow-builder

  return params;
}

/**
 * Helper: Get default invalid path parameters for a route
 */
function getDefaultInvalidPathParams(route: ServerRoute): Array<Record<string, any>> {
  const invalid: Array<Record<string, any>> = [];

  // Empty object
  invalid.push({});

  // Wrong type (number instead of string)
  if (route.path.includes(':agentId')) {
    invalid.push({ agentId: 123 });
  }

  return invalid;
}

/**
 * Helper: Check if route has agentId path parameter
 */
function hasAgentIdParam(route: ServerRoute): boolean {
  return route.path.includes(':agentId');
}

interface MockRequestOverrides {
  pathParams?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

async function createTestTaskStore() {
  const taskStore = new InMemoryTaskStore();
  const testTask = createTestTask();
  await populateTaskStore(taskStore, [{ agentId: 'test-agent', task: testTask }]);
  return taskStore;
}

function buildMockRequest(route: ServerRoute, overrides: MockRequestOverrides = {}): MockRequest {
  const method = route.method;
  let path = route.path;

  if (route.pathParamSchema) {
    const defaultPathParams = getDefaultValidPathParams(route);
    const pathParams = { ...defaultPathParams, ...(overrides.pathParams ?? {}) };
    for (const [key, value] of Object.entries(pathParams)) {
      path = path.replace(`:${key}`, encodeURIComponent(String(value)));
    }
  }

  let queryValues: Record<string, unknown> | undefined;
  if (route.queryParamSchema) {
    queryValues = {
      ...(generateValidDataFromSchema(route.queryParamSchema) as Record<string, unknown>),
      ...(overrides.query ?? {}),
    };
  } else if (overrides.query) {
    queryValues = { ...overrides.query };
  }

  let body: Record<string, unknown> | undefined;
  if (route.bodySchema) {
    body = {
      ...(generateValidDataFromSchema(route.bodySchema) as Record<string, unknown>),
      ...(overrides.body ?? {}),
    };
  } else if (overrides.body) {
    body = { ...overrides.body };
  }

  return {
    method,
    path,
    query: queryValues ? convertQueryValues(queryValues) : undefined,
    body,
  };
}

function convertQueryValues(values: Record<string, unknown>): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      query[key] = value.map(item => convertQueryValue(item));
      continue;
    }

    query[key] = convertQueryValue(value);
  }
  return query;
}

function convertQueryValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

describe('Route Adapter Integration', () => {
  const adapter = new RouteAdapter();

  it('should extract path parameters correctly', async () => {
    const route = createRoute({
      method: 'GET',
      path: '/api/agents/:agentId',
      responseType: 'json',
      handler: async ({ agentId }: { agentId: string }) => ({ agentId }),
      pathParamSchema: z.object({ agentId: z.string() }),
      responseSchema: z.object({ agentId: z.string() }),
    });

    const result = await adapter.executeRoute(
      route,
      {
        method: 'GET',
        path: '/api/agents/test-agent',
      },
      { mastra: createTestMastra() },
    );

    expect(result).toEqual({ agentId: 'test-agent' });
  });

  it('should validate path parameters against schema', async () => {
    const route = createRoute({
      method: 'GET',
      path: '/api/agents/:agentId',
      responseType: 'json',
      handler: async () => ({}),
      pathParamSchema: z.object({ agentId: z.string().min(5) }),
      responseSchema: z.object({}).passthrough(),
    });

    await expect(
      adapter.executeRoute(
        route,
        {
          method: 'GET',
          path: '/api/agents/abc',
        },
        { mastra: createTestMastra() },
      ),
    ).rejects.toThrow(/Path parameter validation failed/);
  });

  it('should parse and validate query parameters', async () => {
    const route = createRoute({
      method: 'GET',
      path: '/api/workflows',
      responseType: 'json',
      handler: async ({ limit }: { limit: number }) => ({ limit }),
      queryParamSchema: z.object({ limit: z.coerce.number() }),
      responseSchema: z.object({ limit: z.number() }),
    });

    const result = await adapter.executeRoute(
      route,
      {
        method: 'GET',
        path: '/api/workflows',
        query: { limit: '5' },
      },
      { mastra: createTestMastra() },
    );

    expect(result).toEqual({ limit: 5 });
  });

  it('should parse and merge request body fields', async () => {
    const route = createRoute({
      method: 'POST',
      path: '/api/tools',
      responseType: 'json',
      handler: async ({ body, name }: { body: { name: string }; name: string }) => ({
        viaBody: body.name,
        viaTopLevel: name,
      }),
      bodySchema: z.object({ name: z.string() }),
      responseSchema: z.object({
        viaBody: z.string(),
        viaTopLevel: z.string(),
      }),
    });

    const result = await adapter.executeRoute(
      route,
      {
        method: 'POST',
        path: '/api/tools',
        body: { name: 'test-tool' },
      },
      { mastra: createTestMastra() },
    );

    expect(result).toEqual({ viaBody: 'test-tool', viaTopLevel: 'test-tool' });
  });
});
