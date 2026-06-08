/**
 * @license Mastra Enterprise License - see ee/LICENSE
 *
 * Regression test for the `this`-binding bug in buildCapabilities when
 * resolving permissions for the "View as role" picker. Class-based RBAC
 * providers (e.g. @mastra/auth-workos) read state from `this.options` inside
 * `getPermissionsForRole`, so the method must be invoked with its original
 * receiver instead of being detached to a bare variable.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { buildCapabilities } from '../capabilities';
import type { IRBACProvider } from '../interfaces/rbac';
import { clearLicenseCache } from '../license';

function createMockAuth(user: { id: string; email: string; name: string } | null) {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(user),
  };
}

/**
 * Class-based RBAC provider whose `getPermissionsForRole` depends on `this`.
 * Mirrors the shape of providers like MastraAuthWorkOS where role permissions
 * are resolved via `this.options.roleMapping`.
 */
class ClassBasedRBACProvider implements IRBACProvider {
  private readonly options: { roleMapping: Record<string, string[]> };

  constructor(options: { roleMapping: Record<string, string[]> }) {
    this.options = options;
  }

  async getRoles() {
    return ['admin'];
  }
  async hasRole() {
    return true;
  }
  async getPermissions() {
    // Admin bypass permission - triggers the availableRoles branch.
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
    // Reads from `this.options` - blows up with TypeError if `this` was lost.
    return this.options.roleMapping[roleId] ?? [];
  }
}

describe('buildCapabilities - RBAC method `this` binding', () => {
  let originalNodeEnv: string | undefined;
  let originalLicense: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env['NODE_ENV'];
    originalLicense = process.env['MASTRA_EE_LICENSE'];
    process.env['MASTRA_EE_LICENSE'] = 'a'.repeat(32);
    clearLicenseCache();
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) process.env['NODE_ENV'] = originalNodeEnv;
    else delete process.env['NODE_ENV'];
    if (originalLicense !== undefined) process.env['MASTRA_EE_LICENSE'] = originalLicense;
    else delete process.env['MASTRA_EE_LICENSE'];
    clearLicenseCache();
  });

  it('preserves `this` when resolving permissions for available roles', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const auth = createMockAuth({ id: 'user-1', email: 'admin@test.com', name: 'Admin' });
    const rbac = new ClassBasedRBACProvider({
      roleMapping: {
        Engineering: ['agents:*', 'workflows:*'],
        Product: ['agents:read'],
        Admin: ['*'],
      },
    });

    const result = await buildCapabilities(auth as any, new Request('http://localhost'), {
      rbac,
    });

    expect('availableRoles' in result).toBe(true);
    // Admin role is filtered out (has admin-bypass), the other two remain.
    expect((result as any).availableRoles).toEqual(
      expect.arrayContaining([
        { id: 'Engineering', name: 'Engineering' },
        { id: 'Product', name: 'Product' },
      ]),
    );
    expect((result as any).availableRoles).not.toContainEqual({ id: 'Admin', name: 'Admin' });

    // Should not log the "failed to list permissions for role" warning that
    // surfaces when `this` is lost and `this.options` throws.
    const sawBindingWarning = warn.mock.calls.some(args =>
      String(args[0] ?? '').includes('failed to list permissions for role'),
    );
    expect(sawBindingWarning).toBe(false);

    warn.mockRestore();
  });
});
