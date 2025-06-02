import type { MastraAuthConfig } from '@mastra/core/server';
import { describe, it, expect } from 'vitest';
// import { authenticationMiddleware, authorizationMiddleware, exchangeTokenHandler } from '.';
import { canAccessPublicly, pathMatchesPattern, pathMatchesRule, matchesOrIncludes, checkRules } from './helpers';

describe('auth', () => {
  describe('authenticationMiddleware', () => {
    it('should return 401 if no token is provided', () => {
      // const context = createMockContext();
    });
  });

  describe('authorizationMiddleware', () => {
    it('should return 401 if no user is provided', () => {
      // const context = createMockContext();
    });
  });

  describe('exchangeTokenHandler', () => {
    it('should return 401 if no token is provided', () => {
      // const context = createMockContext();
    });
  });

  describe('pathMatchesPattern', () => {
    it('should match exact paths', () => {
      expect(pathMatchesPattern('/api/users', '/api/users')).toBe(true);
      expect(pathMatchesPattern('/api/users', '/api/posts')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      expect(pathMatchesPattern('/api/users/123', '/api/users/*')).toBe(true);
      expect(pathMatchesPattern('/api/posts/123', '/api/users/*')).toBe(false);
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
});
