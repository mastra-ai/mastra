/**
 * Auth Infrastructure E2E Tests
 *
 * Feature: F001 - E2E Test Infrastructure Setup
 *
 * These tests validate that the auth testing infrastructure is working correctly:
 * - Auth helper utilities work as expected
 * - Route interception properly mocks auth endpoints
 * - Different user roles can be simulated
 * - Auth fixtures provide correct permission data
 */

import { test, expect } from '@playwright/test';
import {
  setupMockAuth,
  setupAdminAuth,
  setupMemberAuth,
  setupViewerAuth,
  setupUnauthenticated,
  setupNoPermissions,
  ROLE_PERMISSIONS,
  MOCK_USERS,
  buildAuthCapabilities,
} from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

test.describe('Auth Infrastructure', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('Auth Capabilities Mocking', () => {
    test('can mock admin user capabilities', async ({ page }) => {
      await setupAdminAuth(page);

      // Intercept the response to verify it's mocked correctly
      const [response] = await Promise.all([page.waitForResponse('**/api/auth/capabilities'), page.goto('/')]);

      const data = await response.json();

      expect(data.enabled).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(MOCK_USERS.admin.id);
      expect(data.user.email).toBe(MOCK_USERS.admin.email);
      expect(data.capabilities.rbac).toBe(true);
      expect(data.access.roles).toContain('admin');
      expect(data.access.permissions).toEqual(ROLE_PERMISSIONS.admin);
    });

    test('can mock member user capabilities', async ({ page }) => {
      await setupMemberAuth(page);

      const [response] = await Promise.all([page.waitForResponse('**/api/auth/capabilities'), page.goto('/')]);

      const data = await response.json();

      expect(data.user.id).toBe(MOCK_USERS.member.id);
      expect(data.access.roles).toContain('member');
      expect(data.access.permissions).toEqual(ROLE_PERMISSIONS.member);
    });

    test('can mock viewer user capabilities', async ({ page }) => {
      await setupViewerAuth(page);

      const [response] = await Promise.all([page.waitForResponse('**/api/auth/capabilities'), page.goto('/')]);

      const data = await response.json();

      expect(data.user.id).toBe(MOCK_USERS.viewer.id);
      expect(data.access.roles).toContain('viewer');
      expect(data.access.permissions).toEqual(ROLE_PERMISSIONS.viewer);
    });

    test('can mock unauthenticated state', async ({ page }) => {
      await setupUnauthenticated(page);

      const [response] = await Promise.all([page.waitForResponse('**/api/auth/capabilities'), page.goto('/')]);

      const data = await response.json();

      expect(data.enabled).toBe(true);
      expect(data.user).toBeUndefined();
      expect(data.login).toBeDefined();
    });

    test('can mock user with no permissions (_default role)', async ({ page }) => {
      await setupNoPermissions(page);

      const [response] = await Promise.all([page.waitForResponse('**/api/auth/capabilities'), page.goto('/')]);

      const data = await response.json();

      expect(data.user).toBeDefined();
      expect(data.access.roles).toContain('_default');
      expect(data.access.permissions).toEqual([]);
    });
  });

  test.describe('Custom Auth Configuration', () => {
    test('can mock custom user data', async ({ page }) => {
      await setupMockAuth(page, {
        role: 'member',
        user: {
          id: 'custom_user_id',
          email: 'custom@example.com',
          name: 'Custom User',
        },
      });

      const [response] = await Promise.all([page.waitForResponse('**/api/auth/capabilities'), page.goto('/')]);

      const data = await response.json();

      expect(data.user.id).toBe('custom_user_id');
      expect(data.user.email).toBe('custom@example.com');
      expect(data.user.name).toBe('Custom User');
    });

    test('can mock custom permissions', async ({ page }) => {
      const customPermissions = ['agents:read', 'workflows:read', 'custom:permission'];

      await setupMockAuth(page, {
        role: 'viewer',
        permissions: customPermissions,
      });

      const [response] = await Promise.all([page.waitForResponse('**/api/auth/capabilities'), page.goto('/')]);

      const data = await response.json();

      expect(data.access.permissions).toEqual(customPermissions);
    });

    test('can mock disabled RBAC', async ({ page }) => {
      await setupMockAuth(page, {
        role: 'viewer',
        rbacEnabled: false,
      });

      const [response] = await Promise.all([page.waitForResponse('**/api/auth/capabilities'), page.goto('/')]);

      const data = await response.json();

      expect(data.capabilities.rbac).toBe(false);
      expect(data.access).toBeNull();
    });

    test('can mock auth disabled', async ({ page }) => {
      await setupMockAuth(page, {
        enabled: false,
      });

      const [response] = await Promise.all([page.waitForResponse('**/api/auth/capabilities'), page.goto('/')]);

      const data = await response.json();

      expect(data.enabled).toBe(false);
      expect(data.login).toBeNull();
    });
  });

  test.describe('Auth Me Endpoint Mocking', () => {
    test('returns user for authenticated state when called from browser', async ({ page }) => {
      await setupAdminAuth(page);

      // Navigate first to ensure routes are set up
      await page.goto('/');

      // Make a fetch request from within the browser context (uses page.route interception)
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        return {
          status: res.status,
          body: res.ok ? await res.json() : null,
        };
      });

      expect(response.status).toBe(200);
      expect(response.body).not.toBeNull();
      expect(response.body.id).toBe('user_admin_123'); // MOCK_USERS.admin.id
    });

    test('returns 401 for unauthenticated state when called from browser', async ({ page }) => {
      await setupUnauthenticated(page);

      // Navigate first to ensure routes are set up
      await page.goto('/');

      // Make a fetch request from within the browser context
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        return {
          status: res.status,
          body: res.ok ? await res.json() : null,
        };
      });

      expect(response.status).toBe(401);
    });
  });

  test.describe('buildAuthCapabilities Helper', () => {
    test('builds correct admin capabilities', () => {
      const capabilities = buildAuthCapabilities({ role: 'admin' });

      expect(capabilities.enabled).toBe(true);
      expect(capabilities.user?.id).toBe(MOCK_USERS.admin.id);
      expect(capabilities.access?.roles).toContain('admin');
      expect(capabilities.access?.permissions).toEqual(['*']);
    });

    test('builds correct member capabilities', () => {
      const capabilities = buildAuthCapabilities({ role: 'member' });

      expect(capabilities.access?.permissions).toEqual(ROLE_PERMISSIONS.member);
    });

    test('builds unauthenticated capabilities', () => {
      const capabilities = buildAuthCapabilities({ authenticated: false });

      expect(capabilities.user).toBeUndefined();
      expect(capabilities.login).not.toBeNull();
    });
  });
});

test.describe('Auth Fixtures', () => {
  test('ROLE_PERMISSIONS matches PRD specification', () => {
    // Verify role permissions match the PRD
    expect(ROLE_PERMISSIONS.admin).toEqual(['*']);
    expect(ROLE_PERMISSIONS.member).toEqual(['agents:read', 'workflows:*', 'tools:read', 'tools:execute']);
    expect(ROLE_PERMISSIONS.viewer).toEqual(['agents:read', 'workflows:read']);
    expect(ROLE_PERMISSIONS._default).toEqual([]);
  });

  test('MOCK_USERS has all required roles', () => {
    expect(MOCK_USERS.admin).toBeDefined();
    expect(MOCK_USERS.member).toBeDefined();
    expect(MOCK_USERS.viewer).toBeDefined();
    expect(MOCK_USERS._default).toBeDefined();

    // Verify each user has required fields
    for (const [role, user] of Object.entries(MOCK_USERS)) {
      expect(user.id).toBeTruthy();
      expect(user.email).toBeTruthy();
      expect(user.name).toBeTruthy();
    }
  });
});
