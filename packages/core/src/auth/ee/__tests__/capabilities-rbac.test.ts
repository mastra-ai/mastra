/**
 * @license Mastra Enterprise License - see ee/LICENSE
 *
 * Regression tests for buildCapabilities + RBAC role-listing.
 *
 * Specifically guards against `this`-binding loss when invoking
 * optional methods on an IRBACProvider instance (e.g. MastraRBACWorkos
 * whose getPermissionsForRole reads `this.options.roleMapping`).
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { buildCapabilities } from '../capabilities';
import { clearLicenseCache } from '../license';

function createMockAuth(user: { id: string; email: string; name: string } | null) {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(user),
  };
}

// Class-based RBAC provider whose methods rely on `this`.
// Mirrors the shape that broke with MastraRBACWorkos.
class FakeRBACProvider {
  options = {
    roleMapping: {
      admin: ['*'] as string[],
      member: ['tools:read'] as string[],
      viewer: [] as string[],
    } as Record<string, string[]>,
  };

  async getRoles() {
    return ['admin'];
  }
  async hasRole() {
    return true;
  }
  async getPermissions() {
    // Admin bypass — triggers the availableRoles branch in buildCapabilities.
    return ['*'];
  }
  async hasPermission() {
    return true;
  }
  async hasAllPermissions() {
    return true;
  }
  async hasAnyPermission() {
    return true;
  }
  async getAvailableRoles() {
    return Object.keys(this.options.roleMapping).map(id => ({ id, name: id }));
  }
  async getPermissionsForRole(roleId: string) {
    // Will throw "Cannot read properties of undefined (reading 'options')"
    // if invoked without proper `this` binding.
    return this.options.roleMapping[roleId] ?? [];
  }
}

describe('buildCapabilities — RBAC role listing', () => {
  let originalNodeEnv: string | undefined;
  let originalLicense: string | undefined;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalNodeEnv = process.env['NODE_ENV'];
    originalLicense = process.env['MASTRA_EE_LICENSE'];
    process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);
    clearLicenseCache();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
    else delete process.env['NODE_ENV'];
    if (originalLicense !== undefined) process.env['MASTRA_EE_LICENSE'] = originalLicense;
    else delete process.env['MASTRA_EE_LICENSE'];
    clearLicenseCache();
    warnSpy.mockRestore();
  });

  it('preserves `this` when invoking rbacProvider.getPermissionsForRole', async () => {
    const auth = createMockAuth({ id: 'user-1', email: 'admin@test.com', name: 'Admin' });
    const rbac = new FakeRBACProvider();

    const result = await buildCapabilities(auth as any, new Request('http://localhost'), {
      rbac: rbac as any,
    });

    // Must not have logged the "failed to list permissions for role" warning.
    const failedRolePermLog = warnSpy.mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('failed to list permissions for role'),
    );
    expect(failedRolePermLog).toBeUndefined();

    // availableRoles should be returned and filtered to exclude admin-bypass roles.
    expect('availableRoles' in result).toBe(true);
    const availableRoles = (result as { availableRoles?: { id: string; name: string }[] }).availableRoles;
    expect(availableRoles).toBeDefined();
    // `admin` has ['*'] — excluded. `member` and `viewer` should remain.
    expect(availableRoles!.map(r => r.id).sort()).toEqual(['member', 'viewer']);
  });
});
