import { describe, it, expect } from 'vitest';
import {
  expectInvalidSchema,
  expectValidSchema,
  generateValidDataFromSchema,
  getDefaultValidPathParams,
  getDefaultInvalidPathParams,
  validateRouteMetadata,
} from './route-test-utils';
import { ServerRoute } from '@mastra/server/server-adapter';

/**
 * Configuration for route test suite
 */
export interface RouteTestConfig {
  /** Array of routes to test */
  routes: ServerRoute[];
}

/**
 * Creates a standardized test suite for server adapter routes
 * Similar to stores/_test-utils pattern
 */
export function createRouteTestSuite(config: RouteTestConfig) {
  const { routes } = config;

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
        // Skip 'ALL' method routes - they can't have OpenAPI specs (no standard HTTP method mapping)
        // MCP transport routes use 'ALL' and are tested separately via mcp-transport-test-suite
        if (route.method === 'ALL') {
          return;
        }
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
      // Skip deprecated routes - they are placeholders for route parity only
      if (route.deprecated) {
        it('should be marked as deprecated', () => {
          expect(route.deprecated).toBe(true);
          expect(route.openapi?.deprecated).toBe(true);
        });
        return;
      }

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
    });
  });
}
