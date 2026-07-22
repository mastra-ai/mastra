/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, vi } from 'vitest';

import { checkFGA, FGADeniedError, requireFGA } from '../fga-check';
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

  it('should fail closed when FGA is configured and no user is available', async () => {
    const provider = createMockFGAProvider(true);

    await expect(
      requireFGA({
        fgaProvider: provider,
        user: undefined,
        resource: { type: 'agent', id: 'agent-1' },
        permission: MastraFGAPermissions.AGENTS_EXECUTE,
      }),
    ).rejects.toThrow('authenticated user is required');

    expect(provider.require).not.toHaveBeenCalled();
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

describe('requireFGA — actor signals', () => {
  // A request context that exposes a tenant organizationId, satisfying the
  // baseline tenant-scope invariant enforced for all actor calls.
  function tenantScopedRequestContext(organizationId = 'org-1') {
    return { get: vi.fn((key: string) => (key === 'organizationId' ? organizationId : undefined)) };
  }

  // A request context with no tenant scope at all.
  const noTenantRequestContext = () => ({ get: vi.fn(() => undefined) });

  it('preserves the bypass when the provider does not implement requireActor', async () => {
    const provider = createMockFGAProvider(true);

    await requireFGA({
      fgaProvider: provider,
      user: undefined,
      resource: { type: 'agent', id: 'agent-1' },
      permission: MastraFGAPermissions.AGENTS_EXECUTE,
      requestContext: tenantScopedRequestContext(),
      actor: { actorKind: 'system', sourceWorkflow: 'nightly-workflow' },
    });

    // Legacy short-circuit: neither the user-facing require nor any actor path runs.
    expect(provider.require).not.toHaveBeenCalled();
  });

  it('still fails closed for an actor without a tenant organizationId', async () => {
    const provider = createMockFGAProvider(true);

    await expect(
      requireFGA({
        fgaProvider: provider,
        user: undefined,
        resource: { type: 'agent', id: 'agent-1' },
        permission: MastraFGAPermissions.AGENTS_EXECUTE,
        requestContext: noTenantRequestContext(),
        actor: { actorKind: 'system' },
      }),
    ).rejects.toThrow(FGADeniedError);

    expect(provider.require).not.toHaveBeenCalled();
  });

  it('delegates to requireActor when the provider implements it', async () => {
    const provider = createMockFGAProvider(true);
    const requireActor = vi.fn().mockResolvedValue(undefined);
    (provider as IFGAProvider).requireActor = requireActor;

    const actor = { actorKind: 'system' as const, agentId: 'nightly-agent', permissions: ['tools:execute'] };
    const requestContext = tenantScopedRequestContext();

    await requireFGA({
      fgaProvider: provider,
      user: undefined,
      resource: { type: 'tool', id: 'nightly-agent:weather' },
      permission: MastraFGAPermissions.TOOLS_EXECUTE,
      requestContext,
      actor,
    });

    // The provider decides; the legacy user-path require is never used for actors.
    expect(provider.require).not.toHaveBeenCalled();
    expect(requireActor).toHaveBeenCalledTimes(1);
    expect(requireActor).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        resource: { type: 'tool', id: 'nightly-agent:weather' },
        permission: MastraFGAPermissions.TOOLS_EXECUTE,
        // Fails if fga-check.ts stops forwarding the merged FGA context.
        context: { requestContext },
      }),
    );
  });

  it('propagates a denial thrown by requireActor', async () => {
    const provider = createMockFGAProvider(true);
    (provider as IFGAProvider).requireActor = vi
      .fn()
      .mockRejectedValue(
        new FGADeniedError(
          null,
          { type: 'tool', id: 'nightly-agent:secret' },
          MastraFGAPermissions.TOOLS_EXECUTE,
          'agent nightly-agent lacks required permission tools:execute on tools:nightly-agent:secret',
        ),
      );

    await expect(
      requireFGA({
        fgaProvider: provider,
        user: undefined,
        resource: { type: 'tool', id: 'nightly-agent:secret' },
        permission: MastraFGAPermissions.TOOLS_EXECUTE,
        requestContext: tenantScopedRequestContext(),
        actor: { actorKind: 'system', agentId: 'nightly-agent', permissions: ['tools:execute'] },
      }),
    ).rejects.toThrow(FGADeniedError);
  });

  it('supports the `true` actor shorthand with requireActor', async () => {
    const provider = createMockFGAProvider(true);
    const requireActor = vi.fn().mockResolvedValue(undefined);
    (provider as IFGAProvider).requireActor = requireActor;

    await requireFGA({
      fgaProvider: provider,
      user: undefined,
      resource: { type: 'agent', id: 'agent-1' },
      permission: MastraFGAPermissions.AGENTS_EXECUTE,
      requestContext: tenantScopedRequestContext(),
      actor: true,
    });

    expect(requireActor).toHaveBeenCalledWith(true, expect.anything());
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
