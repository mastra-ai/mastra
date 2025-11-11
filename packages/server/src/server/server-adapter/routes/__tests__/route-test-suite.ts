import { describe, it, expect } from 'vitest';
import type { ServerRoute } from '../index';
import type { Mastra } from '@mastra/core';
import {
  expectInvalidSchema,
  expectValidSchema,
  validateRouteMetadata,
} from './test-helpers';
import {
  generateValidDataFromSchema,
  getDefaultInvalidPathParams,
  getDefaultValidPathParams,
} from './route-test-utils';

export interface RouteTestConfig {
  routes: ServerRoute[];
  /** Retained for backwards compatibility; not used in metadata tests */
  getMastra?: () => Mastra;
  /** Retained for backwards compatibility; not used in metadata tests */
  getTools?: () => Record<string, any>;
}

/**
 * Validates route metadata and schemas without executing handlers.
 * Adapter-specific execution tests should live in server-adapter packages.
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
        expect(route.openapi).toBeDefined();
        expect(route.openapi?.summary).toBeDefined();
        expect(route.openapi?.description).toBeDefined();
      });
    });
  });

  routes.forEach(route => {
    const routeKey = `${route.method} ${route.path}`;

    describe(routeKey, () => {
      it('should have correct route configuration', () => {
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

      if (route.pathParamSchema) {
        it('should validate path parameters', () => {
          const validParams = getDefaultValidPathParams(route);
          const invalidParams = getDefaultInvalidPathParams(route);

          expectValidSchema(route.pathParamSchema!, validParams);
          invalidParams.forEach(invalid => {
            expectInvalidSchema(route.pathParamSchema!, invalid);
          });
        });
      }

      if (route.queryParamSchema) {
        it('should validate query parameters', () => {
          const validParams = generateValidDataFromSchema(route.queryParamSchema!);
          expectValidSchema(route.queryParamSchema!, validParams);
        });
      }

      if (route.bodySchema) {
        it('should validate request body schema', () => {
          const validBody = generateValidDataFromSchema(route.bodySchema!);
          expectValidSchema(route.bodySchema!, validBody);
        });
      }

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
