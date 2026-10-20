/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, vi } from 'vitest';
import { RequestContext } from '../../../request-context';

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
  it('should bypass provider membership resolution for a tenant-scoped trusted actor', async () => {
    const provider = createMockFGAProvider(true);
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');

    await requireFGA({
      fgaProvider: provider,
      user: undefined,
      resource: { type: 'workflow', id: 'nightly-workflow' },
      permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
      requestContext,
      actor: { actorKind: 'system', sourceWorkflow: 'nightly-workflow' },
    });

    expect(provider.require).not.toHaveBeenCalled();
  });

  it('should fail loudly when a trusted actor has no tenant scope', async () => {
    const provider = createMockFGAProvider(true);

    await expect(
      requireFGA({
        fgaProvider: provider,
        user: undefined,
        resource: { type: 'workflow', id: 'nightly-workflow' },
        permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
        requestContext: new RequestContext(),
        actor: true,
      }),
    ).rejects.toThrow('trusted actor requires organizationId / tenant scope');

    expect(provider.require).not.toHaveBeenCalled();
  });

  it.each([{}, { actorKind: 'user' }])(
    'should not bypass provider checks for malformed actor value %o',
    async candidate => {
      const provider = createMockFGAProvider(true);
      const requestContext = new RequestContext();
      requestContext.set('organizationId', 'org-1');

      await requireFGA({
        fgaProvider: provider,
        user: { id: 'user-1' },
        resource: { type: 'workflow', id: 'nightly-workflow' },
        permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
        requestContext,
        actor: candidate as any,
      });

      expect(provider.require).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          resource: { type: 'workflow', id: 'nightly-workflow' },
          permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
        }),
      );
    },
  );

  it('should not treat user or request-context data as the trusted actor signal', async () => {
    const provider = createMockFGAProvider(true);
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');
    requestContext.set('actor', true);

    await expect(
      requireFGA({
        fgaProvider: provider,
        user: { id: 'user-controlled', actor: true },
        resource: { type: 'workflow', id: 'nightly-workflow' },
        permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
        requestContext,
      }),
    ).resolves.toBeUndefined();

    expect(provider.require).toHaveBeenCalledWith(
      { id: 'user-controlled', actor: true },
      expect.objectContaining({
        resource: { type: 'workflow', id: 'nightly-workflow' },
        permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
      }),
    );
  });
});
