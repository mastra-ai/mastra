import { describe, it, expect } from 'vitest';

import { SYSTEM_ROLES, getSystemRole, roleHasPermission, ALL_PERMISSIONS } from '../../rbac/roles';
import { RBACResource, RBACAction } from '../../rbac/types';

describe('RBAC Roles', () => {
  describe('SYSTEM_ROLES', () => {
    it('should have four system roles', () => {
      expect(Object.keys(SYSTEM_ROLES)).toHaveLength(4);
      expect(SYSTEM_ROLES).toHaveProperty('owner');
      expect(SYSTEM_ROLES).toHaveProperty('admin');
      expect(SYSTEM_ROLES).toHaveProperty('developer');
      expect(SYSTEM_ROLES).toHaveProperty('viewer');
    });

    it('owner should have all permissions', () => {
      const owner = SYSTEM_ROLES['owner'];
      expect(owner?.permissions).toEqual(ALL_PERMISSIONS);
    });

    it('viewer should have limited permissions', () => {
      const viewer = SYSTEM_ROLES['viewer'];
      expect(viewer?.permissions).not.toEqual(ALL_PERMISSIONS);
      // Viewer should be able to read
      expect(viewer?.permissions.some(p => p.includes(':read'))).toBe(true);
      // Viewer should not be able to delete
      expect(viewer?.permissions.some(p => p.includes(':delete'))).toBe(false);
    });
  });

  describe('getSystemRole', () => {
    it('should return the correct role', () => {
      const owner = getSystemRole('owner');
      expect(owner).toBe(SYSTEM_ROLES['owner']);
    });

    it('should return undefined for invalid role', () => {
      const invalid = getSystemRole('invalid');
      expect(invalid).toBeUndefined();
    });
  });

  describe('roleHasPermission', () => {
    it('owner should have all permissions', () => {
      const owner = getSystemRole('owner')!;
      expect(roleHasPermission(owner, `${RBACResource.TEAM}:${RBACAction.DELETE}`)).toBe(true);
      expect(roleHasPermission(owner, `${RBACResource.PROJECT}:${RBACAction.CREATE}`)).toBe(true);
      expect(roleHasPermission(owner, `${RBACResource.DEPLOYMENT}:${RBACAction.DEPLOY}`)).toBe(true);
    });

    it('developer should be able to deploy', () => {
      const developer = getSystemRole('developer')!;
      expect(roleHasPermission(developer, `${RBACResource.DEPLOYMENT}:${RBACAction.DEPLOY}`)).toBe(true);
    });

    it('viewer should not be able to deploy', () => {
      const viewer = getSystemRole('viewer')!;
      expect(roleHasPermission(viewer, `${RBACResource.DEPLOYMENT}:${RBACAction.DEPLOY}`)).toBe(false);
    });

    it('viewer should be able to read', () => {
      const viewer = getSystemRole('viewer')!;
      expect(roleHasPermission(viewer, `${RBACResource.PROJECT}:${RBACAction.READ}`)).toBe(true);
      expect(roleHasPermission(viewer, `${RBACResource.DEPLOYMENT}:${RBACAction.READ}`)).toBe(true);
    });
  });
});
