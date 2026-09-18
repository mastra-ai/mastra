import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { buildGitLabAgentTools } from './agent-tools.js';
import { GitLabApiError } from './api.js';
import { GitLabIntegration } from './integration.js';

let seed!: FactoryStorageTestSeed;
let gitlab!: GitLabIntegration;
let projectId = '';
const getIssue = vi.fn();

function requestContextFor(resourceId: string | undefined, factoryProjectId?: string): RequestContext {
  const context = new RequestContext();
  if (resourceId) context.set('controller', { resourceId, getState: () => ({ factoryProjectId }) });
  return context;
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  gitlab = new GitLabIntegration({ accessToken: 'group-token' });
  gitlab.initialize({
    projects: seed.projects,
    auth: fakeRouteAuth(),
    sourceControl: seed.sourceControl.forIntegration('gitlab'),
  });
  vi.spyOn(gitlab.intake, 'getIssue').mockImplementation(input => getIssue(input.issueId));
  getIssue.mockReset();
  projectId = '';
});

async function seedProject(): Promise<void> {
  const project = await seed.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'Acme app' },
  });
  const sourceControl = seed.sourceControl.forIntegration('gitlab');
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: 'direct',
    providerMetadata: { host: 'gitlab.com' },
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: {
      installationId: installation.id,
      externalId: '10',
      slug: 'mastra/platform',
      defaultBranch: 'main',
    },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace/platform',
  });
  projectId = project.id;
}

describe('buildGitLabAgentTools', () => {
  it('exposes a read-only issue tool for org-owned factory projects', async () => {
    await seedProject();
    const tools = await buildGitLabAgentTools({ gitlab, requestContext: requestContextFor(projectId) });
    expect(Object.keys(tools)).toEqual(['gitlab_get_issue']);
  });

  it('uses the factory project id for board-run sessions', async () => {
    await seedProject();
    const tools = await buildGitLabAgentTools({
      gitlab,
      requestContext: requestContextFor('work-item-session-id', projectId),
    });
    expect(Object.keys(tools)).toEqual(['gitlab_get_issue']);
  });

  it('does not expose tools without auth or a factory project', async () => {
    gitlab.initialize({ projects: seed.projects, auth: fakeRouteAuth({ enabled: false }) });
    expect(await buildGitLabAgentTools({ gitlab, requestContext: requestContextFor('local-default') })).toEqual({});
  });

  it('returns issue details and rejects whitespace-only identifiers', async () => {
    await seedProject();
    getIssue.mockResolvedValueOnce({ identifier: 'mastra/platform#42', title: 'Fix intake sync' });
    const tools = await buildGitLabAgentTools({ gitlab, requestContext: requestContextFor(projectId) });

    await expect((tools.gitlab_get_issue!.execute as any)({ issue: ' mastra/platform#42 ' })).resolves.toEqual({
      identifier: 'mastra/platform#42',
      title: 'Fix intake sync',
    });
    expect(getIssue).toHaveBeenCalledWith('mastra/platform#42');
    expect((tools.gitlab_get_issue!.inputSchema as any).safeParse({ issue: '   ' }).success).toBe(false);
  });

  it('rejects issues outside the Factory project organization before provider access', async () => {
    await seedProject();
    const sourceControl = seed.sourceControl.forIntegration('gitlab');
    const otherProject = await seed.projects.create({
      orgId: 'org-2',
      userId: 'user-2',
      input: { name: 'Secret app' },
    });
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-2',
      connectedByUserId: 'user-2',
      externalId: 'direct',
      providerMetadata: { host: 'gitlab.com' },
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-2',
      input: {
        installationId: installation.id,
        externalId: '99',
        slug: 'other/secret',
        defaultBranch: 'main',
      },
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-2',
      factoryProjectId: otherProject.id,
      installationId: installation.id,
      createdByUserId: 'user-2',
    });
    await sourceControl.projectRepositories.link({
      orgId: 'org-2',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-2',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace/secret',
    });
    const tools = await buildGitLabAgentTools({ gitlab, requestContext: requestContextFor(projectId) });

    await expect((tools.gitlab_get_issue!.execute as any)({ issue: 'other/secret#9' })).resolves.toEqual({
      error: 'Failed to fetch GitLab issue: GitLab issue is outside the active Factory project.',
    });
    expect(getIssue).not.toHaveBeenCalled();
  });

  it('maps token failures to an operator-facing error', async () => {
    await seedProject();
    getIssue.mockRejectedValueOnce(new GitLabApiError('unauthorized', 401));
    const tools = await buildGitLabAgentTools({ gitlab, requestContext: requestContextFor(projectId) });

    await expect((tools.gitlab_get_issue!.execute as any)({ issue: 'mastra/platform#42' })).resolves.toEqual({
      error: 'GitLab rejected the configured personal access token. Check the token and its scopes.',
    });
  });
});
