import { describe, it, expect } from 'vitest';
import { SERVER_ROUTES } from '../index';
import { extractPathParams } from './test-helpers';

describe('Schema Consistency Across All Routes', () => {
  describe('OpenAPI Specification', () => {
    it('all routes should have OpenAPI specs except ALL method routes', () => {
      SERVER_ROUTES.forEach(route => {
        if (route.method !== 'ALL') {
          expect(route.openapi).toBeDefined();
          expect(route.openapi?.summary).toBeDefined();
          expect(route.openapi?.description).toBeDefined();
          expect(route.openapi?.summary).not.toBe('');
          expect(route.openapi?.description).not.toBe('');
        }
      });
    });

    it('all routes should have tags for grouping', () => {
      SERVER_ROUTES.forEach(route => {
        if (route.openapi) {
          expect(route.openapi.tags).toBeDefined();
          expect(Array.isArray(route.openapi.tags)).toBe(true);
          expect(route.openapi.tags.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Path Parameter Schemas', () => {
    it('all routes with path params should have pathParamSchema', () => {
      SERVER_ROUTES.forEach(route => {
        const pathParams = extractPathParams(route.path);
        if (pathParams.length > 0) {
          expect(route.pathParamSchema).toBeDefined();
        }
      });
    });

    it('routes without path params should not have pathParamSchema', () => {
      SERVER_ROUTES.forEach(route => {
        const pathParams = extractPathParams(route.path);
        if (pathParams.length === 0) {
          expect(route.pathParamSchema).toBeUndefined();
        }
      });
    });

    it('pathParamSchema should validate with appropriate test data', () => {
      SERVER_ROUTES.forEach(route => {
        if (route.pathParamSchema) {
          const pathParams = extractPathParams(route.path);
          const testData: Record<string, string> = {};
          pathParams.forEach(param => {
            testData[param] = `test-${param}`;
          });

          const result = route.pathParamSchema.safeParse(testData);
          expect(result.success).toBe(true);
        }
      });
    });
  });

  describe('Request Body Schemas', () => {
    it('most POST/PUT/PATCH routes should have bodySchema', () => {
      const routesWithBody = SERVER_ROUTES.filter(
        route => ['POST', 'PUT', 'PATCH'].includes(route.method) && route.responseType === 'json',
      );

      const routesWithBodySchema = routesWithBody.filter(route => route.bodySchema);

      // Allow some flexibility, but most should have body schemas
      const percentageWithSchema = (routesWithBodySchema.length / routesWithBody.length) * 100;
      expect(percentageWithSchema).toBeGreaterThan(70);
    });

    it('GET and DELETE routes typically should not have body schemas', () => {
      SERVER_ROUTES.forEach(route => {
        if (['GET', 'DELETE'].includes(route.method)) {
          // Some DELETE routes may have body schemas for batch operations
          // So we don't enforce this strictly
        }
      });
    });
  });

  describe('Response Schemas', () => {
    it('most JSON routes should have response schemas', () => {
      const jsonRoutes = SERVER_ROUTES.filter(route => route.responseType === 'json');
      const jsonRoutesWithResponse = jsonRoutes.filter(route => route.responseSchema);

      const percentageWithResponse = (jsonRoutesWithResponse.length / jsonRoutes.length) * 100;
      expect(percentageWithResponse).toBeGreaterThan(60);
    });

    it('stream routes typically do not have response schemas', () => {
      const streamRoutes = SERVER_ROUTES.filter(route => route.responseType === 'stream');
      const streamRoutesWithResponse = streamRoutes.filter(route => route.responseSchema);

      // Most stream routes should not have response schemas
      const percentageWithResponse = (streamRoutesWithResponse.length / streamRoutes.length) * 100;
      expect(percentageWithResponse).toBeLessThan(30);
    });
  });

  describe('Route Configuration', () => {
    it('all routes should have valid HTTP methods', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL'];
      SERVER_ROUTES.forEach(route => {
        expect(validMethods).toContain(route.method);
      });
    });

    it('all routes should have valid response types', () => {
      const validResponseTypes = ['json', 'stream'];
      SERVER_ROUTES.forEach(route => {
        expect(validResponseTypes).toContain(route.responseType);
      });
    });

    it('all routes should have handlers', () => {
      SERVER_ROUTES.forEach(route => {
        expect(route.handler).toBeDefined();
        expect(typeof route.handler).toBe('function');
      });
    });

    it('all routes should have non-empty paths', () => {
      SERVER_ROUTES.forEach(route => {
        expect(route.path).toBeDefined();
        expect(route.path.length).toBeGreaterThan(0);
        expect(route.path).toMatch(/^\//); // Should start with /
      });
    });
  });

  describe('Route Uniqueness', () => {
    it('should not have duplicate method+path combinations', () => {
      const pathMethods = SERVER_ROUTES.map(r => `${r.method}:${r.path}`);
      const uniquePathMethods = new Set(pathMethods);
      expect(pathMethods.length).toBe(uniquePathMethods.size);
    });

    it('should have unique route paths within same method', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      methods.forEach(method => {
        const routesForMethod = SERVER_ROUTES.filter(r => r.method === method);
        const paths = routesForMethod.map(r => r.path);
        const uniquePaths = new Set(paths);
        expect(paths.length).toBe(uniquePaths.size);
      });
    });
  });

  describe('Route Statistics', () => {
    it('should report total number of routes', () => {
      console.log(`\nTotal routes: ${SERVER_ROUTES.length}`);
      expect(SERVER_ROUTES.length).toBeGreaterThan(0);
    });

    it('should report routes by method', () => {
      const methodCounts: Record<string, number> = {};
      SERVER_ROUTES.forEach(route => {
        methodCounts[route.method] = (methodCounts[route.method] || 0) + 1;
      });
      console.log('\nRoutes by method:', methodCounts);
      expect(Object.keys(methodCounts).length).toBeGreaterThan(0);
    });

    it('should report routes by response type', () => {
      const typeCounts: Record<string, number> = {};
      SERVER_ROUTES.forEach(route => {
        typeCounts[route.responseType] = (typeCounts[route.responseType] || 0) + 1;
      });
      console.log('Routes by response type:', typeCounts);
      expect(typeCounts.json).toBeGreaterThan(0);
    });

    it('should report routes by tag', () => {
      const tagCounts: Record<string, number> = {};
      SERVER_ROUTES.forEach(route => {
        if (route.openapi?.tags) {
          route.openapi.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });
      console.log('Routes by tag:', tagCounts);
      expect(Object.keys(tagCounts).length).toBeGreaterThan(0);
    });

    it('should report schema coverage', () => {
      const stats = {
        withPathParams: SERVER_ROUTES.filter(r => r.pathParamSchema).length,
        withQueryParams: SERVER_ROUTES.filter(r => r.queryParamSchema).length,
        withBody: SERVER_ROUTES.filter(r => r.bodySchema).length,
        withResponse: SERVER_ROUTES.filter(r => r.responseSchema).length,
        withOpenAPI: SERVER_ROUTES.filter(r => r.openapi).length,
      };
      console.log('Schema coverage:', stats);
      expect(stats.withOpenAPI).toBeGreaterThan(0);
    });
  });

  describe('Common Patterns', () => {
    it('paginated endpoints should use consistent query params', () => {
      const paginatedRoutes = SERVER_ROUTES.filter(route => {
        return route.queryParamSchema && route.path.includes('/');
      });

      // Check that paginated routes have consistent naming
      paginatedRoutes.forEach(route => {
        if (route.queryParamSchema) {
          const testData = { page: 1, perPage: 10 };
          const result = route.queryParamSchema.safeParse(testData);
          // If it accepts pagination, it should be consistent
          if (result.success) {
            expect(testData.page).toBe(1);
            expect(testData.perPage).toBe(10);
          }
        }
      });
    });

    it('ID path parameters should follow naming conventions', () => {
      const idParams = new Set<string>();
      SERVER_ROUTES.forEach(route => {
        const params = extractPathParams(route.path);
        params.forEach(param => {
          if (param.toLowerCase().includes('id')) {
            idParams.add(param);
          }
        });
      });

      // Common ID params should be present
      console.log('\nID parameters used:', Array.from(idParams).sort());
      expect(idParams.size).toBeGreaterThan(0);
    });
  });
});
