import { describe, expect, it, vi } from 'vitest';

import type { FactoryDevSettings } from './settings.js';
import { queueTokenRotation, reconcileTokenOwnership, retryPendingTokenRevocations } from './token-lifecycle.js';

function createSettings(): FactoryDevSettings {
  return {
    version: 1,
    auth: { source: 'mastra-cli-session', tokenId: 'token-current', tokenOrganizationId: 'org-1' },
    organization: { id: 'org-1', name: 'Mastra' },
    project: { id: 'project-1', name: 'Factory' },
    environment: { id: 'env-1', name: 'Production' },
    database: { provider: 'libsql' },
    sandbox: { provider: 'local' },
  };
}

describe('Factory platform token lifecycle', () => {
  it('queues only the token owned by this setup when rotating', () => {
    const settings = createSettings();

    queueTokenRotation(settings, 'token-replacement', 'org-1');

    expect(settings.auth).toEqual({
      source: 'mastra-cli-session',
      tokenId: 'token-replacement',
      tokenOrganizationId: 'org-1',
      pendingRevocations: [{ tokenId: 'token-current', organizationId: 'org-1' }],
    });
  });

  it('retains ownership of a token from a previous organization during reconfiguration', () => {
    const settings = createSettings();

    queueTokenRotation(settings, 'token-replacement', 'org-2', {
      tokenId: 'token-previous-checkout',
      organizationId: 'org-1',
    });

    expect(settings.auth.pendingRevocations).toEqual([{ tokenId: 'token-previous-checkout', organizationId: 'org-1' }]);
  });

  it('reconciles interrupted rotation from ownership persisted with the secret', () => {
    const settings = createSettings();
    queueTokenRotation(settings, 'token-replacement', 'org-1');

    expect(reconcileTokenOwnership(settings, { tokenId: 'token-current', organizationId: 'org-1' })).toBe(true);
    expect(settings.auth).toEqual({
      source: 'mastra-cli-session',
      tokenId: 'token-current',
      tokenOrganizationId: 'org-1',
      pendingRevocations: [{ tokenId: 'token-replacement', organizationId: 'org-1' }],
    });
    expect(reconcileTokenOwnership(settings, { tokenId: 'token-current', organizationId: 'org-1' })).toBe(false);
  });

  it('persists failed revocations and retries them later', async () => {
    const settings = createSettings();
    settings.auth.pendingRevocations = [
      { tokenId: 'token-old-1', organizationId: 'org-1' },
      { tokenId: 'token-old-2', organizationId: 'org-2' },
    ];
    const persist = vi.fn(async () => undefined);
    const firstRevoke = vi.fn(async ({ tokenId }: { tokenId: string }) => {
      if (tokenId === 'token-old-1') throw new Error('platform unavailable');
    });

    expect(await retryPendingTokenRevocations(settings, firstRevoke, persist)).toEqual([
      new Error('platform unavailable'),
    ]);
    expect(settings.auth.pendingRevocations).toEqual([{ tokenId: 'token-old-1', organizationId: 'org-1' }]);
    expect(persist).toHaveBeenCalledTimes(1);

    const secondRevoke = vi.fn(async () => undefined);
    expect(await retryPendingTokenRevocations(settings, secondRevoke, persist)).toEqual([]);
    expect(settings.auth.pendingRevocations).toBeUndefined();
    expect(secondRevoke).toHaveBeenCalledWith({ tokenId: 'token-old-1', organizationId: 'org-1' });
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('never revokes the current token even if settings contain a stale duplicate', async () => {
    const settings = createSettings();
    settings.auth.pendingRevocations = [{ tokenId: 'token-current', organizationId: 'org-1' }];
    const revoke = vi.fn(async () => undefined);

    expect(await retryPendingTokenRevocations(settings, revoke, async () => undefined)).toEqual([]);
    expect(revoke).not.toHaveBeenCalled();
    expect(settings.auth.pendingRevocations).toBeUndefined();
  });
});
