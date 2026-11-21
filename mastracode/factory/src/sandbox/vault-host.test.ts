import { describe, expect, it } from 'vitest';
import { sandboxHostMayUseCredentialVault } from './vault-host';

describe('sandboxHostMayUseCredentialVault', () => {
  it.each(['local', 'docker', 'e2b'])('treats the shipped %s provider as non-vault', provider => {
    expect(sandboxHostMayUseCredentialVault(provider)).toBe(false);
  });

  it.each(['platform', 'custom', 'acme-callback'])(
    'fails closed for %s, which can attach an owner credential vault',
    provider => {
      expect(sandboxHostMayUseCredentialVault(provider)).toBe(true);
    },
  );

  it('does not treat a missing sandbox as vault-capable', () => {
    expect(sandboxHostMayUseCredentialVault(undefined)).toBe(false);
  });
});
