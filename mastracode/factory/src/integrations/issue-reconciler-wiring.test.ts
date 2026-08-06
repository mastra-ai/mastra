import { generateKeyPairSync } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { IntegrationContext } from './base.js';
import { GithubIntegration } from './github/integration.js';
import { LinearIntegration } from './linear/integration.js';
import { PlatformGithubIntegration } from './platform/github/integration.js';
import { PlatformLinearIntegration } from './platform/linear/integration.js';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function context(): IntegrationContext {
  return {
    controller: {},
    storage: {
      generic: {},
      sourceControl: {},
      projects: { listAll: async () => [] },
      intake: {},
    },
    rules: {
      config: {},
      workItems: {},
    },
  } as unknown as IntegrationContext;
}

describe('issue reconciler worker wiring', () => {
  beforeEach(() => {
    process.env.MASTRA_PLATFORM_SECRET_KEY = 'platform-secret';
    process.env.MASTRA_SHARED_API_URL = 'https://platform.example.com/v1';
    delete process.env.MASTRACODE_GITHUB_RECONCILE_ENABLED;
    delete process.env.MASTRA_PLATFORM_GITHUB_RECONCILE_ENABLED;
    delete process.env.MASTRACODE_LINEAR_RECONCILE_ENABLED;
  });

  afterEach(() => {
    delete process.env.MASTRA_PLATFORM_SECRET_KEY;
    delete process.env.MASTRA_SHARED_API_URL;
    delete process.env.MASTRACODE_GITHUB_RECONCILE_ENABLED;
    delete process.env.MASTRA_PLATFORM_GITHUB_RECONCILE_ENABLED;
    delete process.env.MASTRACODE_LINEAR_RECONCILE_ENABLED;
  });

  it('registers GitHub issue reconciliation in direct and Platform modes', () => {
    const direct = new GithubIntegration({
      appId: '1',
      privateKey,
      clientId: 'client',
      clientSecret: 'secret',
      slug: 'factory',
      webhookSecret: 'webhook',
    });
    const platform = new PlatformGithubIntegration();

    expect(direct.workers(context()).map(worker => worker.name)).toContain('github-issue-reconcile');
    expect(platform.workers(context()).map(worker => worker.name)).toContain('github-issue-reconcile');
  });

  it('registers Linear issue reconciliation in direct and Platform modes', () => {
    const direct = new LinearIntegration({ clientId: 'client', clientSecret: 'secret' });
    const platform = new PlatformLinearIntegration();

    expect(direct.workers(context()).map(worker => worker.name)).toEqual(['linear-issue-reconcile']);
    expect(platform.workers(context()).map(worker => worker.name)).toEqual(['linear-issue-reconcile']);
  });
});
