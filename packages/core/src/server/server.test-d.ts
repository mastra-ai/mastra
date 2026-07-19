import type { HonoRequest } from 'hono';
import { describe, expectTypeOf, it } from 'vitest';
import { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';
import type { IMastraAuthProvider, MastraAuthProvider } from './auth';
import { CompositeAuth } from './composite-auth';
import type { MastraAuthRequest } from './request-types';
import { SimpleAuth } from './simple-auth';
import { registerApiRoute } from './index';
import type { Middleware } from './index';

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

    it('should avoid leaking Hono context types from createHandler', () => {
      registerApiRoute('/user-profile', {
        method: 'GET',
        createHandler: async () => {
          return async c => {
            expectTypeOf(c).toBeAny();

            return c.json({ ok: true });
          };
        },
      });
    });

    it('types the createHandler factory arg as { mastra }, not a Hono Context', () => {
      registerApiRoute('/factory', {
        method: 'GET',
        createHandler: async ({ mastra }) => {
          // adapter calls this as route.createHandler({ mastra }), so mastra
          // should be the Mastra instance, not a Hono Context
          expectTypeOf(mastra).toEqualTypeOf<Mastra>();

          return async c => c.json({ ok: true });
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

/**
 * Regression tests for Issue #18682: provider packages (e.g. @mastra/auth-workos)
 * bundle their own copy of the MastraAuthProvider declaration, so provider
 * instances cannot be compared nominally across package boundaries. Positions
 * that accept user-supplied providers must be typed against the structural
 * IMastraAuthProvider interface instead of the branded class.
 */
describe('IMastraAuthProvider structural boundary (#18682)', () => {
  it('MastraAuthProvider instances are assignable to IMastraAuthProvider', () => {
    const provider = new SimpleAuth({ tokens: { example: { sub: '1' } } });

    const _iface: IMastraAuthProvider = provider;
    const _ifaceAny: IMastraAuthProvider<any> = provider;
    const _classToIface: IMastraAuthProvider<{ sub: string }> = provider as MastraAuthProvider<{ sub: string }>;
    new CompositeAuth([provider]);
    new Mastra({ server: { auth: provider } });
  });

  it('a bundled duplicate copy of the provider class stays assignable to IMastraAuthProvider', () => {
    // Simulates the copy of MastraAuthProvider/MastraBase that provider
    // packages ship in their own dist: same public surface, but distinct
    // nominal #private/protected members. If IMastraAuthProvider ever gains
    // a member that re-introduces nominal checking, this assignment breaks.
    class BundledCopyProvider<TUser = unknown> {
      #rawConfig?: Record<string, unknown>;
      protected logger: unknown;
      component = 'AUTH';
      name?: string;
      public protected?: IMastraAuthProvider['protected'];
      public public?: IMastraAuthProvider['public'];

      constructor() {
        this.logger = undefined;
      }

      toRawConfig(): Record<string, unknown> | undefined {
        return this.#rawConfig;
      }

      async authenticateToken(_token: string, _request: MastraAuthRequest): Promise<TUser | null> {
        return null;
      }

      async authorizeUser(_user: TUser, _request: MastraAuthRequest): Promise<boolean> {
        return false;
      }

      mapUserToResourceId?(user: TUser): string | undefined | null;

      protected registerOptions(_opts?: unknown): void {}
    }

    const duplicate = new BundledCopyProvider<{ id: string }>();

    const _iface: IMastraAuthProvider<{ id: string }> = duplicate;
    const _ifaceUnknown: IMastraAuthProvider = duplicate;
    new CompositeAuth([duplicate]);
    new Mastra({ server: { auth: duplicate } });
  });
});

describe('Auth request compatibility type tests', () => {
  it('accepts HonoRequest-typed custom auth providers', () => {
    interface CustomUser {
      id: string;
    }

    class HonoAuthProvider extends SimpleAuth<CustomUser> {
      async authenticateToken(token: string, request: HonoRequest): Promise<CustomUser | null> {
        request.header('Cookie');
        return super.authenticateToken(token, request);
      }

      async authorizeUser(user: CustomUser, request: HonoRequest): Promise<boolean> {
        request.header('Authorization');
        return !!user.id;
      }
    }

    const provider = new HonoAuthProvider({ tokens: { example: { id: '1' } } });
    const _assignable: MastraAuthProvider<CustomUser> = provider;

    new Mastra({
      server: {
        auth: {
          authenticateToken: async (_token: string, request: HonoRequest) => {
            request.header('Cookie');
            return { id: '1' };
          },
        },
      },
    });
  });
});

describe('CORS type tests', () => {
  it('accepts global CORS config', () => {
    new Mastra({
      server: {
        cors: {
          origin: ['https://app.example'],
          credentials: true,
        },
      },
    });
  });

  it('accepts route-specific CORS config', () => {
    registerApiRoute('/webhook', {
      method: 'POST',
      handler: async c => c.json({ ok: true }),
      cors: {
        origin: ['https://customer-saas.example'],
        credentials: true,
      },
    });
  });
});

describe('Middleware type exports', () => {
  it('supports middleware declared separately', () => {
    const middleware: Middleware = {
      path: '/api/*',
      handler: async (c, next) => {
        c.req.header('authorization');
        await next();
      },
    };

    expectTypeOf(middleware).toMatchTypeOf<Middleware>();
  });
});
