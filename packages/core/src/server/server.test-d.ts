import { describe, expectTypeOf, it } from 'vitest';
import type { RequestContext } from '../request-context';
import type { MastraAuthProvider } from './auth';
import { CompositeAuth } from './composite-auth';
import { SimpleAuth } from './simple-auth';
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

/**
 * Regression test: CompositeAuth must accept providers whose TUser is narrower
 * than unknown. When mapUserToResourceId is declared in property position on
 * MastraAuthProvider<TUser>, strict contravariance rejects such providers
 * even though the runtime contract is compatible.
 */
describe('CompositeAuth TUser variance', () => {
  it('accepts SimpleAuth providers with a narrower TUser generic', () => {
    interface CustomUser {
      sub: string;
    }

    const typed = new SimpleAuth<CustomUser>({
      tokens: { example: { sub: '1' } },
    });

    const _assignable: MastraAuthProvider<unknown> = typed;
    new CompositeAuth([typed]);
  });
});
