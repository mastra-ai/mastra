import { afterEach, describe, expect, it } from 'vitest';

import { __resetRuntimeConfigForTests, seedRuntimeConfig } from '../runtime-config.js';
import { getGithubFeatureDiagnostics } from './config.js';
import { GithubIntegration } from './integration.js';

afterEach(() => {
  __resetRuntimeConfigForTests();
});

describe('getGithubFeatureDiagnostics', () => {
  it('does not require integration route storage to be initialized', () => {
    seedRuntimeConfig({
      integrations: [
        new GithubIntegration({
          appId: '123',
          privateKey: 'test-key',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          slug: 'test-app',
        }),
      ],
    });

    expect(getGithubFeatureDiagnostics()).toMatchObject({
      githubAppConfigured: true,
      appDbConfigured: false,
    });
  });
});
