import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import { fakeRouteAuth } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { IntegrationContext } from '../base.js';
import { encodeSourceId, GitLabIntegration } from './integration.js';
import { attachGitLabReconciler } from './reconciler.js';

const HOST = 'gitlab.example.com';
const PROJECT_PATH = 'acme/app';
const SOURCE_ID = encodeSourceId({ host: HOST, projectId: '101' });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A Factory with one linked GitLab repository whose issues are routed to it, and no card yet. */
async function linkedFactory(mergeRequests: () => Response) {
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration('gitlab');
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
  const installation = await sourceControl.installations.upsert({
    orgId: project.orgId,
    connectedByUserId: project.createdBy,
    externalId: 'direct',
    providerMetadata: { host: HOST, connection: { type: 'oauth', accessToken: 'gitlab-connection:direct' } },
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: project.orgId,
    input: { installationId: installation.id, externalId: '101', slug: PROJECT_PATH, defaultBranch: 'main' },
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
  });

  const fetchImpl = vi.fn<typeof fetch>(async input => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v4/projects/101') {
      return json({ id: 101, path_with_namespace: PROJECT_PATH, default_branch: 'main' });
    }
    if (url.pathname === '/api/v4/projects/101/merge_requests') return mergeRequests();
    if (url.pathname === '/api/v4/projects/101/issues') {
      return json([
        {
          id: 1042,
          iid: 42,
          project_id: 101,
          title: 'Unannounced issue',
          state: 'opened',
          web_url: `https://${HOST}/${PROJECT_PATH}/-/issues/42`,
          author: { name: 'Grace', username: 'grace' },
          labels: [],
          created_at: '2030-01-01T00:00:00Z',
          updated_at: '2030-01-01T00:00:00Z',
        },
      ]);
    }
    if (url.pathname.endsWith('/members/all')) {
      return json([
        { id: 7, username: 'rhys', state: 'active', access_level: 40 },
        { id: 8, username: 'grace', state: 'active', access_level: 40 },
      ]);
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
  gitlab.versionControl.initialize({ storage: sourceControl });
  const context = {
    storage: { projects: seeded.projects, sourceControl, intake: seeded.intake },
    runtime: { configVersion: 'gitlab-test-v1', workItems: seeded.workItems, boards: createBoardRegistry() },
  } as unknown as IntegrationContext;
  /** The governed decisions that put a card on the board, as the rules ingress committed them. */
  const filed = async () =>
    (await seeded.workItems.listDeferredDecisions(project.orgId, project.id)).map(({ id, decision }) => ({
      id,
      type: decision.type,
      ...('title' in decision && { title: decision.title, author: decision.metadata?.author }),
    }));
  return { sweep: attachGitLabReconciler(gitlab, context)!, filed };
}

const openMergeRequest = {
  id: 9005,
  iid: 5,
  project_id: 101,
  title: 'Unannounced MR',
  state: 'opened',
  web_url: `https://${HOST}/${PROJECT_PATH}/-/merge_requests/5`,
  author: { name: 'Rhys', username: 'rhys' },
  source_branch: 'feature',
  target_branch: 'main',
  sha: 'abc',
  created_at: '2030-01-01T00:00:00Z',
  updated_at: '2030-01-01T00:00:00Z',
};

describe('GitLab sweep discovery', () => {
  describe('when GitLab sent no webhook for a new merge request and a new issue', () => {
    it('files both cards on the next sweep, with no board open and no signed-in person', async () => {
      const { sweep, filed } = await linkedFactory(() => json([openMergeRequest]));

      await expect(sweep()).resolves.toMatchObject({ failed: 0, errors: [] });

      const afterFirstSweep = await filed();
      expect(afterFirstSweep).toEqual([
        { id: expect.any(String), type: 'upsertLinkedWorkItem', title: 'Unannounced MR', author: 'rhys' },
        { id: expect.any(String), type: 'upsertLinkedWorkItem', title: 'Unannounced issue', author: 'grace' },
      ]);
      await sweep();
      expect(await filed()).toEqual(afterFirstSweep);
    });
  });

  describe('when the merge requests of a linked repository cannot be listed', () => {
    it('still files the routed issue and reports the failure', async () => {
      const { sweep, filed } = await linkedFactory(() => json({ message: 'boom' }, 500));

      const summary = await sweep();

      expect(summary.failed).toBe(1);
      expect(await filed()).toEqual([
        { id: expect.any(String), type: 'upsertLinkedWorkItem', title: 'Unannounced issue', author: 'grace' },
      ]);
    });
  });
});
