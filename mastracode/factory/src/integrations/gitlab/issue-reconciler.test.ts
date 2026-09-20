import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import { fakeRouteAuth } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { IntegrationContext } from '../base.js';
import { encodeIssueReference, encodeSourceId, GitLabIntegration } from './integration.js';
import { attachGitLabIssueReconciler } from './issue-reconciler.js';

const PROJECT_ID = '101';
const PROJECT_PATH = 'acme/app';
const HOST = 'gitlab.example.com';
const SOURCE_ID = encodeSourceId({ host: HOST, projectId: PROJECT_ID });
const ISSUE_ID = encodeIssueReference({ host: HOST, projectId: PROJECT_ID, issueIid: 42 });

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('GitLab issue reconciler', () => {
  it('replays a missed issue close through governed GitLab rules exactly once', async () => {
    const seeded = await createFactoryStorageForTests();
    const sourceControl = seeded.sourceControl.forIntegration('gitlab');
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
    const installation = await sourceControl.installations.upsert({
      orgId: project.orgId,
      connectedByUserId: project.createdBy,
      externalId: 'direct',
      providerMetadata: { host: HOST },
    });
    const repository = await sourceControl.repositories.upsert({
      orgId: project.orgId,
      input: {
        installationId: installation.id,
        externalId: PROJECT_ID,
        slug: PROJECT_PATH,
        defaultBranch: 'main',
      },
    });
    const connection = await sourceControl.connections.create({
      orgId: project.orgId,
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: project.createdBy,
    });
    await sourceControl.projectRepositories.link({
      orgId: project.orgId,
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: project.createdBy,
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace',
    });
    await seeded.intake.saveConfig({
      orgId: project.orgId,
      config: { gitlab: { enabled: true, sourceIds: [SOURCE_ID] } },
    });
    await seeded.intake.setBinding({
      orgId: project.orgId,
      userId: project.createdBy,
      integrationId: 'gitlab',
      sourceId: SOURCE_ID,
      factoryProjectId: project.id,
      board: 'work',
    });
    await seeded.workItems.upsert({
      orgId: project.orgId,
      userId: project.createdBy,
      factoryProjectId: project.id,
      input: {
        externalSource: {
          integrationId: 'gitlab',
          type: 'issue',
          externalId: ISSUE_ID,
          url: `https://${HOST}/${PROJECT_PATH}/-/issues/42`,
        },
        title: 'Issue 42',
        stages: ['building'],
        sessions: {},
        metadata: {
          gitlabHost: HOST,
          gitlabProjectId: 101,
          gitlabIssueIid: 42,
          identifier: `${PROJECT_PATH}#42`,
        },
      },
    });

    let accessLevel = 40;
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.endsWith('/api/v4/projects/101')) {
        return json({ id: 101, path_with_namespace: PROJECT_PATH, default_branch: 'main' });
      }
      if (url.includes('/issues/42/notes')) return json([]);
      if (url.includes('/issues?iids%5B%5D=42')) {
        return json([{
          id: 1042,
          iid: 42,
          project_id: 101,
          title: 'Issue 42',
          description: 'Closed upstream.',
          state: 'closed',
          web_url: `https://${HOST}/${PROJECT_PATH}/-/issues/42`,
          author: { name: 'Maintainer', username: 'maintainer' },
          assignee: null,
          assignees: [],
          labels: [{ name: 'bug', color: '#428BCA' }],
          user_notes_count: 0,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-18T00:00:00Z',
        }]);
      }
      if (url.includes('/members/all')) {
        return json([{ id: 7, username: 'maintainer', state: 'active', access_level: accessLevel }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const gitlab = new GitLabIntegration({
      accessToken: 'test-token',
      accessTokenType: 'personal',
      baseUrl: `https://${HOST}`,
      fetchImpl,
    });
    gitlab.initialize({
      storage: seeded.integrations.forIntegration('gitlab'),
      projects: seeded.projects,
      auth: fakeRouteAuth({ enabled: true }),
      sourceControl,
    });
    const context = {
      storage: { projects: seeded.projects, sourceControl, intake: seeded.intake },
      runtime: {
        configVersion: 'gitlab-test-v1',
        workItems: seeded.workItems,
        boards: createBoardRegistry(),
      },
    } as unknown as IntegrationContext;
    const reconcile = attachGitLabIssueReconciler(gitlab, context);

    await expect(reconcile?.()).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
    accessLevel = 10;
    await expect(reconcile?.()).resolves.toMatchObject({ checked: 1, closed: 1, failed: 0 });
    const decisions = await seeded.workItems.listDeferredDecisions(project.orgId, project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      decision: { type: 'transition', board: 'work', stage: 'done' },
    });
    const [item] = await seeded.workItems.list({ orgId: project.orgId, factoryProjectId: project.id });
    expect(item?.metadata).toMatchObject({
      author: 'Maintainer',
      authorTrusted: false,
      state: 'closed',
      labelColors: { bug: '#428BCA' },
    });
  });
});
