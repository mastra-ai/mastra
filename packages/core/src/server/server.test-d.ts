import { describe, expectTypeOf, it } from 'vitest';
import type { RequestContext } from '../request-context';
import { registerApiRoute } from './index';

/**
 * Type tests for registerApiRoute
 *
 * Regression tests for Issue #12401: requestContext is not available in Custom API Routes
 * https://github.com/mastra-ai/mastra/issues/12401
 *
 * These tests ensure that requestContext is properly typed in custom API route handlers.
 */
describe('registerApiRoute Type Tests', () => {
  describe('Issue #12401: requestContext should be available in handler context', () => {
    it('should allow accessing requestContext from handler context', () => {
      registerApiRoute('/user-profile', {
        method: 'GET',
        handler: async c => {
          // This should work according to the documentation
          // The server sets requestContext in the context at runtime
          const requestContext = c.get('requestContext');

          // requestContext should be typed as RequestContext, not unknown
          expectTypeOf(requestContext).toEqualTypeOf<RequestContext>();

          // Should be able to get user from requestContext
          const user = requestContext.get('user');
          expectTypeOf(user).toEqualTypeOf<unknown>();

          return c.json({ user });
        },
      });
    });

    it('should allow accessing mastra from handler context', () => {
      registerApiRoute('/test', {
        method: 'GET',
        handler: async c => {
          // mastra should be available (this already works)
          const mastra = c.get('mastra');
          expectTypeOf(mastra).not.toBeUnknown();

          return c.json({ ok: true });
        },
      });
    });

    it('should allow accessing requestContext in createHandler', () => {
      registerApiRoute('/user-profile', {
        method: 'GET',
        createHandler: async () => {
          return async c => {
            // requestContext should also be typed in createHandler's returned handler
            const requestContext = c.get('requestContext');
            expectTypeOf(requestContext).toEqualTypeOf<RequestContext>();

            return c.json({ ok: true });
          };
        },
      });
    });
  });
});
