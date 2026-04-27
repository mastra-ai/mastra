/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, vi } from 'vitest';

import { checkFGA, FGADeniedError } from '../fga-check';
import type { IFGAProvider } from '../interfaces/fga';
import { MastraFGAPermissions } from '../interfaces/permissions.generated';

function createMockFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi
          .fn()
          .mockRejectedValue(
            new FGADeniedError({ id: 'test' }, { type: 'agent', id: 'agent-1' }, MastraFGAPermissions.AGENTS_EXECUTE),
          ),
    filterAccessible: vi.fn(),
  };
}

describe('checkFGA', () => {
  it('should be a no-op when no FGA provider is configured', async () => {
    await checkFGA({
      fgaProvider: undefined,
      user: { id: 'user-1' },
      resource: { type: 'agent', id: 'agent-1' },
      permission: MastraFGAPermissions.AGENTS_EXECUTE,
    });
    // Should not throw
  });

  it('should call fgaProvider.require() when authorized', async () => {
    const provider = createMockFGAProvider(true);

    await checkFGA({
      fgaProvider: provider,
      user: { id: 'user-1' },
      resource: { type: 'agent', id: 'agent-1' },
      permission: MastraFGAPermissions.AGENTS_EXECUTE,
    });

    expect(provider.require).toHaveBeenCalledWith(
      { id: 'user-1' },
      { resource: { type: 'agent', id: 'agent-1' }, permission: MastraFGAPermissions.AGENTS_EXECUTE },
    );
  });

  it('should throw FGADeniedError when not authorized', async () => {
    const provider = createMockFGAProvider(false);

    await expect(
      checkFGA({
        fgaProvider: provider,
        user: { id: 'user-1' },
        resource: { type: 'agent', id: 'agent-1' },
        permission: MastraFGAPermissions.AGENTS_EXECUTE,
      }),
    ).rejects.toThrow(FGADeniedError);
  });

  it('should pass user and permission to provider', async () => {
    const provider = createMockFGAProvider(true);

    await checkFGA({
      fgaProvider: provider,
      user: { id: 'user-2', organizationMembershipId: 'om-2' },
      resource: { type: 'thread', id: 'thread-1' },
      permission: MastraFGAPermissions.MEMORY_READ,
    });

    expect(provider.require).toHaveBeenCalledWith(
      { id: 'user-2', organizationMembershipId: 'om-2' },
      { resource: { type: 'thread', id: 'thread-1' }, permission: MastraFGAPermissions.MEMORY_READ },
    );
  });

  it('should forward optional authorization context to the provider', async () => {
    const provider = createMockFGAProvider(true);
    const requestContext = { get: vi.fn() };

    await checkFGA({
      fgaProvider: provider,
      user: { id: 'user-2' },
      resource: { type: 'thread', id: 'thread-1' },
      permission: MastraFGAPermissions.MEMORY_READ,
      context: {
        resourceId: 'user-2:team-a:org-1',
        requestContext,
      },
    });

    expect(provider.require).toHaveBeenCalledWith(
      { id: 'user-2' },
      {
        resource: { type: 'thread', id: 'thread-1' },
        permission: MastraFGAPermissions.MEMORY_READ,
        context: {
          resourceId: 'user-2:team-a:org-1',
          requestContext,
        },
      },
    );
  });
});

describe('FGADeniedError', () => {
  it('should include user, resource, and permission in error', () => {
    const error = new FGADeniedError(
      { id: 'user-1' },
      { type: 'agent', id: 'agent-1' },
      MastraFGAPermissions.AGENTS_EXECUTE,
    );
    expect(error.name).toBe('FGADeniedError');
    expect(error.user).toEqual({ id: 'user-1' });
    expect(error.resource).toEqual({ type: 'agent', id: 'agent-1' });
    expect(error.permission).toBe(MastraFGAPermissions.AGENTS_EXECUTE);
    expect(error.message).toContain('user-1');
    expect(error.message).toContain('agents:execute');
    expect(error.message).toContain('agent:agent-1');
  });
});
