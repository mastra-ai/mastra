/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MastraFGAWorkos, WorkOSFGAMembershipResolutionError } from './fga-provider';

// Use globalThis to share mock between factory (hoisted) and test code
vi.mock('@workos-inc/node', () => {
  const auth = {
    check: vi.fn(),
    listResourcesForMembership: vi.fn(),
    createResource: vi.fn(),
    getResource: vi.fn(),
    listResources: vi.fn(),
    updateResource: vi.fn(),
    deleteResource: vi.fn(),
    deleteResourceByExternalId: vi.fn(),
    assignRole: vi.fn(),
    removeRole: vi.fn(),
    listRoleAssignments: vi.fn(),
    listOrganizationRoles: vi.fn(),
  };
  (globalThis as any).__mockAuthorization = auth;
  return {
    WorkOS: class {
      authorization = auth;
      constructor(_apiKey: string, _options?: any) {}
    },
  };
});

vi.mock('@mastra/core/auth/ee', () => ({
  FGADeniedError: class FGADeniedError extends Error {
    user: any;
    resource: any;
    permission: string;
    constructor(user: any, resource: any, permission: string) {
      super(`FGA denied: ${permission}`);
      this.name = 'FGADeniedError';
      this.user = user;
      this.resource = resource;
      this.permission = permission;
    }
  },
}));

// Access the shared mock (set during vi.mock factory execution)
const mockAuthorization = (globalThis as any).__mockAuthorization;

const testUser = {
  id: 'user-1',
  workosId: 'user_01234567890',
  organizationId: 'org-123',
  organizationMembershipId: 'om-123',
  teamId: 'team-1',
};

