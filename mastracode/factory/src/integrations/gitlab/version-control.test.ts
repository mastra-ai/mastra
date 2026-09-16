import { describe, expect, it, vi } from 'vitest';

import { SourceControlStorageInMemory } from '../../storage/domains/source-control/inmemory.js';
import { GitLabApiClient, GitLabApiError } from './api.js';
import { buildGitLabVersionControl, tokenUrl } from './version-control.js';

function setup() {
  const storage = new SourceControlStorageInMemory('gitlab');
  const api = new GitLabApiClient({
    baseUrl: 'https://gitlab.example.com',
    accessToken: 'glpat-secret',
    fetchImpl: vi.fn<typeof fetch>(),
  });
  const contextForConnection = vi.fn(async () => ({
    api,
    connection: { type: 'oauth' as const, accessToken: 'glpat-secret' },
    host: 'gitlab.example.com',
  }));
  const versionControl = buildGitLabVersionControl({ contextForConnection });
  versionControl.initialize({ storage });
  return { storage, versionControl, contextForConnection };
}

async function register(setupResult: ReturnType<typeof setup>) {
  const installation = await setupResult.versionControl.registerInstallation({
    orgId: 'org-1',
    userId: 'user-1',
    installation: {
      externalId: 'connection-1',
      accountName: 'acme',
      accountType: 'group',
      metadata: {
        connection: { type: 'oauth', accessToken: 'gitlab-connection:connection-1' },
        scope: 'group',
      },
    },
  });
  const [repository] = await setupResult.versionControl.registerRepositories({
    orgId: 'org-1',
    installationId: installation.id,
    repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'main', metadata: { archived: false } }],
  });
  return { installation, repository: repository! };
}

describe('buildGitLabVersionControl', () => {
  it('upserts installations and repositories with the resolved connection descriptor', async () => {
    const result = setup();
    const first = await register(result);

    const updatedInstallation = await result.versionControl.registerInstallation({
      orgId: 'org-1',
      userId: 'user-2',
      installation: {
        externalId: 'connection-1',
        accountName: 'Acme Group',
        metadata: { connection: { type: 'oauth', accessToken: 'gitlab-connection:connection-1' } },
      },
    });
    const [updatedRepository] = await result.versionControl.registerRepositories({
      orgId: 'org-1',
      installationId: first.installation.id,
      repositories: [{ externalId: '101', slug: 'acme/app', defaultBranch: 'trunk' }],
    });

    expect(updatedInstallation.id).toBe(first.installation.id);
    expect(updatedInstallation).toMatchObject({
      connectedByUserId: 'user-2',
      accountName: 'Acme Group',
      providerMetadata: {
        connection: { type: 'oauth', accessToken: 'glpat-secret' },
        host: 'gitlab.example.com',
      },
    });
    expect(updatedRepository).toMatchObject({
      id: first.repository.id,
      slug: 'acme/app',
      defaultBranch: 'trunk',
    });
    expect(result.storage.installationsRows).toHaveLength(1);
    expect(result.storage.repositoriesRows).toHaveLength(1);
  });

  it('returns repository clone access from the stored installation connection', async () => {
    const result = setup();
    const { repository } = await register(result);

    await expect(
      result.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
    ).resolves.toEqual({
      cloneUrl: 'https://gitlab.example.com/acme/app.git',
      authorization: { scheme: 'bearer', token: 'glpat-secret' },
    });
    expect(result.contextForConnection).toHaveBeenLastCalledWith({
      type: 'oauth',
      accessToken: 'glpat-secret',
    });
    expect(tokenUrl('gitlab.example.com', 'acme/app', 'glpat-secret')).toBe(
      'https://oauth2:glpat-secret@gitlab.example.com/acme/app.git',
    );
  });

  it('rejects malformed connection metadata and repository references', async () => {
    const result = setup();

    await expect(
      result.versionControl.registerInstallation({
        orgId: 'org-1',
        userId: 'user-1',
        installation: { externalId: 'connection-1' },
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 400 });

    const { installation, repository } = await register(result);
    installation.providerMetadata.connection = { type: 'oauth', accessToken: '' };
    await expect(
      result.versionControl.getRepositoryAccess({ orgId: 'org-1', repositoryId: repository.id }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 500 });
    await expect(
      result.versionControl.registerRepositories({
        orgId: 'org-1',
        installationId: installation.id,
        repositories: [{ externalId: '102', slug: '../escape', defaultBranch: 'main' }],
      }),
    ).rejects.toMatchObject<Partial<GitLabApiError>>({ status: 400 });
  });
});
