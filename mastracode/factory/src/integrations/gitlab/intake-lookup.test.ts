import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { GitLabIssue, GitLabMergeRequest } from './api.js';
import { gitlabIntakeLookup } from './intake-lookup.js';

async function setup() {
  const seed = await createFactoryStorageForTests();
  const sourceControl = seed.sourceControl.forIntegration('gitlab');
  const orgId = 'org-1';
  const project = await seed.projects.create({ orgId, userId: 'owner', input: { name: 'Mastra' } });
  const other = await seed.projects.create({ orgId, userId: 'owner', input: { name: 'Other' } });
  const installation = await sourceControl.installations.upsert({
    orgId,
    connectedByUserId: 'owner',
    externalId: 'conn-1',
    providerMetadata: { host: 'gitlab.example.com' },
  });
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
      sandboxWorkdir: `/sandbox/${externalId}`,
    });
  };
  await link(project.id, '55', 'acme/platform/api');
  await link(other.id, '66', 'acme/ship');

  const reads: string[] = [];
  const issue: GitLabIssue = {
    id: 1,
    iid: 3,
    project_id: 55,
    title: 'Crash on start',
    state: 'opened',
    web_url: 'https://gitlab.example.com/acme/platform/api/-/issues/3',
    author: { id: 1, username: 'outsider', name: 'Outsider' },
    assignees: [{ id: 2, username: 'ana', name: 'Ana' }],
    labels: ['bug'],
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
  const mergeRequest: GitLabMergeRequest = {
    id: 2,
    iid: 7,
    project_id: 55,
    title: 'Fix crash',
    state: 'merged',
    web_url: 'https://gitlab.example.com/acme/platform/api/-/merge_requests/7',
    author: { id: 3, username: 'maintainer', name: 'Maintainer' },
    labels: ['docs'],
    source_branch: 'fix',
    target_branch: 'main',
    sha: 'abc',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
  const lookup = gitlabIntakeLookup({
    sourceControl: () => sourceControl,
    readWorkItem: async (connectionId, projectId, kind, iid) => {
      reads.push(`${kind} ${connectionId} ${projectId} ${iid}`);
      if (kind === 'issue' && iid === 3) return issue;
      if (kind === 'issue' && iid === 4) return { ...issue, iid: 4, state: 'closed' };
      if (kind === 'merge_request' && iid === 7) return mergeRequest;
      throw new Error('404 Not Found');
    },
    // Direct-token mode answers only to its own connection id, not the one the link stored.
    resolveConnection: async (stored, host) => (stored === 'conn-1' && host === 'gitlab.example.com' ? 'direct-1' : stored),
    getProjectMemberAccessLevel: async (connectionId, projectId, username) => {
      reads.push(`access ${connectionId} ${projectId} ${username}`);
      return username === 'maintainer' ? 30 : 10;
    },
  });
  return { lookup, reads, scope: { orgId, factoryProjectId: project.id } };
}

describe('gitlabIntakeLookup', () => {
  const host = 'https://gitlab.example.com';
  it.each([
    {
      url: `https://GitLab.example.com/Acme/Platform/API/-/issues/3`,
      result: {
        status: 'found',
        title: 'Crash on start',
        url: `${host}/acme/platform/api/-/issues/3`,
        facts: {
          'item.labels': ['bug'],
          'item.author': 'outsider',
          'item.assignees': ['ana'],
          'item.key': 'acme/platform/api#3',
          'item.state': 'open',
          'item.trusted': false,
          'source.kind': 'issue',
          'source.provider': 'gitlab',
          'source.repository': 'acme/platform/api',
        },
      },
      // Read through the host's active connection, not the stored one.
      reads: ['issue direct-1 55 3', 'access direct-1 55 outsider'],
    },
    { url: `${host}/acme/platform/api/-/issues/4`, result: { status: 'found', facts: { 'item.state': 'closed' } } },
    {
      url: `${host}/acme/platform/api/-/merge_requests/7/diffs`,
      result: {
        status: 'found',
        facts: {
          'source.kind': 'pull_request',
          'item.state': 'merged',
          'item.key': 'acme/platform/api!7',
          'item.trusted': true,
          'pullRequest.trusted': true,
        },
      },
    },
    // Linked to another project, not linked, or on another host: nothing is fetched.
    { url: `${host}/acme/ship/-/issues/1`, result: { status: 'not_linked' }, reads: [] },
    { url: `${host}/acme/elsewhere/-/issues/1`, result: { status: 'not_linked' }, reads: [] },
    { url: 'https://gitlab.com/acme/platform/api/-/issues/3', result: { status: 'not_linked' }, reads: [] },
    { url: `${host}/acme/platform/api/-/issues/99`, result: { status: 'not_found' } },
    { url: 'https://github.com/acme/api/issues/3', result: undefined, reads: [] },
  ])('$url', async ({ url, result, reads }) => {
    const seeded = await setup();
    const found = await seeded.lookup.lookup(seeded.scope, url);
    if (result) expect(found).toMatchObject(result);
    else expect(found).toBeUndefined();
    if (reads) expect(seeded.reads).toEqual(reads);
  });
});
