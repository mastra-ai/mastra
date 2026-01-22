/**
 * Test Auth Provider for E2E testing.
 *
 * This auth provider allows programmatic control of authentication state
 * via HTTP headers, enabling server-side permission enforcement tests.
 *
 * Usage:
 * - X-Test-Auth-Role: admin|member|viewer|_default|unauthenticated
 *
 * This allows E2E tests to verify that the server correctly enforces
 * permissions at the API level, not just the UI level.
 */

import { MastraAuthProvider } from '@mastra/core/server';
import { StaticRBACProvider } from '@mastra/core/ee';
import type { EEUser, IRBACProvider } from '@mastra/core/ee';

/**
 * Request type that has a header method - compatible with HonoRequest
 */
interface RequestWithHeaders {
  header(name: string): string | undefined;
}

/**
 * Test user type with role information.
 */
export interface TestUser extends EEUser {
  role: TestRole;
}

/**
 * Valid test roles matching the PRD permission model.
 */
export type TestRole = 'admin' | 'member' | 'viewer' | '_default';

/**
 * Role permissions as defined in the PRD.
 */
export const ROLE_PERMISSIONS: Record<TestRole, string[]> = {
  admin: ['*'],
  member: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
  viewer: ['agents:read', 'workflows:read'],
  _default: [],
};

/**
 * Mock users for each role.
 */
const TEST_USERS: Record<TestRole, TestUser> = {
  admin: {
    id: 'test_admin_001',
    email: 'admin@e2e-test.local',
    name: 'Test Admin',
    role: 'admin',
  },
  member: {
    id: 'test_member_001',
    email: 'member@e2e-test.local',
    name: 'Test Member',
    role: 'member',
  },
  viewer: {
    id: 'test_viewer_001',
    email: 'viewer@e2e-test.local',
    name: 'Test Viewer',
    role: 'viewer',
  },
  _default: {
    id: 'test_default_001',
    email: 'default@e2e-test.local',
    name: 'Test Default',
    role: '_default',
  },
};

/**
 * Header name for controlling test auth role.
 * Tests should set this header to simulate different user roles.
 */
export const TEST_AUTH_ROLE_HEADER = 'X-Test-Auth-Role';

/**
 * Test Auth Provider for E2E testing.
 *
 * Authenticates requests based on:
 * 1. The Bearer token value (role name as token): Authorization: Bearer admin
 * 2. The X-Test-Auth-Role header as fallback
 *
 * Valid values: 'admin', 'member', 'viewer', '_default'
 * - 'unauthenticated' or missing: Returns null (unauthenticated)
 */
export class TestAuthProvider extends MastraAuthProvider<TestUser> {
  constructor() {
    super({ name: 'test-auth' });
  }

  /**
   * Authenticate a request based on the Bearer token or X-Test-Auth-Role header.
   *
   * The token value is used as the role (e.g., "admin", "member", "viewer", "_default").
   * This allows tests to send `Authorization: Bearer admin` to authenticate as admin.
   */
  async authenticateToken(token: string, request: RequestWithHeaders): Promise<TestUser | null> {
    // First, try to use the token as the role
    let role = token;

    // Fall back to header if token is not a valid role
    if (!this.isValidRole(role)) {
      const roleHeader = request.header(TEST_AUTH_ROLE_HEADER);
      role = roleHeader || '';
    }

    // No role or explicitly unauthenticated
    if (!role || role === 'unauthenticated') {
      return null;
    }

    // Validate the role
    if (!this.isValidRole(role)) {
      // Invalid role - treat as unauthenticated
      console.warn(`[TestAuth] Invalid role: ${role}`);
      return null;
    }

    // Return the test user for the requested role
    return TEST_USERS[role as TestRole];
  }

  /**
   * Authorize a user - all authenticated test users are authorized.
   */
  async authorizeUser(user: TestUser, _request: RequestWithHeaders): Promise<boolean> {
    // All authenticated test users are authorized
    return !!user?.id;
  }

  /**
   * Check if a string is a valid test role.
   */
  private isValidRole(role: string): boolean {
    return ['admin', 'member', 'viewer', '_default'].includes(role);
  }
}

/**
 * Test RBAC Provider for E2E testing.
 *
 * Uses the static RBAC provider with role mapping based on the PRD permissions.
 */
export function createTestRBACProvider(): IRBACProvider<TestUser> {
  return new StaticRBACProvider<TestUser>({
    roleMapping: ROLE_PERMISSIONS,
    getUserRoles: (user: TestUser) => [user.role],
  });
}

/**
 * Create the complete test auth configuration for the Mastra instance.
 */
export function createTestAuthConfig() {
  return {
    auth: new TestAuthProvider(),
    rbac: createTestRBACProvider(),
  };
}
