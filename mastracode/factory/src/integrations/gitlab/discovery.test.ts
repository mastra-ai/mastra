import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import { fakeRouteAuth } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { IntegrationContext } from '../base.js';
import { PlatformGitLabIntegration } from '../platform/gitlab/integration.js';
import { encodeSourceId, GitLabIntegration } from './integration.js';
import { attachGitLabReconciler } from './reconciler.js';

// Platform reports every connection on gitlab.com, so both modes share the host.
const HOST = 'gitlab.com';
const PROJECT_PATH = 'acme/app';
const SOURCE_ID = encodeSourceId({ host: HOST, projectId: '101' });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const PLATFORM_URL = 'https://integrations.example.com';
const PLATFORM_CONNECTION = 'a1b_acme';

/**
 * A Factory with one linked GitLab repository whose issues are routed to it, and no card yet.
 * `direct` reaches GitLab with the deployment token; `platform` goes through a stored Platform
 * connection and its proxy.
 */
async function linkedFactory(mergeRequests: () => Response, mode: 'direct' | 'platform' = 'direct') {
  const connectionId = mode === 'platform' ? PLATFORM_CONNECTION : 'direct';
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration('gitlab');
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory' } });
  const installation = await sourceControl.installations.upsert({
    orgId: project.orgId,
    connectedByUserId: project.createdBy,
    externalId: connectionId,
    providerMetadata: { host: HOST, connection: { type: 'oauth', accessToken: `gitlab-connection:${connectionId}` } },
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
    const requested = new URL(String(input));
    if (requested.origin === PLATFORM_URL && requested.pathname === '/v2/connections') {
      return json({
        connections: [{ id: PLATFORM_CONNECTION, integrationId: 'gitlab', status: 'active', accountLabel: 'acme' }],
      });
    }
    const proxied = `/v2/connections/${PLATFORM_CONNECTION}/proxy`;
    const url = new URL(requested);
    if (requested.origin === PLATFORM_URL && requested.pathname.startsWith(proxied)) {
      url.pathname = requested.pathname.slice(proxied.length);
    } else if (mode === 'platform') {
      throw new Error(`Platform mode reached GitLab outside the proxy: ${requested}`);
    }
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
  if (mode === 'platform') vi.stubGlobal('fetch', fetchImpl);
  const gitlab =
    mode === 'platform'
      ? new PlatformGitLabIntegration({ clientConfig: { baseUrl: PLATFORM_URL, accessToken: 'platform-token' } })
      : new GitLabIntegration({
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
  /** GitLab member lookups, which every rule evaluation of a listed event pays twice. */
  const memberLookups = () => fetchImpl.mock.calls.filter(([input]) => String(input).includes('/members/all')).length;
  return { gitlab, context, sweep: attachGitLabReconciler(gitlab, context)!, filed, seeded, memberLookups };
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GitLab sweep discovery', () => {
  it('keeps sweeping on a server that still sets the old off switch', async () => {
    vi.stubEnv('MASTRACODE_GITLAB_RECONCILE_ENABLED', 'false');
    vi.stubEnv('MASTRACODE_GITLAB_ISSUE_RECONCILE_ENABLED', 'false');
    const { gitlab, context } = await linkedFactory(() => Response.json([]));

    expect(gitlab.workers(context).map(worker => worker.name)).toEqual(['gitlab-issue-reconcile']);
  });

  describe('when GitLab sent no webhook for a new merge request and a new issue', () => {
    it.each([
      ['a direct token', 'direct'],
      ['a stored Platform connection', 'platform'],
    ] as const)('files both cards on the next sweep through %s, with no board open', async (_, mode) => {
      const { sweep, filed } = await linkedFactory(() => json([openMergeRequest]), mode);

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

  describe('when nothing changed at GitLab since the last sweep', () => {
    const pushed = (sha: string, updatedAt: string) => ({ ...openMergeRequest, sha, updated_at: updatedAt });

    it('asks GitLab for no members and commits nothing, while a new head and a new merge request still go through the rules', async () => {
      let mergeRequests = [pushed('abc', '2030-01-02T00:00:00Z')];
      const { sweep, filed, seeded, memberLookups } = await linkedFactory(() => json(mergeRequests));
      await sweep();
      const afterFirstSweep = await filed();
      const commits = vi.spyOn(seeded.workItems, 'commitRuleEvaluation');

      const lookupsBefore = memberLookups();
      await expect(sweep()).resolves.toMatchObject({ failed: 0 });
      expect(memberLookups()).toBe(lookupsBefore);
      expect(commits).not.toHaveBeenCalled();
      expect(await filed()).toEqual(afterFirstSweep);

      mergeRequests = [pushed('def', '2030-01-03T00:00:00Z'), { ...openMergeRequest, id: 9006, iid: 6, title: 'Later MR' }];
      await sweep();
      expect(memberLookups()).toBeGreaterThan(lookupsBefore);
      expect((await filed()).map(decision => decision.title)).toContain('Later MR');
    });

    it('still files what it ignored before its source was selected', async () => {
      const { sweep, filed, seeded } = await linkedFactory(() => json([openMergeRequest]));
      await seeded.intake.saveConfig({ orgId: 'org-1', config: { gitlab: { enabled: true, sourceIds: [] } } });
      await sweep();
      expect(await filed()).toEqual([]);

      await seeded.intake.saveConfig({ orgId: 'org-1', config: { gitlab: { enabled: true, sourceIds: [SOURCE_ID] } } });
      await sweep();

      expect((await filed()).map(decision => decision.title)).toEqual(['Unannounced MR', 'Unannounced issue']);
    });
  });

  describe("when another project's cards cannot be read", () => {
    it('still files the cards of the project that can be read, and reports the failure', async () => {
      const { sweep, filed, seeded } = await linkedFactory(() => json([openMergeRequest]));
      const unreadable = await seeded.projects.create({ orgId: 'org-2', userId: 'user-2', input: { name: 'Down' } });
      const listShared = seeded.workItems.listShared.bind(seeded.workItems);
      vi.spyOn(seeded.workItems, 'listShared').mockImplementation(async scope => {
        if (scope.factoryProjectId === unreadable.id) throw new Error('cards unreadable');
        return listShared(scope);
      });

      const summary = await sweep();

      expect(summary.errors).toContainEqual({ projectId: unreadable.id, error: 'cards unreadable' });
      expect(await filed()).toEqual([
        { id: expect.any(String), type: 'upsertLinkedWorkItem', title: 'Unannounced MR', author: 'rhys' },
        { id: expect.any(String), type: 'upsertLinkedWorkItem', title: 'Unannounced issue', author: 'grace' },
      ]);
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
