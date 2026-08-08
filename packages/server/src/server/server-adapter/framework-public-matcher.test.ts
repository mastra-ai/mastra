import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi } from 'vitest';
import { MastraServer } from './index';

class TestMastraServer extends MastraServer<any, any, any> {
  stream = vi.fn();
  getParams = vi.fn();
  sendResponse = vi.fn();
  registerRoute = vi.fn();
  registerContextMiddleware = vi.fn();
  registerAuthMiddleware = vi.fn();
  registerHttpLoggingMiddleware = vi.fn();
}

function createAdapter(opts: { prefix?: string; customRouteAuthConfig?: Map<string, boolean> } = {}) {
  return new TestMastraServer({
    app: {},
    mastra: {
      getServer: () => undefined,
      setMastraServer: vi.fn(),
    } as unknown as Mastra,
    prefix: opts.prefix,
    customRouteAuthConfig: opts.customRouteAuthConfig,
  });
}

describe('MastraServer.getFrameworkPublicMatcher', () => {
  describe('built-in public core auth routes', () => {
    it('matches every public core auth route created via createPublicRoute()', () => {
      const isPublic = createAdapter().getFrameworkPublicMatcher();

      const cases: Array<[string, string]> = [
        ['GET', '/api/auth/capabilities'],
        ['GET', '/api/auth/me'],
        ['GET', '/api/auth/sso/login'],
        ['GET', '/api/auth/sso/callback'],
        ['POST', '/api/auth/logout'],
        ['POST', '/api/auth/refresh'],
        ['POST', '/api/auth/credentials/sign-in'],
        ['POST', '/api/auth/credentials/sign-up'],
      ];

      for (const [method, path] of cases) {
        expect(isPublic(path, method), `${method} ${path}`).toBe(true);
      }
    });

    it('is case-insensitive on the method', () => {
      const isPublic = createAdapter().getFrameworkPublicMatcher();

      expect(isPublic('/api/auth/capabilities', 'get')).toBe(true);
      expect(isPublic('/api/auth/logout', 'post')).toBe(true);
    });

    it('does not match public routes on a different method', () => {
      const isPublic = createAdapter().getFrameworkPublicMatcher();

      // capabilities is GET-only
      expect(isPublic('/api/auth/capabilities', 'POST')).toBe(false);
      // logout is POST-only
      expect(isPublic('/api/auth/logout', 'GET')).toBe(false);
    });
  });

  describe('protected routes stay protected', () => {
    it('does not match RBAC /api/auth/roles/:roleId/permissions (requires auth)', () => {
      const isPublic = createAdapter().getFrameworkPublicMatcher();
      expect(isPublic('/api/auth/roles/admin/permissions', 'GET')).toBe(false);
    });

    it('does not match regular protected routes like /api/agents', () => {
      const isPublic = createAdapter().getFrameworkPublicMatcher();
      expect(isPublic('/api/agents', 'GET')).toBe(false);
    });

    it('does not match unrelated paths', () => {
      const isPublic = createAdapter().getFrameworkPublicMatcher();
      expect(isPublic('/health', 'GET')).toBe(false);
      expect(isPublic('/random', 'GET')).toBe(false);
    });
  });

  describe('prefix handling', () => {
    it('honors a custom prefix', () => {
      const isPublic = createAdapter({ prefix: '/v2' }).getFrameworkPublicMatcher();

      expect(isPublic('/v2/auth/capabilities', 'GET')).toBe(true);
      expect(isPublic('/api/auth/capabilities', 'GET')).toBe(false);
    });

    it('honors an empty prefix', () => {
      // normalizeRoutePath('') → '' — falls back to no prefix.
      const isPublic = createAdapter({ prefix: '' }).getFrameworkPublicMatcher();

      // With an empty prefix the raw route path (no /api) is public.
      expect(isPublic('/auth/capabilities', 'GET')).toBe(true);
      expect(isPublic('/api/auth/capabilities', 'GET')).toBe(false);
    });
  });

  describe('custom API routes with requiresAuth: false', () => {
    it('matches a custom route the user registered as public', () => {
      const customRouteAuthConfig = new Map<string, boolean>([
        ['GET:/api/my-public', false], // false = requiresAuth false = public
      ]);
      const isPublic = createAdapter({ customRouteAuthConfig }).getFrameworkPublicMatcher();

      expect(isPublic('/api/my-public', 'GET')).toBe(true);
    });

    it('does not match a custom route the user registered as protected', () => {
      const customRouteAuthConfig = new Map<string, boolean>([['GET:/api/my-protected', true]]);
      const isPublic = createAdapter({ customRouteAuthConfig }).getFrameworkPublicMatcher();

      expect(isPublic('/api/my-protected', 'GET')).toBe(false);
    });

    it('matches a custom route with a path parameter', () => {
      const customRouteAuthConfig = new Map<string, boolean>([['GET:/api/users/:id/profile', false]]);
      const isPublic = createAdapter({ customRouteAuthConfig }).getFrameworkPublicMatcher();

      expect(isPublic('/api/users/42/profile', 'GET')).toBe(true);
    });

    it('matches a custom public route when the request method arrives lowercase', () => {
      const customRouteAuthConfig = new Map<string, boolean>([['GET:/api/my-public', false]]);
      const isPublic = createAdapter({ customRouteAuthConfig }).getFrameworkPublicMatcher();

      // Adapters may pass the raw method — normalize before matching custom routes
      // so a lowercase `get` still matches a `GET:` entry.
      expect(isPublic('/api/my-public', 'get')).toBe(true);
    });

    it('does not confuse ALL:key with a specific method', () => {
      const customRouteAuthConfig = new Map<string, boolean>([['ALL:/api/everything', false]]);
      const isPublic = createAdapter({ customRouteAuthConfig }).getFrameworkPublicMatcher();

      expect(isPublic('/api/everything', 'GET')).toBe(true);
      expect(isPublic('/api/everything', 'POST')).toBe(true);
      expect(isPublic('/api/everything', 'DELETE')).toBe(true);
    });
  });
});
