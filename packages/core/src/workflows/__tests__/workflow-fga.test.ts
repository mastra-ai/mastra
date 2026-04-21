/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FGADeniedError, checkFGA } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';

function createMockFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi
          .fn()
          .mockRejectedValue(
            new FGADeniedError({ id: 'user-1' }, { type: 'workflow', id: 'test-workflow' }, 'workflows:execute'),
          ),
    filterAccessible: vi.fn(),
  };
}

describe('Workflow FGA checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call checkFGA with correct params when FGA provider is configured', async () => {
    const fgaProvider = createMockFGAProvider(true);
    const user = { id: 'user-1' };

    await checkFGA({
      fgaProvider,
      user,
      resource: { type: 'workflow', id: 'test-workflow' },
      permission: 'workflows:execute',
    });

    expect(fgaProvider.require).toHaveBeenCalledWith(
      { id: 'user-1' },
      { resource: { type: 'workflow', id: 'test-workflow' }, permission: 'workflows:execute' },
    );
  });

  it('should throw FGADeniedError when FGA check fails', async () => {
    const fgaProvider = createMockFGAProvider(false);
    const user = { id: 'user-1' };

    await expect(
      checkFGA({
        fgaProvider,
        user,
        resource: { type: 'workflow', id: 'test-workflow' },
        permission: 'workflows:execute',
      }),
    ).rejects.toThrow(FGADeniedError);
  });

  it('should not call checkFGA when no FGA provider configured', async () => {
    // Should not throw
    await checkFGA({
      fgaProvider: undefined,
      user: { id: 'user-1' },
      resource: { type: 'workflow', id: 'test-workflow' },
      permission: 'workflows:execute',
    });
  });
});
