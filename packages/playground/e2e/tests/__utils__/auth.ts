/**
 * Auth testing utilities for E2E tests.
 *
 * Provides helpers for mocking authentication and RBAC in Playwright tests
 * by intercepting the /api/auth/capabilities endpoint.
 */

import { Page, Route, Request } from '@playwright/test';

/**
 * User role types matching the PRD permission model.
 */
export type UserRole = 'admin' | 'member' | 'viewer' | '_default';

/**
 * Role to permissions mapping from the PRD.
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  member: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
  viewer: ['agents:read', 'workflows:read'],
  _default: [],
};

/**
 * Mock user data for testing.
 */
export interface MockUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/**
 * Default mock users for different roles.
 */
export const MOCK_USERS: Record<UserRole, MockUser> = {
  admin: {
    id: 'user_admin_123',
    email: 'admin@example.com',
    name: 'Admin User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
  },
  member: {
    id: 'user_member_456',
    email: 'member@example.com',
    name: 'Member User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=member',
  },
  viewer: {
    id: 'user_viewer_789',
    email: 'viewer@example.com',
    name: 'Viewer User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=viewer',
  },
  _default: {
    id: 'user_default_000',
    email: 'default@example.com',
    name: 'Default User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  },
};

/**
 * Auth capabilities response structure.
 */
export interface AuthCapabilitiesResponse {
  enabled: boolean;
  login: {
    type: 'sso' | 'credentials' | 'both';
    signUpEnabled?: boolean;
    sso?: {
      provider: string;
      text: string;
      url: string;
    };
  } | null;
  user?: MockUser;
  capabilities?: {
    user: boolean;
    session: boolean;
    sso: boolean;
    rbac: boolean;
    acl: boolean;
  };
  access?: {
    roles: string[];
    permissions: string[];
  } | null;
}

/**
 * Configuration for mocking auth state.
 */
export interface MockAuthConfig {
  /** Whether auth is enabled (default: true) */
  enabled?: boolean;
  /** Whether the user is authenticated (default: true if role is set) */
  authenticated?: boolean;
  /** User role for permission resolution */
  role?: UserRole;
  /** Custom user data (overrides defaults for the role) */
  user?: Partial<MockUser>;
  /** Custom permissions (overrides role-based permissions) */
  permissions?: string[];
  /** Additional roles to include */
  additionalRoles?: string[];
  /** Whether RBAC is enabled (default: true) */
  rbacEnabled?: boolean;
  /** Login type configuration */
  loginType?: 'sso' | 'credentials' | 'both';
  /** Whether sign-up is enabled (default: true) */
  signUpEnabled?: boolean;
}

/**
 * Build the auth capabilities response based on config.
 */
export function buildAuthCapabilities(config: MockAuthConfig): AuthCapabilitiesResponse {
  const {
    enabled = true,
    authenticated = !!config.role,
    role = '_default',
    user,
    permissions,
    additionalRoles = [],
    rbacEnabled = true,
    loginType = 'sso',
    signUpEnabled = true,
  } = config;

  // Base response for unauthenticated state
  if (!enabled) {
    return {
      enabled: false,
      login: null,
    };
  }

  // Build login config
  const login: AuthCapabilitiesResponse['login'] = {
    type: loginType,
    signUpEnabled,
    ...(loginType !== 'credentials' && {
      sso: {
        provider: 'workos',
        text: 'Sign in with SSO',
        url: '/api/auth/sso/login',
      },
    }),
  };

  // Unauthenticated response
  if (!authenticated) {
    return {
      enabled: true,
      login,
    };
  }

  // Build authenticated response
  const mockUser = {
    ...MOCK_USERS[role],
    ...user,
  };

  const resolvedRoles = [role, ...additionalRoles];
  const resolvedPermissions = permissions ?? ROLE_PERMISSIONS[role];

  return {
    enabled: true,
    login,
    user: mockUser,
    capabilities: {
      user: true,
      session: true,
      sso: loginType !== 'credentials',
      rbac: rbacEnabled,
      acl: false,
    },
    access: rbacEnabled
      ? {
          roles: resolvedRoles,
          permissions: resolvedPermissions,
        }
      : null,
  };
}

/**
 * Build the /api/auth/me response based on config.
 */
export function buildCurrentUserResponse(config: MockAuthConfig): MockUser | null {
  const { authenticated = !!config.role, role = '_default', user } = config;

  if (!authenticated) {
    return null;
  }

  return {
    ...MOCK_USERS[role],
    ...user,
  };
}

/**
 * Set up mock authentication for a Playwright page.
 *
 * Intercepts the /api/auth/capabilities and /api/auth/me endpoints
 * to return mock data based on the provided configuration.
 *
 * Note: This is for UI testing only. It uses route interception to mock
 * auth responses. Server-side permission enforcement tests are in
 * server-adapters/hono/src/__tests__/rbac-permissions.test.ts.
 *
 * @example Basic usage with admin role
 * ```typescript
 * test('admin can access all features', async ({ page }) => {
 *   await setupMockAuth(page, { role: 'admin' });
 *   await page.goto('/agents');
 *   // Admin should see all features
 * });
 * ```
 *
 * @example Unauthenticated user
 * ```typescript
 * test('unauthenticated user redirects to login', async ({ page }) => {
 *   await setupMockAuth(page, { authenticated: false });
 *   await page.goto('/agents');
 *   // Should redirect to login
 * });
 * ```
 *
 * @example Custom permissions
 * ```typescript
 * test('user with custom permissions', async ({ page }) => {
 *   await setupMockAuth(page, {
 *     role: 'member',
 *     permissions: ['agents:read', 'agents:write'],
 *   });
 *   await page.goto('/agents');
 * });
 * ```
 */
export async function setupMockAuth(page: Page, config: MockAuthConfig = {}): Promise<void> {
  const capabilitiesResponse = buildAuthCapabilities(config);
  const meResponse = buildCurrentUserResponse(config);

  // Intercept /api/auth/capabilities
  await page.route('**/api/auth/capabilities', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(capabilitiesResponse),
    });
  });

  // Intercept /api/auth/me
  await page.route('**/api/auth/me', async (route: Route) => {
    if (meResponse) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(meResponse),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not authenticated' }),
      });
    }
  });
}

