/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, vi } from 'vitest';

import type { IFGAProvider, IFGAManager } from '../fga';

function createMockFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: vi.fn().mockResolvedValue(undefined),
    filterAccessible: vi.fn().mockImplementation(async (_user, resources) => resources),
  };
}

function createMockFGAManager(authorized = true): IFGAManager {
  return {
    ...createMockFGAProvider(authorized),
    createResource: vi.fn().mockResolvedValue({
      id: 'res-1',
      externalId: 'ext-1',
      name: 'Test Resource',
      resourceTypeSlug: 'team',
      organizationId: 'org-1',
    }),
    updateResource: vi.fn().mockResolvedValue({
      id: 'res-1',
      externalId: 'ext-1',
      name: 'Updated Resource',
      resourceTypeSlug: 'team',
      organizationId: 'org-1',
    }),
    deleteResource: vi.fn().mockResolvedValue(undefined),
    listResources: vi.fn().mockResolvedValue([]),
    assignRole: vi.fn().mockResolvedValue({
      id: 'ra-1',
      role: { slug: 'admin' },
      resource: { id: 'res-1', externalId: 'ext-1', resourceTypeSlug: 'team' },
    }),
    removeRole: vi.fn().mockResolvedValue(undefined),
    listRoleAssignments: vi.fn().mockResolvedValue([]),
  };
}

describe('IFGAProvider interface', () => {
  const user = { id: 'user-1', organizationMembershipId: 'om-1' };

  describe('check()', () => {
    it('should return true when authorized', async () => {
      const provider = createMockFGAProvider(true);
      const result = await provider.check(user, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });
      expect(result).toBe(true);
      expect(provider.check).toHaveBeenCalledWith(user, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });
    });

    it('should return false when not authorized', async () => {
      const provider = createMockFGAProvider(false);
      const result = await provider.check(user, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });
      expect(result).toBe(false);
    });
  });

  describe('require()', () => {
    it('should not throw when authorized', async () => {
      const provider = createMockFGAProvider(true);
      await expect(
        provider.require(user, {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:execute',
        }),
      ).resolves.toBeUndefined();
    });

    it('should throw when not authorized', async () => {
      const provider: IFGAProvider = {
        check: vi.fn().mockResolvedValue(false),
        require: vi.fn().mockRejectedValue(new Error('FGA denied')),
        filterAccessible: vi.fn(),
      };
      await expect(
        provider.require(user, {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:execute',
        }),
      ).rejects.toThrow('FGA denied');
    });
  });

  describe('filterAccessible()', () => {
    it('should filter resources based on permissions', async () => {
      const resources = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
      const provider: IFGAProvider = {
        check: vi.fn(),
        require: vi.fn(),
        filterAccessible: vi.fn().mockResolvedValue([resources[0], resources[2]]),
      };

      const result = await provider.filterAccessible(user, resources, 'agent', 'agents:read');
      expect(result).toEqual([{ id: 'a1' }, { id: 'a3' }]);
      expect(provider.filterAccessible).toHaveBeenCalledWith(user, resources, 'agent', 'agents:read');
    });
  });
});

describe('IFGAManager interface', () => {
  const _user = { id: 'user-1', organizationMembershipId: 'om-1' };

  describe('createResource()', () => {
    it('should create a resource', async () => {
      const manager = createMockFGAManager();
      const result = await manager.createResource({
        externalId: 'ext-1',
        name: 'Test Resource',
        resourceTypeSlug: 'team',
        organizationId: 'org-1',
      });
      expect(result.id).toBe('res-1');
      expect(result.externalId).toBe('ext-1');
      expect(result.resourceTypeSlug).toBe('team');
    });
  });

  describe('updateResource()', () => {
    it('should update a resource', async () => {
      const manager = createMockFGAManager();
      const result = await manager.updateResource({
        resourceId: 'res-1',
        name: 'Updated Resource',
      });
      expect(result.name).toBe('Updated Resource');
    });
  });

  describe('deleteResource()', () => {
    it('should delete by resource ID', async () => {
      const manager = createMockFGAManager();
      await manager.deleteResource({ resourceId: 'res-1' });
      expect(manager.deleteResource).toHaveBeenCalledWith({ resourceId: 'res-1' });
    });

    it('should delete by external ID', async () => {
      const manager = createMockFGAManager();
      await manager.deleteResource({ resourceExternalId: 'ext-1', resourceTypeSlug: 'team' });
      expect(manager.deleteResource).toHaveBeenCalledWith({
        resourceExternalId: 'ext-1',
        resourceTypeSlug: 'team',
      });
    });
  });

  describe('assignRole()', () => {
    it('should assign a role on a resource', async () => {
      const manager = createMockFGAManager();
      const result = await manager.assignRole({
        organizationMembershipId: 'om-1',
        roleSlug: 'admin',
        resource: { resourceId: 'res-1' },
      });
      expect(result.role.slug).toBe('admin');
      expect(result.resource.id).toBe('res-1');
    });
  });

  describe('removeRole()', () => {
    it('should remove a role assignment', async () => {
      const manager = createMockFGAManager();
      await manager.removeRole({
        organizationMembershipId: 'om-1',
        roleSlug: 'admin',
        resource: { resourceId: 'res-1' },
      });
      expect(manager.removeRole).toHaveBeenCalled();
    });
  });

  describe('listRoleAssignments()', () => {
    it('should list assignments for a membership', async () => {
      const manager = createMockFGAManager();
      const result = await manager.listRoleAssignments({ organizationMembershipId: 'om-1' });
      expect(result).toEqual([]);
    });
  });

  describe('listResources()', () => {
    it('should list resources with options', async () => {
      const manager = createMockFGAManager();
      const result = await manager.listResources({ organizationId: 'org-1', resourceTypeSlug: 'team' });
      expect(result).toEqual([]);
    });
  });
});