describe('MastraFGAWorkos', () => {
  let fga: MastraFGAWorkos;

  beforeEach(() => {
    vi.clearAllMocks();
    fga = new MastraFGAWorkos({
      apiKey: 'sk_test_123',
      clientId: 'client_test_123',
      resourceMapping: {
        agent: { fgaResourceType: 'team', deriveId: (ctx: any) => ctx.user.teamId },
        workflow: { fgaResourceType: 'team', deriveId: (ctx: any) => ctx.user.teamId },
      },
      permissionMapping: {
        'agents:execute': 'manage-workflows',
        'workflows:execute': 'manage-workflows',
        'memory:read': 'read',
      },
    });
  });

  describe('constructor', () => {
    it('should throw when no API key provided', () => {
      const origKey = process.env.WORKOS_API_KEY;
      const origClient = process.env.WORKOS_CLIENT_ID;
      delete process.env.WORKOS_API_KEY;
      delete process.env.WORKOS_CLIENT_ID;

      expect(() => new MastraFGAWorkos({})).toThrow('WorkOS API key and client ID are required');

      if (origKey) process.env.WORKOS_API_KEY = origKey;
      if (origClient) process.env.WORKOS_CLIENT_ID = origClient;
    });

    it('should expose route policy options from the constructor', () => {
      const resolveRouteFGA = vi.fn();
      const validatePermissions = vi.fn();

      const configuredFGA = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        requireForProtectedRoutes: true,
        auditProtectedRoutes: 'error',
        resolveRouteFGA,
        validatePermissions,
      });

      expect(configuredFGA.requireForProtectedRoutes).toBe(true);
      expect(configuredFGA.auditProtectedRoutes).toBe('error');
      expect(configuredFGA.resolveRouteFGA).toBe(resolveRouteFGA);
      expect(configuredFGA.validatePermissions).toBe(validatePermissions);
    });
  });

  describe('check()', () => {
    it('should call workos.authorization.check with mapped permission', async () => {
      mockAuthorization.check.mockResolvedValue({ authorized: true });

      const result = await fga.check(testUser, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });

      expect(result).toBe(true);
      expect(mockAuthorization.check).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationMembershipId: 'om-123',
          permissionSlug: 'manage-workflows', // mapped from 'agents:execute'
        }),
      );
    });

    it('should return false when unauthorized', async () => {
      mockAuthorization.check.mockResolvedValue({ authorized: false });

      const result = await fga.check(testUser, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });

      expect(result).toBe(false);
    });

    it('should return false when WorkOS reports the resource is missing', async () => {
      mockAuthorization.check.mockRejectedValue({ code: 'entity_not_found' });

      const result = await fga.check(testUser, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });

      expect(result).toBe(false);
    });

    it('should use resourceMapping to derive resource ID', async () => {
      mockAuthorization.check.mockResolvedValue({ authorized: true });

      await fga.check(testUser, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });

      expect(mockAuthorization.check).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceExternalId: 'team-1', // derived from user.teamId
          resourceTypeSlug: 'team', // mapped from 'agent'
        }),
      );
    });

    it('should pass the raw resource ID into deriveId and fall back when deriveId returns undefined', async () => {
      mockAuthorization.check.mockResolvedValue({ authorized: true });
      const deriveId = vi.fn().mockReturnValue(undefined);
      const contextualFga = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        resourceMapping: {
          thread: { fgaResourceType: 'tenant-thread', deriveId },
        },
      });

      await contextualFga.check(testUser, {
        resource: { type: 'thread', id: 'thread-1' },
        permission: 'memory:read',
        context: { resourceId: 'tenant-a:thread-1' },
      });

      expect(deriveId).toHaveBeenCalledWith({
        user: testUser,
        resourceId: 'tenant-a:thread-1',
        requestContext: undefined,
      });
      expect(mockAuthorization.check).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceExternalId: 'thread-1',
          resourceTypeSlug: 'tenant-thread',
        }),
      );
    });

    it('should fall back to unmapped permission when no mapping exists', async () => {
      mockAuthorization.check.mockResolvedValue({ authorized: true });

      await fga.check(testUser, {
        resource: { type: 'tool', id: 'tool-1' },
        permission: 'tools:execute', // No mapping for this
      });

      expect(mockAuthorization.check).toHaveBeenCalledWith(
        expect.objectContaining({
          permissionSlug: 'tools:execute', // Falls through unmapped
        }),
      );
    });

    it('should honor the legacy memory mapping alias for thread checks', async () => {
      mockAuthorization.check.mockResolvedValue({ authorized: true });
      const legacyFga = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        resourceMapping: {
          memory: { fgaResourceType: 'workspace-thread', deriveId: ({ resourceId }: any) => resourceId },
        },
      });

      await legacyFga.check(testUser, {
        resource: { type: 'thread', id: 'thread-1' },
        permission: 'memory:read',
        context: { resourceId: 'tenant-a:thread-1' },
      });

      expect(mockAuthorization.check).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceExternalId: 'tenant-a:thread-1',
          resourceTypeSlug: 'workspace-thread',
        }),
      );
    });

    it('should return false when no organization membership ID found', async () => {
      const userWithoutMembership = { id: 'user-1' };
      const result = await fga.check(userWithoutMembership, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });

      expect(result).toBe(false);
      expect(mockAuthorization.check).not.toHaveBeenCalled();
    });

    it('should throw a typed membership resolution error from require when memberships were not loaded', async () => {
      const error = await fga
        .require({ id: 'user-1' } as any, {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:execute',
        })
        .catch(error => error);

      expect(error).toBeInstanceOf(WorkOSFGAMembershipResolutionError);
      expect(error.message).toContain('<redacted>');
      expect(error.message).not.toContain('user-1');

      expect(mockAuthorization.check).not.toHaveBeenCalled();
    });

    it('should throw a typed membership resolution error from require when configured organization membership is missing', async () => {
      const scopedFga = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        organizationId: 'org-expected',
      });

      await expect(
        scopedFga.require(
          {
            id: 'user-1',
            memberships: [{ id: 'om-other', organizationId: 'org-other' }],
          },
          {
            resource: { type: 'agent', id: 'agent-1' },
            permission: 'agents:execute',
          },
        ),
      ).rejects.toBeInstanceOf(WorkOSFGAMembershipResolutionError);

      expect(mockAuthorization.check).not.toHaveBeenCalled();
    });

    it('should not include raw identifiers in membership resolution warnings', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await fga.check({ id: 'user-1' } as any, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('<redacted>'));
      expect(warn.mock.calls.flat().join(' ')).not.toContain('user-1');

      warn.mockRestore();
    });

    it('should resolve membership from memberships array', async () => {
      mockAuthorization.check.mockResolvedValue({ authorized: true });
      const userWithMemberships = { id: 'user-1', memberships: [{ id: 'om-from-array' }] };

      await fga.check(userWithMemberships, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:execute',
      });

      expect(mockAuthorization.check).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationMembershipId: 'om-from-array',
        }),
      );
    });

    it('should deny when configured organizationId does not match any membership', async () => {
      const scopedFga = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        organizationId: 'org-expected',
      });

      const result = await scopedFga.check(
        {
          id: 'user-1',
          memberships: [{ id: 'om-other', organizationId: 'org-other' }],
        },
        {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:execute',
        },
      );

      expect(result).toBe(false);
      expect(mockAuthorization.check).not.toHaveBeenCalled();
    });
  });

  describe('require()', () => {
    it('should resolve when authorized', async () => {
      mockAuthorization.check.mockResolvedValue({ authorized: true });

      await expect(
        fga.require(testUser, {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:execute',
        }),
      ).resolves.toBeUndefined();
    });

    it('should throw FGADeniedError when unauthorized', async () => {
      mockAuthorization.check.mockResolvedValue({ authorized: false });

      await expect(
        fga.require(testUser, {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:execute',
        }),
      ).rejects.toThrow('FGA denied');
    });

    it('should throw WorkOSFGAResourceNotFoundError when WorkOS reports the resource is missing', async () => {
      // With publicByDefault=false (default), missing resources throw specific error
      mockAuthorization.check.mockRejectedValue({ status: 404, code: 'entity_not_found' });

      await expect(
        fga.require(testUser, {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:execute',
        }),
      ).rejects.toThrow('is not registered in WorkOS');
    });
  });

  describe('filterAccessible()', () => {
    it('should filter resources with a single listResourcesForMembership call when a parent mapping is configured', async () => {
      mockAuthorization.listResourcesForMembership.mockResolvedValue({
        data: [{ externalId: 'team-1:a-1' }, { externalId: 'team-1:a-2' }, { externalId: 'team-1:a-3' }],
        listMetadata: {},
      });
      const parentMappedFga = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        resourceMapping: {
          agent: {
            fgaResourceType: 'team-agent',
            parentFgaResourceType: 'team',
            deriveId: ({ user, resourceId }: any) => (resourceId ? `${user.teamId}:${resourceId}` : user.teamId),
          },
        },
      });

      const resources = [{ id: 'a-1' }, { id: 'a-2' }, { id: 'a-3' }];
      const result = await parentMappedFga.filterAccessible(testUser, resources, 'agent', 'agents:read');

      expect(result).toEqual(resources);
      expect(mockAuthorization.listResourcesForMembership).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationMembershipId: 'om-123',
          permissionSlug: 'agents:read',
          parentResourceExternalId: 'team-1',
          parentResourceTypeSlug: 'team',
        }),
      );
      expect(mockAuthorization.check).not.toHaveBeenCalled();
    });

    it('should compare batched results against mapped resource IDs', async () => {
      mockAuthorization.listResourcesForMembership.mockResolvedValue({
        data: [{ externalId: 'team-1:a-1' }],
        listMetadata: {},
      });
      const mappedFga = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        resourceMapping: {
          agent: {
            fgaResourceType: 'team-agent',
            parentFgaResourceType: 'team',
            deriveId: ({ user, resourceId }: any) => (resourceId ? `${user.teamId}:${resourceId}` : user.teamId),
          },
        },
      });

      const resources = [{ id: 'a-1' }, { id: 'a-2' }];
      const result = await mappedFga.filterAccessible(testUser, resources, 'agent', 'agents:read');

      expect(result).toEqual([{ id: 'a-1' }]);
    });

    it('should fall back to per-resource checks when parent type metadata is not configured', async () => {
      mockAuthorization.check.mockResolvedValueOnce({ authorized: true }).mockResolvedValueOnce({ authorized: false });
      const mappedFga = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        resourceMapping: {
          agent: {
            fgaResourceType: 'team-agent',
            deriveId: ({ user, resourceId }: any) => (resourceId ? `${user.teamId}:${resourceId}` : user.teamId),
          },
        },
      });

      const resources = [{ id: 'a-1' }, { id: 'a-2' }];
      const result = await mappedFga.filterAccessible(testUser, resources, 'agent', 'agents:read');

      expect(result).toEqual([{ id: 'a-1' }]);
      expect(mockAuthorization.listResourcesForMembership).not.toHaveBeenCalled();
      expect(mockAuthorization.check).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          resourceExternalId: 'team-1:a-1',
          resourceTypeSlug: 'team-agent',
        }),
      );
    });

    it('should fall back to per-resource checks when no parent mapping is configured', async () => {
      mockAuthorization.check.mockResolvedValueOnce({ authorized: true }).mockResolvedValueOnce({ authorized: false });

      const resources = [
        { id: 't-1', resourceId: 'tenant-a:thread-1' },
        { id: 't-2', resourceId: 'tenant-a:thread-2' },
      ];
      const result = await fga.filterAccessible(testUser, resources, 'tool', 'tools:read');

      expect(result).toEqual([{ id: 't-1', resourceId: 'tenant-a:thread-1' }]);
      expect(mockAuthorization.listResourcesForMembership).not.toHaveBeenCalled();
      expect(mockAuthorization.check).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          resourceExternalId: 't-1',
          resourceTypeSlug: 'tool',
        }),
      );
    });

    it('should limit fallback per-resource checks to five concurrent requests and preserve order', async () => {
      type DeferredCheck = { resolve: (value: { authorized: boolean }) => void };
      const deferredChecks: DeferredCheck[] = [];
      let activeChecks = 0;
      let maxConcurrentChecks = 0;

      mockAuthorization.check.mockImplementation(() => {
        activeChecks += 1;
        maxConcurrentChecks = Math.max(maxConcurrentChecks, activeChecks);

        let resolveCheck: DeferredCheck['resolve'] = () => {};
        const promise = new Promise<{ authorized: boolean }>(resolve => {
          resolveCheck = resolve;
        });
        deferredChecks.push({ resolve: resolveCheck });

        return promise.then(result => {
          activeChecks -= 1;
          return result;
        });
      });

      const resources = Array.from({ length: 12 }, (_, index) => ({ id: `t-${index + 1}` }));
      const resultPromise = fga.filterAccessible(testUser, resources, 'tool', 'tools:read');
      const waitForStartedChecks = async (expected: number) => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
          if (mockAuthorization.check.mock.calls.length === expected) return;
        }
        expect(mockAuthorization.check).toHaveBeenCalledTimes(expected);
      };

      await waitForStartedChecks(5);
      expect(maxConcurrentChecks).toBe(5);

      deferredChecks.slice(0, 5).forEach((deferred, index) => {
        deferred.resolve({ authorized: index % 2 === 0 });
      });

      await waitForStartedChecks(10);
      expect(maxConcurrentChecks).toBe(5);

      deferredChecks.slice(5, 10).forEach((deferred, index) => {
        deferred.resolve({ authorized: (index + 5) % 2 === 0 });
      });

      await waitForStartedChecks(12);
      expect(maxConcurrentChecks).toBe(5);

      deferredChecks.slice(10).forEach((deferred, index) => {
        deferred.resolve({ authorized: (index + 10) % 2 === 0 });
      });

      await expect(resultPromise).resolves.toEqual(resources.filter((_, index) => index % 2 === 0));
      expect(maxConcurrentChecks).toBe(5);
    });

    it('should pass thread resourceId context through per-resource filtering', async () => {
      mockAuthorization.check.mockResolvedValueOnce({ authorized: true }).mockResolvedValueOnce({ authorized: false });
      const deriveId = vi.fn(({ resourceId }: { resourceId?: string }) => resourceId);
      const threadFga = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        resourceMapping: {
          thread: { fgaResourceType: 'tenant-thread', deriveId },
        },
      });

      const resources = [
        { id: 'thread-1', resourceId: 'tenant-a:thread-1' },
        { id: 'thread-2', resourceId: 'tenant-a:thread-2' },
      ];
      const result = await threadFga.filterAccessible(testUser, resources, 'thread', 'memory:read');

      expect(result).toEqual([{ id: 'thread-1', resourceId: 'tenant-a:thread-1' }]);
      expect(deriveId).toHaveBeenNthCalledWith(1, {
        user: testUser,
        resourceId: 'tenant-a:thread-1',
        requestContext: undefined,
      });
      expect(deriveId).toHaveBeenNthCalledWith(2, {
        user: testUser,
        resourceId: 'tenant-a:thread-2',
        requestContext: undefined,
      });
      expect(mockAuthorization.check).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          resourceExternalId: 'tenant-a:thread-1',
          resourceTypeSlug: 'tenant-thread',
        }),
      );
    });

    it('should return empty array when no membership', async () => {
      const result = await fga.filterAccessible(
        { id: 'user-1' }, // No membership
        [{ id: 'a-1' }],
        'agent',
        'agents:read',
      );

      expect(result).toEqual([]);
    });

    it('should return empty array for empty input', async () => {
      const result = await fga.filterAccessible(testUser, [], 'agent', 'agents:read');
      expect(result).toEqual([]);
    });
  });

  describe('createResource()', () => {
    it('should create a resource via workos.authorization', async () => {
      const mockResource = {
        id: 'res-1',
        externalId: 'agent-1',
        name: 'My Agent',
        description: null,
        resourceTypeSlug: 'agent',
        organizationId: 'org-1',
        parentResourceId: null,
      };
      mockAuthorization.createResource.mockResolvedValue(mockResource);

      const result = await fga.createResource({
        externalId: 'agent-1',
        name: 'My Agent',
        resourceTypeSlug: 'agent',
        organizationId: 'org-1',
      });

      expect(result.id).toBe('res-1');
      expect(result.externalId).toBe('agent-1');
      expect(mockAuthorization.createResource).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: 'agent-1',
          name: 'My Agent',
          resourceTypeSlug: 'agent',
          organizationId: 'org-1',
        }),
      );
    });
  });

  describe('getResource()', () => {
    it('should get a resource by ID', async () => {
      const mockResource = {
        id: 'res-1',
        externalId: 'agent-1',
        name: 'My Agent',
        description: null,
        resourceTypeSlug: 'agent',
        organizationId: 'org-1',
        parentResourceId: null,
      };
      mockAuthorization.getResource.mockResolvedValue(mockResource);

      const result = await fga.getResource('res-1');
      expect(result.id).toBe('res-1');
      expect(mockAuthorization.getResource).toHaveBeenCalledWith('res-1');
    });
  });

  describe('listResources()', () => {
    it('should list resources with filters', async () => {
      mockAuthorization.listResources.mockResolvedValue({ data: [] });

      await fga.listResources({ organizationId: 'org-1', resourceTypeSlug: 'agent' });
      expect(mockAuthorization.listResources).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          resourceTypeSlug: 'agent',
        }),
      );
    });
  });

  describe('updateResource()', () => {
    it('should update a resource', async () => {
      mockAuthorization.updateResource.mockResolvedValue({
        id: 'res-1',
        externalId: 'agent-1',
        name: 'Updated',
        description: null,
        resourceTypeSlug: 'agent',
        organizationId: 'org-1',
        parentResourceId: null,
      });

      const result = await fga.updateResource({ resourceId: 'res-1', name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteResource()', () => {
    it('should delete by resource ID', async () => {
      mockAuthorization.deleteResource.mockResolvedValue(undefined);

      await fga.deleteResource({ resourceId: 'res-1' });
      expect(mockAuthorization.deleteResource).toHaveBeenCalledWith({ resourceId: 'res-1' });
    });

    it('should delete by external ID and type', async () => {
      mockAuthorization.deleteResourceByExternalId.mockResolvedValue(undefined);

      await fga.deleteResource({ externalId: 'agent-1', resourceTypeSlug: 'agent', organizationId: 'org-1' });
      expect(mockAuthorization.deleteResourceByExternalId).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: 'agent-1',
          resourceTypeSlug: 'agent',
          organizationId: 'org-1',
        }),
      );
    });
  });

  describe('assignRole()', () => {
    it('should assign a role on a resource', async () => {
      mockAuthorization.assignRole.mockResolvedValue({
        id: 'ra-1',
        role: { slug: 'editor' },
        resource: { id: 'res-1', externalId: 'agent-1', resourceTypeSlug: 'agent' },
      });

      const result = await fga.assignRole({
        organizationMembershipId: 'om-123',
        roleSlug: 'editor',
        resourceId: 'res-1',
      });

      expect(result.id).toBe('ra-1');
      expect(result.role.slug).toBe('editor');
      expect(mockAuthorization.assignRole).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationMembershipId: 'om-123',
          roleSlug: 'editor',
          resourceId: 'res-1',
        }),
      );
    });
  });

  describe('removeRole()', () => {
    it('should remove a role assignment', async () => {
      mockAuthorization.removeRole.mockResolvedValue(undefined);

      await fga.removeRole({
        organizationMembershipId: 'om-123',
        roleSlug: 'editor',
        resourceId: 'res-1',
      });

      expect(mockAuthorization.removeRole).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationMembershipId: 'om-123',
          roleSlug: 'editor',
          resourceId: 'res-1',
        }),
      );
    });
  });

  describe('listRoleAssignments()', () => {
    it('should list role assignments for a membership', async () => {
      mockAuthorization.listRoleAssignments.mockResolvedValue({
        data: [
          {
            id: 'ra-1',
            role: { slug: 'editor' },
            resource: { id: 'res-1', externalId: 'agent-1', resourceTypeSlug: 'agent' },
          },
        ],
      });

      const result = await fga.listRoleAssignments({ organizationMembershipId: 'om-123' });
      expect(result).toHaveLength(1);
      expect(result[0].role.slug).toBe('editor');
    });
  });

  describe('describeResourceTypes()', () => {
    it('should derive resource types from roles and resources', async () => {
      // Mock roles response
      mockAuthorization.listOrganizationRoles.mockResolvedValue({
        data: [
          { slug: 'viewer', resourceTypeSlug: 'agent', type: 'EnvironmentRole' },
          { slug: 'operator', resourceTypeSlug: 'agent', type: 'EnvironmentRole' },
          { slug: 'team-admin', resourceTypeSlug: 'team', type: 'OrganizationRole' },
          { slug: 'team-viewer', resourceTypeSlug: 'team', type: 'EnvironmentRole' },
        ],
      });

      // Mock resources response (with hierarchy)
      mockAuthorization.listResources.mockResolvedValue({
        data: [
          { id: 'team-1', resourceTypeSlug: 'team', parentResourceId: null },
          { id: 'agent-1', resourceTypeSlug: 'agent', parentResourceId: 'team-1' },
          { id: 'agent-2', resourceTypeSlug: 'agent', parentResourceId: 'team-1' },
        ],
        listMetadata: { after: undefined },
      });

      const result = await fga.describeResourceTypes('org-123');

      // Should have both types
      expect(result).toHaveLength(2);

      // Agent type
      const agentType = result.find(t => t.slug === 'agent');
      expect(agentType).toBeDefined();
      expect(agentType!.relations).toEqual(['viewer', 'operator']);
      expect(agentType!.customRelations).toEqual([]);
      expect(agentType!.parentResourceTypeSlugs).toEqual(['team']);
      expect(agentType!.hasInstances).toBe(true);

      // Team type
      const teamType = result.find(t => t.slug === 'team');
      expect(teamType).toBeDefined();
      expect(teamType!.relations).toEqual(['team-admin', 'team-viewer']);
      expect(teamType!.customRelations).toEqual(['team-admin']); // OrganizationRole
      expect(teamType!.parentResourceTypeSlugs).toEqual([]);
      expect(teamType!.hasInstances).toBe(true);
    });

    it('should handle types with roles but no instances', async () => {
      mockAuthorization.listOrganizationRoles.mockResolvedValue({
        data: [{ slug: 'viewer', resourceTypeSlug: 'workflow', type: 'EnvironmentRole' }],
      });
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      const result = await fga.describeResourceTypes('org-123');

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('workflow');
      expect(result[0].relations).toEqual(['viewer']);
      expect(result[0].hasInstances).toBe(false);
    });

    it('should paginate through resources', async () => {
      mockAuthorization.listOrganizationRoles.mockResolvedValue({ data: [] });

      // First page
      mockAuthorization.listResources
        .mockResolvedValueOnce({
          data: [{ id: 'agent-1', resourceTypeSlug: 'agent' }],
          listMetadata: { after: 'cursor-1' },
        })
        // Second page
        .mockResolvedValueOnce({
          data: [{ id: 'agent-2', resourceTypeSlug: 'agent' }],
          listMetadata: { after: undefined },
        });

      const result = await fga.describeResourceTypes('org-123');

      expect(mockAuthorization.listResources).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0].hasInstances).toBe(true);
    });
  });

  describe('registerResource', () => {
    let fgaWithOwnership: MastraFGAWorkos;

    beforeEach(() => {
      vi.clearAllMocks();
      fgaWithOwnership = new MastraFGAWorkos({
        apiKey: 'test-key',
        clientId: 'test-client',
        organizationId: 'org-123',
        ownership: {
          enabled: true,
          ownerRole: 'owner',
          fallbackRoles: ['admin', 'editor'],
        },
      });
    });

    it('should register resource and assign owner role when type and role exist', async () => {
      // Mock describeResourceTypes
      mockAuthorization.listOrganizationRoles.mockResolvedValue({
        data: [
          { slug: 'owner', resourceTypeSlug: 'agent', type: 'OrganizationRole' },
          { slug: 'viewer', resourceTypeSlug: 'agent', type: 'EnvironmentRole' },
        ],
      });
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      // Mock createResource
      mockAuthorization.createResource.mockResolvedValue({
        id: 'fga-agent-1',
        resourceTypeSlug: 'agent',
        externalId: 'my-agent',
        name: 'My Agent',
        organizationId: 'org-123',
      });

      // Mock assignRole
      mockAuthorization.assignRole.mockResolvedValue({
        id: 'role-assignment-1',
        role: { slug: 'owner', id: 'role-1' },
        resource: {
          id: 'fga-agent-1',
          externalId: 'my-agent',
          resourceTypeSlug: 'agent',
        },
      });

      const result = await fgaWithOwnership.registerResource({
        user: testUser,
        resourceType: 'agent',
        resourceId: 'my-agent',
        name: 'My Agent',
      });

      expect(result.resource).not.toBeNull();
      expect(result.resource?.id).toBe('fga-agent-1');
      expect(result.ownerAssignment).not.toBeNull();
      expect(result.ownerAssignment?.role?.slug).toBe('owner');
      expect(result.warnings).toHaveLength(0);
    });

    it('should use fallback role when owner role not found', async () => {
      // Mock describeResourceTypes - no 'owner' role, but 'editor' exists
      mockAuthorization.listOrganizationRoles.mockResolvedValue({
        data: [{ slug: 'editor', resourceTypeSlug: 'agent', type: 'EnvironmentRole' }],
      });
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      // Mock createResource
      mockAuthorization.createResource.mockResolvedValue({
        id: 'fga-agent-1',
        resourceTypeSlug: 'agent',
        externalId: 'my-agent',
        name: 'My Agent',
        organizationId: 'org-123',
      });

      // Mock assignRole
      mockAuthorization.assignRole.mockResolvedValue({
        id: 'role-assignment-1',
        role: { slug: 'editor', id: 'role-1' },
        resource: {
          id: 'fga-agent-1',
          externalId: 'my-agent',
          resourceTypeSlug: 'agent',
        },
      });

      const result = await fgaWithOwnership.registerResource({
        user: testUser,
        resourceType: 'agent',
        resourceId: 'my-agent',
        name: 'My Agent',
      });

      expect(result.resource).not.toBeNull();
      expect(result.ownerAssignment).not.toBeNull();
      expect(result.ownerAssignment?.role?.slug).toBe('editor');
      expect(result.warnings).toContainEqual(expect.stringContaining("Using 'editor' instead"));
    });

    it('should return null resource and warning when type not found', async () => {
      // Mock describeResourceTypes - empty, no types
      mockAuthorization.listOrganizationRoles.mockResolvedValue({ data: [] });
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      const result = await fgaWithOwnership.registerResource({
        user: testUser,
        resourceType: 'agent',
        resourceId: 'my-agent',
        name: 'My Agent',
      });

      expect(result.resource).toBeNull();
      expect(result.ownerAssignment).toBeNull();
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("Resource type 'agent' not found");
    });

    it('should skip ownership when skipOwnership is true', async () => {
      // Mock describeResourceTypes
      mockAuthorization.listOrganizationRoles.mockResolvedValue({
        data: [{ slug: 'owner', resourceTypeSlug: 'agent', type: 'OrganizationRole' }],
      });
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      // Mock createResource
      mockAuthorization.createResource.mockResolvedValue({
        id: 'fga-agent-1',
        resourceTypeSlug: 'agent',
        externalId: 'my-agent',
        name: 'My Agent',
        organizationId: 'org-123',
      });

      const result = await fgaWithOwnership.registerResource({
        user: testUser,
        resourceType: 'agent',
        resourceId: 'my-agent',
        name: 'My Agent',
        skipOwnership: true,
      });

      expect(result.resource).not.toBeNull();
      expect(result.ownerAssignment).toBeNull();
      expect(mockAuthorization.assignRole).not.toHaveBeenCalled();
    });

    it('should create resource with parent hierarchy', async () => {
      // Mock describeResourceTypes with team and agent types
      mockAuthorization.listOrganizationRoles.mockResolvedValue({
        data: [
          { slug: 'owner', resourceTypeSlug: 'agent', type: 'OrganizationRole' },
          { slug: 'admin', resourceTypeSlug: 'team', type: 'OrganizationRole' },
        ],
      });
      mockAuthorization.listResources.mockResolvedValue({
        data: [{ id: 'fga-team-1', resourceTypeSlug: 'team', externalId: 'sales-team' }],
        listMetadata: { after: undefined },
      });

      // Mock createResource
      mockAuthorization.createResource.mockResolvedValue({
        id: 'fga-agent-1',
        resourceTypeSlug: 'agent',
        externalId: 'my-agent',
        name: 'My Agent',
        organizationId: 'org-123',
        parentResourceId: 'fga-team-1',
      });

      // Mock assignRole
      mockAuthorization.assignRole.mockResolvedValue({
        id: 'role-assignment-1',
        role: { slug: 'owner', id: 'role-1' },
        resource: {
          id: 'fga-agent-1',
          externalId: 'my-agent',
          resourceTypeSlug: 'agent',
        },
      });

      const result = await fgaWithOwnership.registerResource({
        user: testUser,
        resourceType: 'agent',
        resourceId: 'my-agent',
        name: 'My Agent',
        parentResource: { type: 'team', id: 'sales-team' },
      });

      expect(result.resource).not.toBeNull();
      expect(mockAuthorization.createResource).toHaveBeenCalledWith(
        expect.objectContaining({
          parentResourceId: 'fga-team-1',
        }),
      );
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn when parent resource not found', async () => {
      // Mock describeResourceTypes with team and agent types
      mockAuthorization.listOrganizationRoles.mockResolvedValue({
        data: [
          { slug: 'owner', resourceTypeSlug: 'agent', type: 'OrganizationRole' },
          { slug: 'admin', resourceTypeSlug: 'team', type: 'OrganizationRole' },
        ],
      });
      // No team resources exist
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      // Mock createResource (without parent)
      mockAuthorization.createResource.mockResolvedValue({
        id: 'fga-agent-1',
        resourceTypeSlug: 'agent',
        externalId: 'my-agent',
        name: 'My Agent',
        organizationId: 'org-123',
      });

      // Mock assignRole
      mockAuthorization.assignRole.mockResolvedValue({
        id: 'role-assignment-1',
        role: { slug: 'owner', id: 'role-1' },
        resource: {
          id: 'fga-agent-1',
          externalId: 'my-agent',
          resourceTypeSlug: 'agent',
        },
      });

      const result = await fgaWithOwnership.registerResource({
        user: testUser,
        resourceType: 'agent',
        resourceId: 'my-agent',
        name: 'My Agent',
        parentResource: { type: 'team', id: 'nonexistent-team' },
      });

      expect(result.resource).not.toBeNull();
      expect(result.warnings).toContainEqual(expect.stringContaining('not found in FGA'));
    });
  });

  describe('hasResourceType', () => {
    it('should return true when type exists', async () => {
      mockAuthorization.listOrganizationRoles.mockResolvedValue({
        data: [{ slug: 'viewer', resourceTypeSlug: 'agent', type: 'EnvironmentRole' }],
      });
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      const result = await fga.hasResourceType('org-123', 'agent');
      expect(result).toBe(true);
    });

    it('should return false when type does not exist', async () => {
      mockAuthorization.listOrganizationRoles.mockResolvedValue({ data: [] });
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      const result = await fga.hasResourceType('org-123', 'nonexistent');
      expect(result).toBe(false);
    });
  });

  // Regression tests for CodeRabbit review comments
  describe('regression: unresolved membership with publicByDefault', () => {
    it('should deny access when membership cannot be resolved even with publicByDefault=true', async () => {
      const fgaPublicByDefault = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        publicByDefault: true,
        resourceMapping: {},
        permissionMapping: {},
      });

      // User without organizationMembershipId
      const userWithoutMembership = {
        id: 'user-1',
        workosId: 'user_01234567890',
        // No organizationMembershipId
      };

      // check() should return false when membership cannot be resolved
      // (publicByDefault should NOT grant access when the issue is membership, not resource existence)
      const result = await fgaPublicByDefault.check(userWithoutMembership, {
        resource: { type: 'agent', id: 'agent-1' },
        permission: 'agents:read',
      });

      expect(result).toBe(false);
      // Should NOT have called WorkOS API since we couldn't resolve membership
      expect(mockAuthorization.check).not.toHaveBeenCalled();
    });

    it('should throw membership error in require() when membership cannot be resolved', async () => {
      const fgaPublicByDefault = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        publicByDefault: true,
        resourceMapping: {},
        permissionMapping: {},
      });

      const userWithoutMembership = {
        id: 'user-1',
        workosId: 'user_01234567890',
      };

      await expect(
        fgaPublicByDefault.require(userWithoutMembership, {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:read',
        }),
      ).rejects.toThrow(WorkOSFGAMembershipResolutionError);
    });
  });

  describe('regression: describeResourceTypes cache should be org-scoped', () => {
    it('should cache resource types per organization', async () => {
      // Setup: org-1 has agent type, org-2 has workflow type
      mockAuthorization.listOrganizationRoles
        .mockResolvedValueOnce({
          data: [{ slug: 'viewer', resourceTypeSlug: 'agent', type: 'EnvironmentRole' }],
        })
        .mockResolvedValueOnce({
          data: [{ slug: 'operator', resourceTypeSlug: 'workflow', type: 'EnvironmentRole' }],
        });
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      // First call for org-1
      const typesOrg1 = await fga.describeResourceTypes('org-1');
      expect(typesOrg1).toHaveLength(1);
      expect(typesOrg1[0].slug).toBe('agent');

      // Second call for org-2 should NOT return org-1's cached types
      const typesOrg2 = await fga.describeResourceTypes('org-2');
      expect(typesOrg2).toHaveLength(1);
      expect(typesOrg2[0].slug).toBe('workflow');

      // Verify both orgs were queried
      expect(mockAuthorization.listOrganizationRoles).toHaveBeenCalledTimes(2);
      expect(mockAuthorization.listOrganizationRoles).toHaveBeenCalledWith('org-1');
      expect(mockAuthorization.listOrganizationRoles).toHaveBeenCalledWith('org-2');
    });

    it('should use cached result for same organization', async () => {
      mockAuthorization.listOrganizationRoles.mockResolvedValue({
        data: [{ slug: 'viewer', resourceTypeSlug: 'agent', type: 'EnvironmentRole' }],
      });
      mockAuthorization.listResources.mockResolvedValue({
        data: [],
        listMetadata: { after: undefined },
      });

      // First call
      await fga.describeResourceTypes('org-1');
      // Second call (should use cache)
      await fga.describeResourceTypes('org-1');

      // Should only have called API once
      expect(mockAuthorization.listOrganizationRoles).toHaveBeenCalledTimes(1);
    });
  });

  describe('regression: require() should respect publicByDefault', () => {
    it('should allow access when resource not found and publicByDefault=true', async () => {
      const fgaPublicByDefault = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        publicByDefault: true,
        resourceMapping: {},
        permissionMapping: {},
      });

      // Simulate resource not found
      mockAuthorization.check.mockRejectedValue({ status: 404, code: 'entity_not_found' });

      // Should NOT throw - publicByDefault should allow access
      await expect(
        fgaPublicByDefault.require(testUser, {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:read',
        }),
      ).resolves.toBeUndefined();
    });

    it('should throw WorkOSFGAResourceNotFoundError when resource not found and publicByDefault=false', async () => {
      const fgaPrivateByDefault = new MastraFGAWorkos({
        apiKey: 'sk_test_123',
        clientId: 'client_test_123',
        publicByDefault: false,
        resourceMapping: {},
        permissionMapping: {},
      });

      // Simulate resource not found
      mockAuthorization.check.mockRejectedValue({ status: 404, code: 'entity_not_found' });

      // Should throw specific error
      await expect(
        fgaPrivateByDefault.require(testUser, {
          resource: { type: 'agent', id: 'agent-1' },
          permission: 'agents:read',
        }),
      ).rejects.toThrow('is not registered in WorkOS');
    });
  });
});
