import type { MastraAuthConfig } from '@mastra/core/server';
import { describe, expect, it } from 'vitest';

import {
  canAccessPublicly,
  checkRules,
  isCustomRoutePublic,
  matchesOrIncludes,
  pathMatchesPattern,
  pathMatchesRule,
} from './helpers';

describe('auth helpers', () => {
  describe('pathMatchesPattern', () => {
    it('should match exact paths', () => {
      expect(pathMatchesPattern('/api/users', '/api/users')).toBe(true);
      expect(pathMatchesPattern('/api/users', '/api/posts')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      expect(pathMatchesPattern('/api/users/123', '/api/users/*')).toBe(true);
      expect(pathMatchesPattern('/api/posts/123', '/api/users/*')).toBe(false);
    });

    describe('path parameters', () => {
      it('should match single path parameter', () => {
        expect(pathMatchesPattern('/users/123', '/users/:id')).toBe(true);
        expect(pathMatchesPattern('/users/abc', '/users/:id')).toBe(true);
        expect(pathMatchesPattern('/posts/123', '/users/:id')).toBe(false);
      });

      it('should match multiple path parameters', () => {
        expect(pathMatchesPattern('/posts/1/comments/2', '/posts/:postId/comments/:commentId')).toBe(true);
        expect(pathMatchesPattern('/posts/abc/comments/xyz', '/posts/:postId/comments/:commentId')).toBe(true);
      });

      it('should match mixed static and dynamic segments', () => {
        expect(pathMatchesPattern('/api/users/123/profile', '/api/users/:id/profile')).toBe(true);
        expect(pathMatchesPattern('/api/users/123/settings', '/api/users/:id/profile')).toBe(false);
      });

      it('should not match when segment count differs', () => {
        expect(pathMatchesPattern('/users/123/extra', '/users/:id')).toBe(false);
        expect(pathMatchesPattern('/users', '/users/:id')).toBe(false);
      });

      it('should not match empty parameter values', () => {
        expect(pathMatchesPattern('/users/', '/users/:id')).toBe(false);
        expect(pathMatchesPattern('/users//', '/users/:id')).toBe(false);
      });

      it('should handle multiple consecutive parameters', () => {
        expect(pathMatchesPattern('/api/v1/123', '/api/:version/:id')).toBe(true);
        expect(pathMatchesPattern('/api/v1/', '/api/:version/:id')).toBe(false);
      });
    });
  });

  describe('matchesOrIncludes', () => {
    it('should match single string values', () => {
      expect(matchesOrIncludes('GET', 'GET')).toBe(true);
      expect(matchesOrIncludes('GET', 'POST')).toBe(false);
    });

    it('should check inclusion in arrays', () => {
      expect(matchesOrIncludes(['GET', 'POST'], 'GET')).toBe(true);
      expect(matchesOrIncludes(['GET', 'POST'], 'DELETE')).toBe(false);
    });
  });

  describe('pathMatchesRule', () => {
    it('should return true if rulePath is undefined', () => {
      expect(pathMatchesRule('/api/users', undefined)).toBe(true);
    });

    it('should match string patterns', () => {
      expect(pathMatchesRule('/api/users/123', '/api/users/*')).toBe(true);
    });

    it('should match regex patterns', () => {
      expect(pathMatchesRule('/api/users/123', /^\/api\/users\/\d+$/)).toBe(true);
      expect(pathMatchesRule('/api/posts', /^\/api\/users\/\d+$/)).toBe(false);
    });

    it('should match array of patterns', () => {
      expect(pathMatchesRule('/api/users', ['/api/posts', '/api/users'])).toBe(true);
      expect(pathMatchesRule('/api/settings', ['/api/posts', '/api/users'])).toBe(false);
    });
  });

  describe('canAccessPublicly', () => {
    const authConfig: MastraAuthConfig = {
      public: ['/api/health', ['/api/login', 'POST'], /^\/public\/.*/, ['/api/agents', ['GET', 'POST']]],
    };

    it('should allow access to exact string matches', () => {
      expect(canAccessPublicly('/api/health', 'GET', authConfig)).toBe(true);
    });

    it('should allow access to pattern with method matches', () => {
      expect(canAccessPublicly('/api/login', 'POST', authConfig)).toBe(true);
      expect(canAccessPublicly('/api/login', 'GET', authConfig)).toBe(false);
    });

    it('should allow access to regex pattern matches', () => {
      expect(canAccessPublicly('/public/file.jpg', 'GET', authConfig)).toBe(true);
    });

    it('should deny access to non-matching paths', () => {
      expect(canAccessPublicly('/api/users', 'GET', authConfig)).toBe(false);
    });

    it('should allow access to array of methods', () => {
      expect(canAccessPublicly('/api/agents', 'GET', authConfig)).toBe(true);
      expect(canAccessPublicly('/api/agents', 'POST', authConfig)).toBe(true);
      expect(canAccessPublicly('/api/agents', 'DELETE', authConfig)).toBe(false);
    });
  });

  describe('checkRules', () => {
    const rules: MastraAuthConfig['rules'] = [
      { path: '/api/admin/*', methods: 'GET', condition: (user: any) => user?.role === 'admin' },
      { path: '/api/users/*', methods: ['GET', 'POST'], allow: true },
      { path: /^\/api\/public\/.*/, allow: true },
    ];

    it('should allow access when condition function returns true', async () => {
      const user = { role: 'admin' };
      expect(await checkRules(rules, '/api/admin/dashboard', 'GET', user)).toBe(true);
    });

    it('should deny access when condition function returns false', async () => {
      const user = { role: 'user' };
      expect(await checkRules(rules, '/api/admin/dashboard', 'GET', user)).toBe(false);
    });

    it('should allow access when path and method match rule with allow: true', async () => {
      expect(await checkRules(rules, '/api/users/123', 'GET', {})).toBe(true);
    });

    it("should deny access when method doesn't match rule", async () => {
      expect(await checkRules(rules, '/api/users/123', 'DELETE', {})).toBe(false);
    });

    it('should allow access when path matches regex pattern with allow: true', async () => {
      expect(await checkRules(rules, '/api/public/file.jpg', 'GET', {})).toBe(true);
    });

    it('should deny access when no rules match', async () => {
      expect(await checkRules(rules, '/api/other/resource', 'GET', {})).toBe(false);
    });
  });

  describe('isCustomRoutePublic', () => {
    it('should return false when customRouteAuthConfig is undefined', () => {
      expect(isCustomRoutePublic('/api/test', 'GET', undefined)).toBe(false);
    });

    it('should return false when customRouteAuthConfig is empty', () => {
      const config = new Map<string, boolean>();
      expect(isCustomRoutePublic('/api/test', 'GET', config)).toBe(false);
    });

    it('should return true for routes with requiresAuth set to false', () => {
      const config = new Map<string, boolean>();
      config.set('GET:/api/public', false);
      expect(isCustomRoutePublic('/api/public', 'GET', config)).toBe(true);
    });

    it('should return false for routes with requiresAuth set to true', () => {
      const config = new Map<string, boolean>();
      config.set('GET:/api/protected', true);
      expect(isCustomRoutePublic('/api/protected', 'GET', config)).toBe(false);
    });

    it('should check exact method match first', () => {
      const config = new Map<string, boolean>();
      config.set('GET:/api/endpoint', false);
      config.set('POST:/api/endpoint', true);

      expect(isCustomRoutePublic('/api/endpoint', 'GET', config)).toBe(true);
      expect(isCustomRoutePublic('/api/endpoint', 'POST', config)).toBe(false);
    });

    it('should fall back to ALL method if exact method not found', () => {
      const config = new Map<string, boolean>();
      config.set('ALL:/api/endpoint', false);

      expect(isCustomRoutePublic('/api/endpoint', 'GET', config)).toBe(true);
      expect(isCustomRoutePublic('/api/endpoint', 'POST', config)).toBe(true);
    });

    describe('path parameters (issue #12106)', () => {
      it('should match route with single path parameter', () => {
        const config = new Map<string, boolean>();
        config.set('GET:/other/route/:id', false);

        // This should return true (route is public) but currently returns false
        expect(isCustomRoutePublic('/other/route/test', 'GET', config)).toBe(true);
        expect(isCustomRoutePublic('/other/route/123', 'GET', config)).toBe(true);
      });

      it('should match route with multiple path parameters', () => {
        const config = new Map<string, boolean>();
        config.set('GET:/api/:version/users/:id', false);

        expect(isCustomRoutePublic('/api/v1/users/123', 'GET', config)).toBe(true);
        expect(isCustomRoutePublic('/api/v2/users/456', 'GET', config)).toBe(true);
      });

      it('should match route with mixed static and dynamic segments', () => {
        const config = new Map<string, boolean>();
        config.set('GET:/api/users/:id/profile', false);

        expect(isCustomRoutePublic('/api/users/123/profile', 'GET', config)).toBe(true);
      });

      it('should not match when segment count differs', () => {
        const config = new Map<string, boolean>();
        config.set('GET:/users/:id', false);

        // Too many segments
        expect(isCustomRoutePublic('/users/123/extra', 'GET', config)).toBe(false);
        // Too few segments
        expect(isCustomRoutePublic('/users', 'GET', config)).toBe(false);
      });

      it('should not match empty parameter values', () => {
        const config = new Map<string, boolean>();
        config.set('GET:/users/:id', false);

        // Empty parameter (trailing slash with no value)
        expect(isCustomRoutePublic('/users/', 'GET', config)).toBe(false);
      });

      it('should respect method when matching path parameters', () => {
        const config = new Map<string, boolean>();
        config.set('GET:/users/:id', false);
        config.set('POST:/users/:id', true);

        expect(isCustomRoutePublic('/users/123', 'GET', config)).toBe(true);
        expect(isCustomRoutePublic('/users/123', 'POST', config)).toBe(false);
      });

      it('should work with ALL method and path parameters', () => {
        const config = new Map<string, boolean>();
        config.set('ALL:/webhooks/:id', false);

        expect(isCustomRoutePublic('/webhooks/github', 'GET', config)).toBe(true);
        expect(isCustomRoutePublic('/webhooks/stripe', 'POST', config)).toBe(true);
      });
    });
  });
});
