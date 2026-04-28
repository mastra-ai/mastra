/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FGADeniedError } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';

function createMockFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi
          .fn()
          .mockRejectedValue(new FGADeniedError({ id: 'user-1' }, { type: 'thread', id: 'thread-123' }, 'memory:read')),
    filterAccessible: vi.fn(),
  };
}

/**
 * Test the checkThreadFGA logic directly.
 * Mirrors MastraMemory.checkThreadFGA static helper.
 */
async function checkThreadFGA(options: {
  mastra?: any;
  user: any;
  threadId: string;
  resourceId?: string;
  requestContext?: any;
  permission?: string;
}): Promise<void> {
  const { mastra, user, threadId, resourceId, requestContext, permission = 'memory:read' } = options;
  const fgaProvider = mastra?.getServer()?.fga;
  if (!fgaProvider) return;

  const { checkFGA } = await import('../../auth/ee/fga-check');
  await checkFGA({
    fgaProvider,
    user,
    resource: { type: 'thread', id: threadId },
    permission,
    context:
      resourceId || requestContext
        ? {
            resourceId,
            requestContext,
          }
        : undefined,
  });
}

describe('Memory FGA checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkThreadFGA helper', () => {
    it('should call FGA provider require with correct params for thread read', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = { getServer: () => ({ fga: fgaProvider }) };
      const user = {
        id: 'user-1',
        organizationMembershipId: 'om-1',
        memberships: [{ id: 'om-1', organizationId: 'org-1' }],
      };

      await checkThreadFGA({
        mastra,
        user,
        threadId: 'thread-123',
        permission: 'memory:read',
      });

      expect(fgaProvider.require).toHaveBeenCalledWith(user, {
        resource: { type: 'thread', id: 'thread-123' },
        permission: 'memory:read',
      });
    });

    it('should call FGA provider require with correct params for thread write', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = { getServer: () => ({ fga: fgaProvider }) };

      await checkThreadFGA({
        mastra,
        user: { id: 'user-1' },
        threadId: 'thread-456',
        permission: 'memory:write',
      });

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1' },
        { resource: { type: 'thread', id: 'thread-456' }, permission: 'memory:write' },
      );
    });

    it('should throw FGADeniedError when check fails', async () => {
      const fgaProvider = createMockFGAProvider(false);
      const mastra = { getServer: () => ({ fga: fgaProvider }) };

      await expect(
        checkThreadFGA({
          mastra,
          user: { id: 'user-1' },
          threadId: 'thread-123',
          permission: 'memory:read',
        }),
      ).rejects.toThrow(FGADeniedError);
    });

    it('should be a no-op when no FGA provider configured', async () => {
      const mastra = { getServer: () => ({}) };

      await checkThreadFGA({
        mastra,
        user: { id: 'user-1' },
        threadId: 'thread-123',
      });
    });

    it('should be a no-op when no mastra instance available', async () => {
      await checkThreadFGA({
        mastra: undefined,
        user: { id: 'user-1' },
        threadId: 'thread-123',
      });
    });

    it('should support delete permission', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = { getServer: () => ({ fga: fgaProvider }) };

      await checkThreadFGA({
        mastra,
        user: { id: 'user-1' },
        threadId: 'thread-789',
        permission: 'memory:delete',
      });

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1' },
        { resource: { type: 'thread', id: 'thread-789' }, permission: 'memory:delete' },
      );
    });

    it('should forward thread resource context when available', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = { getServer: () => ({ fga: fgaProvider }) };
      const requestContext = { get: vi.fn() };

      await checkThreadFGA({
        mastra,
        user: { id: 'user-1' },
        threadId: 'thread-999',
        resourceId: 'user-1:team-a:org-1',
        requestContext,
      });

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1' },
        {
          resource: { type: 'thread', id: 'thread-999' },
          permission: 'memory:read',
          context: {
            resourceId: 'user-1:team-a:org-1',
            requestContext,
          },
        },
      );
    });
  });
});
