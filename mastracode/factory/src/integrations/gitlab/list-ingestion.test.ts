import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { resolveGitLabRules } from './default-rules.js';
import { encodeSourceId, GitLabIntegration } from './integration.js';
import { buildGitLabRoutes } from './routes.js';
import { GitLabRules } from './rules.js';

describe('GitLab listed merge requests through rules ingress', () => {
  it('records a newly pushed head when an existing Review MR is listed again', async () => {
    const seeded = await createFactoryStorageForTests();
    const sourceControl = seeded.sourceControl.forIntegration('gitlab');
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1', connectedByUserId: 'user-1', externalId: 'direct', providerMetadata: { host: 'gitlab.example.com' },
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '101', slug: 'acme/app', defaultBranch: 'main' },
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-1', factoryProjectId: project.id, installationId: installation.id, createdByUserId: 'user-1',
    });
    const link = await sourceControl.projectRepositories.link({
      orgId: 'org-1', connectionId: connection.id, repositoryId: repository.id,
      createdByUserId: 'user-1', sandboxProvider: 'local', sandboxWorkdir: '/workspace',
    });
    const sourceId = encodeSourceId({ host: 'gitlab.example.com', projectId: '101' });
    await seeded.intake.saveConfig({ orgId: 'org-1', config: { gitlab: { enabled: true, sourceIds: [sourceId] } } });
    await seeded.intake.setBinding({
      orgId: 'org-1', integrationId: 'gitlab', sourceId, factoryProjectId: project.id, board: 'work', userId: 'user-1',
    });
    const sourceKey = `gitlab-pr:${Buffer.from(JSON.stringify({ version: 1, host: 'gitlab.example.com', projectId: 101, mergeRequestIid: 17 })).toString('base64url')}`;
    const card = (await seeded.workItems.upsert({
      orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id,
      input: {
        title: 'Review MR', board: 'review', stages: ['done'], sessions: {},
        externalSource: { integrationId: 'gitlab', type: 'pull-request', externalId: sourceKey },
        metadata: { authorTrusted: true, reviewedHeadSha: 'aaaa', pullRequestHeadSha: 'aaaa' },
      },
    })).item;
    const gitlab = new GitLabIntegration({ accessToken: 'group-token' });
    vi.spyOn(gitlab, 'resolveOrgId').mockResolvedValue('org-1');
    vi.spyOn(gitlab, 'getLinkedRepository').mockResolvedValue({ repository, host: 'gitlab.example.com' });
    vi.spyOn(gitlab.versionControl, 'getRepositoryTarget').mockResolvedValue({
      connection: { type: 'oauth', accessToken: 'gitlab-connection:direct' }, sourceId: '101:acme/app',
    });
    const listed = {
      id: '17', title: 'Review MR', url: 'https://gitlab.example.com/acme/app/-/merge_requests/17',
      author: 'maintainer', assignees: [], requestedReviewers: [], body: '', state: 'open' as const,
      draft: false, merged: false, mergeable: true, baseBranch: 'main', headBranch: 'feature',
      headSha: 'aaaa', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
    };
    const list = vi.spyOn(gitlab.versionControl, 'listPullRequests').mockResolvedValue({ pullRequests: [listed], nextCursor: null });
    const rules = new GitLabRules({
      gitlab: {
        rules: resolveGitLabRules(),
        getProjectMemberAccessLevel: vi.fn().mockResolvedValue(10),
        getWorkItemAuthorUsername: vi.fn().mockResolvedValue('maintainer'),
        resolveActiveConnectionForHost: vi.fn().mockResolvedValue('direct'),
      },
      sourceControl, projects: seeded.projects, storage: seeded.workItems, intake: seeded.intake,
      configVersion: 'list-ingestion-test-v1', boards: createBoardRegistry(),
    });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app, buildGitLabRoutes({
      gitlab, auth: fakeRouteAuth({ enabled: true }), ingestFactoryEvent: event => rules.ingest(event),
    }));
    const path = `/web/gitlab/projects/${link.id}/prs?factoryProjectId=${project.id}&page=1`;
    expect((await app.request(path)).status).toBe(200);
    expect((await seeded.workItems.get({ orgId: 'org-1', id: card.id }))?.metadata.pullRequestHeadSha).toBe('aaaa');

    list.mockResolvedValue({ pullRequests: [{ ...listed, headSha: 'bbbb', updatedAt: '2030-01-02T00:00:00Z' }], nextCursor: null });
    expect((await app.request(path)).status).toBe(200);
    expect((await seeded.workItems.get({ orgId: 'org-1', id: card.id }))?.metadata.pullRequestHeadSha).toBe('bbbb');

    list.mockResolvedValue({ pullRequests: [{ ...listed, updatedAt: '2030-01-03T00:00:00Z' }], nextCursor: null });
    expect((await app.request(path)).status).toBe(200);
    expect((await seeded.workItems.get({ orgId: 'org-1', id: card.id }))?.metadata.pullRequestHeadSha).toBe('aaaa');
  });
});
