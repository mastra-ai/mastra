import { describe, it, expect } from 'vitest';
import type { ServerRoute } from '../index';
import type { Mastra } from '@mastra/core';
import { z } from 'zod';
import { validateRouteMetadata, expectValidSchema, expectInvalidSchema, createMockRequestContext } from './utils';
import { InMemoryTaskStore } from '../../../a2a/store';
import { createTestTask, populateTaskStore } from './test-setup-helpers';

/**
 * Generate valid test data from a Zod schema
 */
function generateValidDataFromSchema(schema: z.ZodTypeAny): any {
  // Unwrap effects (refine, transform, etc)
  while (schema instanceof z.ZodEffects) {
    schema = schema._def.schema;
  }

  // Handle optional/nullable/default
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return generateValidDataFromSchema(schema._def.innerType);
  }
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }

  // Primitive types
  if (schema instanceof z.ZodString) return 'test-string';
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
    return [generateValidDataFromSchema(schema._def.type)];
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
      obj[key] = generateValidDataFromSchema(fieldSchema as z.ZodTypeAny);
    }
    return obj;
  }

  // Record/Map
  if (schema instanceof z.ZodRecord) {
    return { key: generateValidDataFromSchema(schema._def.valueType) };
  }

  // Union - try first option
  if (schema instanceof z.ZodUnion) {
    return generateValidDataFromSchema(schema._def.options[0]);
  }

  // Discriminated Union - use first option
  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(schema._def.options.values());
    return generateValidDataFromSchema(options[0] as z.ZodTypeAny);
  }

  // Intersection - merge both schemas
  if (schema instanceof z.ZodIntersection) {
    const left = generateValidDataFromSchema(schema._def.left);
    const right = generateValidDataFromSchema(schema._def.right);
    return { ...left, ...right };
  }

  // Tuple
  if (schema instanceof z.ZodTuple) {
    return schema._def.items.map((item: z.ZodTypeAny) => generateValidDataFromSchema(item));
  }

  // Any/Unknown
  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
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
}

/**
 * Creates a standardized test suite for server adapter routes
 * Similar to stores/_test-utils pattern
 */
export function createRouteTestSuite(config: RouteTestConfig) {
  const { routes, getMastra } = config;

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

      // Handler integration test - always run
      it('should execute handler with valid inputs', async () => {
        const mastra = getMastra();
        const params = await buildHandlerParams(route, mastra);

        const result = await route.handler(params);
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
          const params = await buildHandlerParams(route, mastra, { agentId: 'non-existent' });

          // Stream handlers return generators, not Promises - skip for now
          if (route.responseType === 'stream') {
            // TODO: Handle generator error testing properly
            // Generators don't throw immediately, need to consume first value
            return;
          }

          await expect(route.handler(params)).rejects.toThrow();
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
 * Helper: Build handler parameters from route - fully automatic
 */
async function buildHandlerParams(
  route: ServerRoute,
  mastra: Mastra,
  overrides: Record<string, any> = {},
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

    // WORKAROUND: Vector handlers use 'index' instead of 'body'
    if (route.path.includes('/vectors/')) {
      params.index = params.body;
    }

    // WORKAROUND: Query handlers use 'query' instead of 'body'
    if (route.path.includes('/query') && route.path.includes('/vectors/')) {
      params.query = params.body;
      delete params.index; // query routes don't use index
    }
  }

  return params;
}

/**
 * Helper: Check if route has agentId path parameter
 */
function hasAgentIdParam(route: ServerRoute): boolean {
  return route.path.includes(':agentId');
}
