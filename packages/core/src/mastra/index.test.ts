import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { Middleware } from '../server/types';
import { Mastra } from '.';

describe('Mastra.setServerMiddleware', () => {
  let mastra: Mastra;

  // Helper function to set middleware and get normalized result
  const setAndNormalize = (input: Middleware | Middleware[]) => {
    mastra.setServerMiddleware(input);
    const middleware = (mastra as any).getServerMiddleware?.() ?? [];
    return [...middleware];
  };

  // Helper function to verify normalized middleware
  const expectNormalized = (
    normalized: Array<{ handler: any; path: string }>,
    expectedHandlers: any[],
    expectedPathsOrDefault: string | string[],
  ) => {
    expect(normalized).toHaveLength(expectedHandlers.length);
    normalized.forEach((middleware, index) => {
      expect(middleware.handler).toBe(expectedHandlers[index]);
      const expectedPath = Array.isArray(expectedPathsOrDefault)
        ? expectedPathsOrDefault[index]
        : expectedPathsOrDefault;
      expect(middleware.path).toBe(expectedPath);
    });
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mastra = new Mastra();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should wrap a single function with default path', () => {
    // Arrange: Create a middleware function
    const middlewareFunction = async (c: any, next: () => Promise<void>) => {
      await next();
    };

    // Act: Set the middleware and get normalized result
    const normalized = setAndNormalize(middlewareFunction);

    // Assert: Verify the middleware is properly wrapped
    expectNormalized(normalized, [middlewareFunction], '/api/*');
  });

  it('should wrap each function in array with default path', () => {
    // Arrange: Create array of middleware functions
    const middlewareFunctions = [vi.fn(), vi.fn(), vi.fn()];

    // Act: Set middleware and get normalized result
    const normalized = setAndNormalize(middlewareFunctions);

    // Assert: Verify handlers and default paths
    expectNormalized(normalized, middlewareFunctions, '/api/*');
  });

  it('should preserve explicit path for middleware objects that include path', () => {
    // Arrange: Create array of middleware objects with explicit paths
    const customPaths = ['/custom/path1/*', '/custom/path2/*', '/custom/path3/*'];
    const middlewareObjects = customPaths.map(path => ({
      handler: vi.fn(),
      path,
    }));

    // Act: Set middleware and get normalized result
    const normalized = setAndNormalize(middlewareObjects);

    // Assert: Verify handlers and preserved paths
    expectNormalized(
      normalized,
      middlewareObjects.map(m => m.handler),
      customPaths,
    );
  });

  it('should apply default /api/* when middleware object has no path', () => {
    // Arrange: Create array of middleware objects without paths
    const handlers = [vi.fn(), vi.fn(), vi.fn()];
    const middlewareObjects = handlers.map(handler => ({ handler }));

    // Act: Set middleware and get normalized result
    const normalized = setAndNormalize(middlewareObjects);

    // Assert: Verify handlers and default paths
    expectNormalized(normalized, handlers, '/api/*');
  });

  it('should throw MastraError when called with invalid input type', () => {
    // Arrange: Prepare an invalid input (plain object)
    const invalidInput = { foo: 'bar' };

    // Act: Capture the thrown error from a single invocation
    let caught: unknown;
    try {
      mastra.setServerMiddleware(invalidInput as any);
    } catch (e) {
      caught = e;
    }

    // Assert: Verify the error is thrown with correct properties
    expect(caught).toBeInstanceOf(MastraError);
    expect(caught).toMatchObject({
      id: 'MASTRA_SET_SERVER_MIDDLEWARE_INVALID_TYPE',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
    });
  });

  it('should preserve order of middleware in mixed arrays', () => {
    // Arrange: Create a mixed array of middleware with unique handlers
    const handler1 = async (_c: any, next: () => Promise<void>) => {
      await next();
    };
    const handler2 = async (_c: any, next: () => Promise<void>) => {
      await next();
    };
    const handler3 = async (_c: any, next: () => Promise<void>) => {
      await next();
    };

    const mixedMiddleware = [handler1, { handler: handler2, path: '/custom-path' }, handler3];

    // Act: Process the mixed middleware array
    const normalized = setAndNormalize(mixedMiddleware);

    // Assert: Verify order is preserved and paths are correctly set
    expectNormalized(normalized, [handler1, handler2, handler3], ['/api/*', '/custom-path', '/api/*']);
  });

  it('should handle empty arrays without throwing errors', () => {
    // Arrange: Create an empty array
    const emptyMiddleware: Middleware[] = [];

    // Act: Process the empty array
    const normalized = setAndNormalize(emptyMiddleware);

    // Assert: Verify empty array result
    expect(normalized).toEqual([]);
    expect(normalized).toHaveLength(0);
  });
});
