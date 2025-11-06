import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/di';
import type { MastraStorage } from '@mastra/core/storage';
import { vi } from 'vitest';
import type { ServerRoute } from '../index';
import type z from 'zod';
import { HTTPException } from '../../../http-exception';

/**
 * Validate that a value matches a schema
 */
export function expectValidSchema(schema: z.ZodSchema, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(result.error.issues, null, 2)}`);
  }
}

/**
 * Validate that a value does NOT match a schema
 */
export function expectInvalidSchema(schema: z.ZodSchema, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) {
    throw new Error(`Expected schema validation to fail, but it succeeded`);
  }
}

/**
 * Create a mock Mastra instance with optional configuration
 */
export function createMockMastra(
  config: {
    agents?: Record<string, Agent>;
    workflows?: Record<string, any>;
    storage?: MastraStorage;
  } = {},
): Mastra {
  const mockStorage =
    config.storage ||
    ({
      init: vi.fn(),
      __setLogger: vi.fn(),
      getEvalsByAgentName: vi.fn(),
      getStorage: () => ({
        getEvalsByAgentName: vi.fn(),
      }),
    } as unknown as MastraStorage);

  return new Mastra({
    logger: false,
    agents: config.agents || {},
    workflows: config.workflows || {},
    storage: mockStorage,
  });
}

/**
 * Validate that a response matches the route's response schema
 */
export function validateJsonResponse(route: ServerRoute, response: unknown) {
  if (!route.responseSchema) {
    return;
  }

  const result = route.responseSchema.safeParse(response);
  if (!result.success) {
    throw new Error(
      `Response validation failed for ${route.method} ${route.path}: ${JSON.stringify(result.error.issues, null, 2)}`,
    );
  }
}

/**
 * Expect an HTTPException with specific status code and optional message
 */
export function expectHttpException(error: unknown, statusCode: number, message?: string) {
  if (!(error instanceof HTTPException)) {
    throw new Error(`Expected HTTPException but got: ${error}`);
  }

  if (error.status !== statusCode) {
    throw new Error(`Expected status ${statusCode} but got ${error.status}`);
  }

  if (message && !error.message.includes(message)) {
    throw new Error(`Expected error message to contain "${message}" but got "${error.message}"`);
  }
}

/**
 * Create a mock RequestContext
 */
export function createMockRequestContext(context?: Record<string, any>): RequestContext {
  const requestContext = new RequestContext();
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      requestContext.set(key, value);
    });
  }
  return requestContext;
}

/**
 * Validate route metadata
 */
export function validateRouteMetadata(
  route: ServerRoute,
  expected: {
    method?: string;
    path?: string;
    responseType?: 'json' | 'stream';
    hasPathParams?: boolean;
    hasQueryParams?: boolean;
    hasBody?: boolean;
    hasResponse?: boolean;
    hasOpenAPI?: boolean;
  },
) {
  if (expected.method && route.method !== expected.method) {
    throw new Error(`Expected method ${expected.method} but got ${route.method}`);
  }

  if (expected.path && route.path !== expected.path) {
    throw new Error(`Expected path ${expected.path} but got ${route.path}`);
  }

  if (expected.responseType && route.responseType !== expected.responseType) {
    throw new Error(`Expected responseType ${expected.responseType} but got ${route.responseType}`);
  }

  if (expected.hasPathParams !== undefined) {
    const hasPathParams = !!route.pathParamSchema;
    if (hasPathParams !== expected.hasPathParams) {
      throw new Error(
        `Expected pathParamSchema to be ${expected.hasPathParams ? 'defined' : 'undefined'} but got ${hasPathParams ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasQueryParams !== undefined) {
    const hasQueryParams = !!route.queryParamSchema;
    if (hasQueryParams !== expected.hasQueryParams) {
      throw new Error(
        `Expected queryParamSchema to be ${expected.hasQueryParams ? 'defined' : 'undefined'} but got ${hasQueryParams ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasBody !== undefined) {
    const hasBody = !!route.bodySchema;
    if (hasBody !== expected.hasBody) {
      throw new Error(
        `Expected bodySchema to be ${expected.hasBody ? 'defined' : 'undefined'} but got ${hasBody ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasResponse !== undefined) {
    const hasResponse = !!route.responseSchema;
    if (hasResponse !== expected.hasResponse) {
      throw new Error(
        `Expected responseSchema to be ${expected.hasResponse ? 'defined' : 'undefined'} but got ${hasResponse ? 'defined' : 'undefined'}`,
      );
    }
  }

  if (expected.hasOpenAPI !== undefined) {
    const hasOpenAPI = !!route.openapi;
    if (hasOpenAPI !== expected.hasOpenAPI) {
      throw new Error(
        `Expected openapi to be ${expected.hasOpenAPI ? 'defined' : 'undefined'} but got ${hasOpenAPI ? 'defined' : 'undefined'}`,
      );
    }
  }
}

/**
 * Extract path parameters from a path pattern
 * e.g., '/api/agents/:agentId/tools/:toolId' -> ['agentId', 'toolId']
 */
export function extractPathParams(path: string): string[] {
  const matches = path.match(/:(\w+)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1));
}

/**
 * Validate that a route's pathParamSchema matches its path pattern
 */
export function validatePathParamSchema(route: ServerRoute) {
  const pathParams = extractPathParams(route.path);

  if (pathParams.length === 0) {
    if (route.pathParamSchema) {
      throw new Error(`Route ${route.path} has no path params but pathParamSchema is defined`);
    }
    return;
  }

  if (!route.pathParamSchema) {
    throw new Error(`Route ${route.path} has path params ${pathParams.join(', ')} but pathParamSchema is not defined`);
  }

  // Try parsing with all path params set to test strings
  const testParams: Record<string, string> = {};
  pathParams.forEach(param => {
    testParams[param] = `test-${param}`;
  });

  const result = route.pathParamSchema.safeParse(testParams);
  if (!result.success) {
    throw new Error(
      `Path param schema validation failed for ${route.path}: ${JSON.stringify(result.error.issues, null, 2)}`,
    );
  }
}
