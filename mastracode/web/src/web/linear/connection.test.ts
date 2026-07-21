import { afterEach, describe, expect, it, vi } from 'vitest';

import { __resetRuntimeConfigForTests } from '../runtime-config';
import { seedFactoryStorageForTests } from '../storage/test-utils';
import { getFreshLinearAccessToken, loadLinearConnection } from './connection';
import { LinearIntegration } from './integration';
import { upsertLinearConnection } from './storage';

function integration() {
  return new LinearIntegration({ clientId: 'linear-client', clientSecret: 'linear-secret' });
}

async function expiredConnection(orgId: string) {
  await upsertLinearConnection({
    orgId,
    userId: 'user-1',
    accessToken: 'expired-access-token',
    refreshToken: 'refresh-token',
    expiresAt: new Date(Date.now() - 120_000),
    scope: 'read',
    workspaceName: 'Acme',
    workspaceUrlKey: 'acme',
  });
  const connection = await loadLinearConnection(orgId);
  if (!connection) throw new Error('Expected seeded Linear connection.');
  return connection;
}

afterEach(() => {
  __resetRuntimeConfigForTests();
  vi.restoreAllMocks();
});

describe('getFreshLinearAccessToken', () => {
  it('shares one refresh and persistence operation across concurrent requests', async () => {
    const seed = await seedFactoryStorageForTests();
    const linear = integration();
    const connection = await expiredConnection('org-concurrent');
    let release!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const refresh = vi.spyOn(linear, 'refreshAccessToken').mockImplementation(async () => {
      await blocked;
      return {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 3_600_000),
        scope: 'read',
      };
    });
    const linearStorage = seed.integrations.forIntegration('linear');
    const update = vi.spyOn(linearStorage.connections, 'update');
    vi.spyOn(seed.integrations, 'forIntegration').mockReturnValue(linearStorage as never);

    const first = getFreshLinearAccessToken(linear, connection);
    const second = getFreshLinearAccessToken(linear, connection);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    release();

    await expect(Promise.all([first, second])).resolves.toEqual(['new-access-token', 'new-access-token']);
    expect(update).toHaveBeenCalledTimes(1);
    await expect(loadLinearConnection('org-concurrent')).resolves.toMatchObject({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  it('shares persistence failures and clears the single-flight entry so a later request retries', async () => {
    const seed = await seedFactoryStorageForTests();
    const linear = integration();
    const connection = await expiredConnection('org-persistence-failure');
    const refresh = vi.spyOn(linear, 'refreshAccessToken').mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: 'read',
    });
    const realLinearStorage = seed.integrations.forIntegration('linear');
    const failingLinearStorage = {
      ...realLinearStorage,
      connections: {
        ...realLinearStorage.connections,
        update: vi.fn().mockRejectedValue(new Error('token persistence failed')),
      },
    };
    const forIntegration = vi.spyOn(seed.integrations, 'forIntegration').mockReturnValue(failingLinearStorage as never);

    const first = getFreshLinearAccessToken(linear, connection);
    const second = getFreshLinearAccessToken(linear, connection);
    await expect(Promise.all([first, second])).rejects.toThrow('token persistence failed');
    expect(refresh).toHaveBeenCalledTimes(1);

    forIntegration.mockReturnValue(realLinearStorage as never);
    refresh.mockResolvedValueOnce({
      accessToken: 'retry-access-token',
      refreshToken: 'retry-refresh-token',
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: 'read',
    });

    await expect(getFreshLinearAccessToken(linear, connection)).resolves.toBe('retry-access-token');
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
