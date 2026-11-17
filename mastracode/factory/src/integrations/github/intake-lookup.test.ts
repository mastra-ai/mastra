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
  const issueFacts = {
    'item.labels': ['bug'],
    'item.author': 'outsider',
    'item.assignees': ['ana'],
    'item.key': 'mastra-ai/mastra#12',
    'item.trusted': false,
    'source.kind': 'issue',
    'source.repository': 'mastra-ai/mastra',
  };
  const prFacts = { 'source.kind': 'pull_request', 'item.trusted': true, 'pullRequest.trusted': true, 'item.labels': ['docs'] };
  it.each([
    {
      url: 'https://github.com/Mastra-AI/Mastra/issues/12',
      result: { status: 'found', title: 'Crash on start', url: 'https://github.com/mastra-ai/mastra/issues/12', facts: issueFacts },
      reads: ['issue 41 mastra-ai/mastra#12', 'permission 41 mastra-ai/mastra outsider'],
    },
    { url: 'https://github.com/mastra-ai/mastra/pull/34/files', result: { status: 'found', facts: prFacts } },
    // An issue URL may name a pull request: GitHub numbers them together.
    { url: 'https://github.com/mastra-ai/mastra/issues/34', result: { status: 'found', facts: prFacts } },
    // Linked to another project of the organization, or not linked at all: nothing is fetched.
    { url: 'https://github.com/mastra-ai/ship/issues/1', result: { status: 'not_linked' }, reads: [] },
    { url: 'https://github.com/someone/else/pull/1', result: { status: 'not_linked' }, reads: [] },
    { url: 'https://github.com/mastra-ai/mastra/issues/99', result: { status: 'not_found' } },
    { url: 'https://gitlab.com/mastra-ai/mastra/-/issues/12', result: undefined, reads: [] },
    { url: 'https://linear.app/mastra/issue/ENG-1', result: undefined, reads: [] },
  ])('$url', async ({ url, result, reads }) => {
    const seeded = await setup();
    const found = await seeded.lookup.lookup(seeded.scope, url);
    if (result) expect(found).toMatchObject(result);
    else expect(found).toBeUndefined();
    if (reads) expect(seeded.reads).toEqual(reads);
  });
});
