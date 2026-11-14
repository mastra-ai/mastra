import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { githubIntakeLookup } from './intake-lookup.js';
import type { ReconcileIssueState, ReconcilePullRequestState } from './rules.js';

async function setup() {
  const seed = await createFactoryStorageForTests();
  const sourceControl = seed.sourceControl.forIntegration('github');
  const orgId = 'org-1';
  const project = await seed.projects.create({ orgId, userId: 'owner', input: { name: 'Mastra' } });
  const other = await seed.projects.create({ orgId, userId: 'owner', input: { name: 'Other' } });
  const installation = await sourceControl.installations.upsert({ orgId, connectedByUserId: 'owner', externalId: '41' });
  const link = async (projectId: string, externalId: string, slug: string) => {
    const repository = await sourceControl.repositories.upsert({
      orgId,
      input: { installationId: installation.id, externalId, slug, defaultBranch: 'main' },
    });
    const connection =
      (await sourceControl.connections.list({ orgId, factoryProjectId: projectId }))[0] ??
      (await sourceControl.connections.create({
        orgId,
        factoryProjectId: projectId,
        installationId: installation.id,
        createdByUserId: 'owner',
      }));
    await sourceControl.projectRepositories.link({
      orgId,
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'owner',
      sandboxProvider: 'local',
      sandboxWorkdir: `/sandbox/${slug}`,
    });
  };
  await link(project.id, '7', 'mastra-ai/mastra');
  await link(other.id, '8', 'mastra-ai/ship');

  const reads: string[] = [];
  const issues = new Map<number, ReconcileIssueState>([
    [
      12,
      {
        title: 'Crash on start',
        url: 'https://github.com/mastra-ai/mastra/issues/12',
        state: 'open',
        labels: ['bug'],
        assignees: ['ana'],
        author: 'outsider',
      },
    ],
  ]);
  const pullRequests = new Map<number, ReconcilePullRequestState>([
    [
      34,
      {
        title: 'Fix crash',
        url: 'https://github.com/mastra-ai/mastra/pull/34',
        state: 'open',
        draft: false,
        merged: false,
        labels: ['docs'],
        headBranch: 'fix',
        baseBranch: 'main',
        author: 'maintainer',
      },
    ],
  ]);
  const lookup = githubIntakeLookup({
    sourceControl: () => sourceControl,
    fetchIssueState: async input => {
      reads.push(`issue ${input.installationId} ${input.repository}#${input.number}`);
      return issues.get(input.number);
    },
    fetchPullRequestState: async input => {
      reads.push(`pr ${input.installationId} ${input.repository}#${input.number}`);
      return pullRequests.get(input.number);
    },
    getRepositoryCollaboratorPermission: async (installationId, repository, login) => {
      reads.push(`permission ${installationId} ${repository} ${login}`);
      return login === 'maintainer' ? 'write' : 'read';
    },
  });
  return { lookup, reads, scope: { orgId, factoryProjectId: project.id } };
}

describe('githubIntakeLookup', () => {
  it('reads an issue from a linked repository with the facts its arrival would carry', async () => {
    const { lookup, reads, scope } = await setup();
    const result = await lookup.lookup(scope, 'https://github.com/Mastra-AI/Mastra/issues/12');
    expect(result).toEqual({
      status: 'found',
      title: 'Crash on start',
      url: 'https://github.com/mastra-ai/mastra/issues/12',
      facts: expect.objectContaining({
        'item.labels': ['bug'],
        'item.author': 'outsider',
        'item.assignees': ['ana'],
        'item.key': 'mastra-ai/mastra#12',
        'author.trusted': false,
        'source.kind': 'issue',
        'source.repository': 'mastra-ai/mastra',
      }),
    });
    expect(reads).toEqual(['issue 41 mastra-ai/mastra#12', 'permission 41 mastra-ai/mastra outsider']);
  });

  it('reads a pull request, and one named by an issue URL, with its author trust', async () => {
    const { lookup, scope } = await setup();
    for (const url of ['https://github.com/mastra-ai/mastra/pull/34/files', 'https://github.com/mastra-ai/mastra/issues/34']) {
      const result = await lookup.lookup(scope, url);
      expect(result).toMatchObject({
        status: 'found',
        facts: { 'source.kind': 'pull_request', 'author.trusted': true, 'item.labels': ['docs'] },
      });
    }
  });

  it('refuses repositories not linked to the project without fetching anything', async () => {
    const { lookup, reads, scope } = await setup();
    // Linked to another project in the same organization, and not linked at all.
    expect(await lookup.lookup(scope, 'https://github.com/mastra-ai/ship/issues/1')).toEqual({ status: 'not_linked' });
    expect(await lookup.lookup(scope, 'https://github.com/someone/else/pull/1')).toEqual({ status: 'not_linked' });
    expect(reads).toEqual([]);
  });

  it('reports a missing item, and leaves other providers’ URLs alone', async () => {
    const { lookup, scope } = await setup();
    expect(await lookup.lookup(scope, 'https://github.com/mastra-ai/mastra/issues/99')).toEqual({ status: 'not_found' });
    expect(await lookup.lookup(scope, 'https://gitlab.com/mastra-ai/mastra/-/issues/12')).toBeUndefined();
    expect(await lookup.lookup(scope, 'https://linear.app/mastra/issue/ENG-1')).toBeUndefined();
  });
});
