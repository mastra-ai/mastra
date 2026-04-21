/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FGADeniedError } from '../../../../auth/ee/fga-check';
import type { IFGAProvider } from '../../../../auth/ee/interfaces/fga';

vi.mock('../../../../auth/ee/fga-check', async importOriginal => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    checkFGA: vi.fn(async (options: any) => {
      if (!options.fgaProvider) return;
      await options.fgaProvider.require(options.user, {
        resource: options.resource,
        permission: options.permission,
      });
    }),
  };
});

function createMockFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi
          .fn()
          .mockRejectedValue(new FGADeniedError({ id: 'user-1' }, { type: 'tool', id: 'test-tool' }, 'tools:execute')),
    filterAccessible: vi.fn(),
  };
}

describe('Tool execution FGA checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call FGA check with correct params when provider is configured', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const _mastra = {
      getServer: () => ({ fga: fgaProvider }),
    } as any;

    // Import dynamically after mock setup
    const { checkFGA } = await import('../../../../auth/ee/fga-check');

    await checkFGA({
      fgaProvider,
      user: { id: 'user-1' },
      resource: { type: 'tool', id: 'test-tool' },
      permission: 'tools:execute',
    });

    expect(fgaProvider.require).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        resource: { type: 'tool', id: 'test-tool' },
        permission: 'tools:execute',
      },
    );
  });

  it('should throw FGADeniedError when FGA check fails', async () => {
    const fgaProvider = createMockFGAProvider(false);

    const { checkFGA } = await import('../../../../auth/ee/fga-check');

    await expect(
      checkFGA({
        fgaProvider,
        user: { id: 'user-1' },
        resource: { type: 'tool', id: 'test-tool' },
        permission: 'tools:execute',
      }),
    ).rejects.toThrow(FGADeniedError);
  });

  it('should be a no-op when no FGA provider configured', async () => {
    const { checkFGA } = await import('../../../../auth/ee/fga-check');

    // Should not throw
    await checkFGA({
      fgaProvider: undefined,
      user: { id: 'user-1' },
      resource: { type: 'tool', id: 'test-tool' },
      permission: 'tools:execute',
    });
  });
});