/**
 * Set up mock auth for admin user.
 */
export async function setupAdminAuth(page: Page): Promise<void> {
  await setupMockAuth(page, { role: 'admin' });
}

/**
 * Set up mock auth for member user.
 */
export async function setupMemberAuth(page: Page): Promise<void> {
  await setupMockAuth(page, { role: 'member' });
}

/**
 * Set up mock auth for viewer user.
 */
export async function setupViewerAuth(page: Page): Promise<void> {
  await setupMockAuth(page, { role: 'viewer' });
}

/**
 * Set up mock auth for unauthenticated state (shows login page).
 */
export async function setupUnauthenticated(page: Page): Promise<void> {
  await setupMockAuth(page, { authenticated: false });
}

/**
 * Set up mock auth for user with no permissions (_default role).
 */
export async function setupNoPermissions(page: Page): Promise<void> {
  await setupMockAuth(page, { role: '_default' });
}

/**
 * Clear mock auth routes and headers (useful for testing login/logout flows).
 */
export async function clearMockAuth(page: Page): Promise<void> {
  await page.unroute('**/api/auth/capabilities');
  await page.unroute('**/api/auth/me');
  await page.setExtraHTTPHeaders({});
}

/**
 * Mock a login redirect by intercepting SSO login and returning success.
 *
 * This simulates the SSO callback returning successfully.
 */
export async function mockSSOLoginSuccess(page: Page, config: MockAuthConfig): Promise<void> {
  // Mock the SSO callback endpoint
  await page.route('**/api/auth/sso/callback**', async (route: Route) => {
    // Redirect to home page after successful login
    await route.fulfill({
      status: 302,
      headers: {
        Location: '/',
      },
    });
  });

  // Set up the auth state for after login
  await setupMockAuth(page, config);
}

/**
 * Mock a logout by clearing auth and redirecting to login.
 */
export async function mockLogout(page: Page): Promise<void> {
  // Mock the logout endpoint
  await page.route('**/api/auth/logout', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        redirectTo: '/login',
      }),
    });
  });

  // Update auth state to unauthenticated
  await clearMockAuth(page);
  await setupUnauthenticated(page);
}

/**
 * Wait for auth to be loaded in the page.
 * Useful after navigation to ensure auth state is applied.
 */
export async function waitForAuthLoaded(page: Page): Promise<void> {
  // Wait for either:
  // 1. The main app layout to appear (authenticated)
  // 2. The login page to appear (unauthenticated)
  await page.waitForSelector('[data-testid="main-layout"], [data-testid="login-page"]', {
    timeout: 10000,
  });
}

/**
 * Assert that a permission-denied message is shown.
 */
export async function expectPermissionDenied(page: Page): Promise<void> {
  const deniedMessage = page.getByText(/permission denied|access denied|not authorized|forbidden/i);
  await deniedMessage.waitFor({ state: 'visible', timeout: 5000 });
}
