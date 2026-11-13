import type { ApiRoute } from '@mastra/core/server';
import { describe, expect, it } from 'vitest';

import { SourceControlStorageInMemory } from '../../../storage/domains/source-control/inmemory.js';
import { PlatformConnectIntegration } from './integration.js';
import { startFakePlatform } from './test-utils.js';
import type { FakePlatform } from './test-utils.js';
import { PlatformVersionControlCapability } from './version-control.js';

class TestIntegration extends PlatformConnectIntegration {
  routes(): ApiRoute[] {
    return [];
  }
}

class TestVersionControl extends PlatformVersionControlCapability {}

async function setup(fake?: FakePlatform) {
  const platform = fake ?? (await startFakePlatform());
  const integration = new TestIntegration({
    id: 'test-vcs',
    providerKeys: ['factory-github'],
    connect: platform.connect(),
  });
  const versionControl = new TestVersionControl(integration);
  const storage = new SourceControlStorageInMemory('test-vcs');
  versionControl.initialize({ storage });
  return { platform, integration, versionControl, storage };
}

describe('PlatformVersionControlCapability', () => {
  it('refuses storage access before it is initialized', async () => {
    const platform = await startFakePlatform();
    const integration = new TestIntegration({ id: 'test-vcs', providerKeys: [], connect: platform.connect() });
    expect(() => new TestVersionControl(integration).storage).toThrow(/has not been initialized/);
  });

  it('mirrors installations and repositories by external id, idempotently', async () => {
    const { versionControl, storage } = await setup();
    const installation = await versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: { externalId: '100', accountName: 'acme', accountType: 'Organization', metadata: { app: 'x' } },
    });
    const again = await versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: { externalId: '100', accountName: 'acme-renamed', accountType: 'Organization' },
    });
    expect(again.id).toBe(installation.id);
    expect(again.accountName).toBe('acme-renamed');

    const [repository] = await versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: installation.id,
      repositories: [{ externalId: '42', slug: 'acme/api', defaultBranch: 'main' }],
    });
    await versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: installation.id,
      repositories: [{ externalId: '42', slug: 'acme/api-renamed', defaultBranch: 'trunk' }],
    });
    const rows = await storage.repositories.list({ orgId: 'org-1', installationId: installation.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: repository!.id, slug: 'acme/api-renamed', defaultBranch: 'trunk' });
  });

  it('re-points an installation in place so its repositories stay attached and resolve by repository id', async () => {
    const { versionControl } = await setup();
    const installation = await versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-1',
      installation: { externalId: '100', accountName: 'acme', accountType: 'Organization' },
    });
    const [repository] = await versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: installation.id,
      repositories: [{ externalId: '42', slug: 'acme/api', defaultBranch: 'main' }],
    });

    const repointed = await versionControl.repointInstallation({
      orgId: 'org-1',
      fromExternalId: '100',
      toExternalId: '300',
      providerMetadata: { app: 'factory-github' },
    });
    expect(repointed).toMatchObject({
      id: installation.id,
      externalId: '300',
      providerMetadata: { app: 'factory-github' },
    });
    expect(await versionControl.findRepository({ orgId: 'org-1', externalId: '42' })).toMatchObject({
      id: repository!.id,
      installationId: installation.id,
    });
    expect(await versionControl.findRepository({ orgId: 'org-2', externalId: '42' })).toBeNull();
    expect(
      await versionControl.repointInstallation({ orgId: 'org-1', fromExternalId: '100', toExternalId: '400' }),
    ).toBeNull();
  });

  it('reads the credential of the active connection a predicate picks, from the project listing', async () => {
    const platform = await startFakePlatform();
    platform.orgConnections.push(
      { id: 'conn-a', integrationId: 'factory-github', status: 'active' },
      { id: 'conn-b', integrationId: 'factory-github', status: 'active' },
      { id: 'conn-c', integrationId: 'factory-github', status: 'needs_reauth' },
      { id: 'conn-org-only', integrationId: 'factory-github', status: 'active' },
    );
    for (const id of ['conn-a', 'conn-b', 'conn-c']) platform.linked.add(id);
    platform.credentials.set('conn-b', { type: 'oauth2', accessToken: 'ghs_b', expiresAt: '2026-11-13T19:00:00.000Z' });
    const { versionControl } = await setup(platform);

    await expect(versionControl.connectionCredential('factory-github', c => c.id === 'conn-b')).resolves.toMatchObject({
      connection: { id: 'conn-b' },
      credential: { type: 'oauth2', accessToken: 'ghs_b' },
    });
    await expect(versionControl.connectionCredential('factory-github', c => c.id === 'conn-c')).resolves.toBeNull();
    await expect(
      versionControl.connectionCredential('factory-github', c => c.id === 'conn-org-only'),
    ).resolves.toBeNull();
    expect(platform.count('GET', '/v2/connections')).toBe(0);
  });
});
