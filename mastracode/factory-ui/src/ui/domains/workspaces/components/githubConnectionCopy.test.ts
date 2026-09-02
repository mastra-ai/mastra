import { describe, expect, it } from 'vitest';

import { describeInstallations } from './githubConnectionCopy';

describe('describeInstallations', () => {
  it('returns null when there are no installations', () => {
    expect(describeInstallations([])).toBeNull();
  });

  it('returns null when no installation has a stored account login', () => {
    expect(
      describeInstallations([{ installationId: 1, accountLogin: null, accountType: null }]),
    ).toBeNull();
  });

  it('names the single installed account', () => {
    expect(
      describeInstallations([{ installationId: 1, accountLogin: 'mastra-ai', accountType: 'Organization' }]),
    ).toBe('Installed on: mastra-ai');
  });

  it('joins multiple accounts and skips ones with no login', () => {
    expect(
      describeInstallations([
        { installationId: 1, accountLogin: 'mastra-ai', accountType: 'Organization' },
        { installationId: 2, accountLogin: null, accountType: null },
        { installationId: 3, accountLogin: 'my-org', accountType: 'Organization' },
      ]),
    ).toBe('Installed on: mastra-ai, my-org');
  });
});
