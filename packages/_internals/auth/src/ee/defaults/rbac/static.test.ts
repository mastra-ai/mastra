import { describe, it, expect } from 'vitest';

import { StaticRBACProvider } from './static';

describe('StaticRBACProvider', () => {
  describe('getAvailableRoles', () => {
    it('returns roles from roleMapping (excluding _default)', async () => {
      const provider = new StaticRBACProvider({
        roleMapping: {
          admin: ['*'],
          member: ['*:read', '*:execute'],
          viewer: ['*:read'],
          _default: [],
        },
        getUserRoles: () => ['admin'],
      });

      const roles = await provider.getAvailableRoles();
      expect(roles).toEqual([
        { id: 'admin', name: 'admin' },
        { id: 'member', name: 'member' },
        { id: 'viewer', name: 'viewer' },
      ]);
    });

    it('returns roles from role definitions', async () => {
      const provider = new StaticRBACProvider({
        roles: [
          { id: 'admin', name: 'Admin', permissions: ['*'] },
          { id: 'viewer', name: 'Viewer', permissions: ['*:read'] },
        ],
        getUserRoles: () => ['admin'],
      });

      const roles = await provider.getAvailableRoles();
      expect(roles).toEqual([
        { id: 'admin', name: 'Admin' },
        { id: 'viewer', name: 'Viewer' },
      ]);
    });
  });

  describe('getPermissionsForRole', () => {
    it('resolves permissions from roleMapping', async () => {
      const provider = new StaticRBACProvider({
        roleMapping: {
          admin: ['*'],
          member: ['*:read', '*:execute'],
          _default: [],
        },
        getUserRoles: () => ['admin'],
      });

      expect(await provider.getPermissionsForRole('admin')).toEqual(['*']);
      expect(await provider.getPermissionsForRole('member')).toEqual(['*:read', '*:execute']);
    });

    it('resolves permissions from role definitions', async () => {
      const provider = new StaticRBACProvider({
        roles: [
          { id: 'admin', name: 'Admin', permissions: ['*'] },
          { id: 'viewer', name: 'Viewer', permissions: ['*:read'] },
        ],
        getUserRoles: () => ['admin'],
      });

      expect(await provider.getPermissionsForRole('admin')).toEqual(['*']);
      expect(await provider.getPermissionsForRole('viewer')).toEqual(['*:read']);
    });

    it('returns empty for unknown role', async () => {
      const provider = new StaticRBACProvider({
        roleMapping: {
          admin: ['*'],
          _default: [],
        },
        getUserRoles: () => ['admin'],
      });

      expect(await provider.getPermissionsForRole('unknown')).toEqual([]);
    });
  });

  describe('getPermissions', () => {
    it('does not reorder the roles array returned by getUserRoles', async () => {
      const user = { roles: ['viewer', 'admin'] };
      const provider = new StaticRBACProvider<typeof user>({
        roleMapping: { admin: ['*'], viewer: ['*:read'] },
        getUserRoles: u => u.roles,
      });

      await provider.getPermissions(user);

      expect(user.roles).toEqual(['viewer', 'admin']);
    });

    it('accepts a frozen roles array from getUserRoles', async () => {
      const roles = Object.freeze(['viewer', 'admin']) as string[];
      const provider = new StaticRBACProvider({
        roleMapping: { admin: ['*'], viewer: ['*:read'] },
        getUserRoles: () => roles,
      });

      await expect(provider.getPermissions({})).resolves.toEqual(expect.arrayContaining(['*', '*:read']));
    });

    it('shares the cache across role orderings', async () => {
      let roles = ['viewer', 'admin'];
      const provider = new StaticRBACProvider({
        roleMapping: { admin: ['*'], viewer: ['*:read'] },
        getUserRoles: () => roles,
      });

      const first = await provider.getPermissions({});
      roles = ['admin', 'viewer'];
      const second = await provider.getPermissions({});

      expect(second).toBe(first);
    });
  });
});
