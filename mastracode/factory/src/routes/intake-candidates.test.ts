/**
 * The Intake column's list as the browser reads it: real storage and the real GitHub passes behind
 * the real route. Only GitHub's own listings are faked.
 */
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import type { IntakeIssue } from '../capabilities/intake.js';
import type { PullRequest } from '../capabilities/version-control.js';
import type { IntegrationContext } from '../integrations/base.js';
import { resolveGithubRules } from '../integrations/github/default-rules.js';
import { attachGithubIntakePasses } from '../integrations/github/intake-pass.js';
import { runIntakePasses } from '../integrations/intake-pass.js';
import { readBoardVersion } from '../storage/domains/work-items/board-version.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { buildIntakeCandidateRoutes } from './intake-candidates.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import type { TestAuthUser } from './test-utils.js';

const ORG = 'org-1';
const asAlice = { workosId: 'user-alice', organizationId: ORG };
const BEFORE_LINK = '2020-01-01T00:00:00Z';

interface Listed {
  candidates: Array<{ workItemId: string; title: string; key: string | null; createdAt: string }>;
  nextCursor?: string;
  passes: Array<{ integrationId: string; kind: string; completeAt: string | null; failed: boolean }>;
}

const listedIssue = (slug: string, number: number, createdAt: string): IntakeIssue =>
  ({
    id: String(number),
    identifier: `#${number}`,
    title: `Issue ${number}`,
    url: `https://github.com/${slug}/issues/${number}`,
    author: 'maintainer',
    state: 'open',
    stateType: 'unstarted',
    priority: null,
    assignee: null,
    assignees: [],
    source: slug,
    labels: ['bug'],
    commentCount: 0,
    createdAt,
    updatedAt: createdAt,
  }) as IntakeIssue;

const listedPullRequest = (slug: string, number: number, createdAt: string): PullRequest =>
  ({
    id: String(number),
    title: `Pull request ${number}`,
    url: `https://github.com/${slug}/pull/${number}`,
    author: 'contributor',
    assignees: [],
    requestedReviewers: [],
    labels: [],
    body: '',
    state: 'open',
    draft: false,
    merged: false,
    mergeable: true,
    baseBranch: 'main',
    headBranch: `feature-${number}`,
    headSha: 'abc',
    createdAt,
    updatedAt: createdAt,
  }) as PullRequest;

async function setup(options: { repositories?: number; user?: TestAuthUser | null } = {}) {
  const seed = await createFactoryStorageForTests();
  const sourceControl = seed.sourceControl.forIntegration('github');
  const project = await seed.projects.create({ orgId: ORG, userId: 'user-alice', input: { name: 'Project 1' } });
  const installation = await sourceControl.installations.upsert({
    orgId: ORG,
    connectedByUserId: 'user-alice',
    externalId: '7',
  });
  const connection = await sourceControl.connections.create({
    orgId: ORG,
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-alice',
  });
  const slugs: string[] = [];
  for (let index = 0; index < (options.repositories ?? 1); index++) {
    const slug = `acme/repo-${index}`;
    slugs.push(slug);
    const repository = await sourceControl.repositories.upsert({
      orgId: ORG,
      input: { installationId: installation.id, externalId: String(10 + index), slug, defaultBranch: 'main' },
    });
    await sourceControl.projectRepositories.link({
      orgId: ORG,
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-alice',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace',
    });
  }

  const open = { issues: [] as IntakeIssue[], pullRequests: [] as PullRequest[], unreadable: false };
  const github = {
    rules: resolveGithubRules(),
    slug: 'factory-app',
    getRepositoryCollaboratorPermission: vi.fn().mockResolvedValue('write'),
    intake: {
      listIssues: vi.fn(async (input: { sourceIds: string[] }) => {
        if (open.unreadable) throw new Error('GitHub is down');
        return { issues: open.issues.filter(issue => input.sourceIds.includes(issue.source)), nextCursor: null };
      }),
    },
    versionControl: {
      listPullRequests: vi.fn(async (input: { sourceId: string }) => ({
        pullRequests: open.pullRequests.filter(pullRequest => pullRequest.url.includes(`/${input.sourceId}/`)),
        nextCursor: null,
      })),
    },
  };
  const context = {
    storage: {
      sourceControl,
      generic: seed.integrations.forIntegration('github'),
      projects: seed.projects,
    },
    runtime: { configVersion: 'factory-config-v1', workItems: seed.workItems, boards: createBoardRegistry() },
  } as unknown as IntegrationContext;
  const passes = attachGithubIntakePasses(github as never, context);

  const user = options.user === undefined ? asAlice : options.user;
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    buildIntakeCandidateRoutes({
      auth: fakeRouteAuth(),
      projects: seed.projects,
      workItems: seed.workItems,
      settings: seed.integrations,
    }),
  );

  const path = `/web/factory/projects/${project.id}/intake/candidates`;
  return {
    seed,
    project,
    slugs,
    open,
    github,
    app,
    path,
    pass: () => runIntakePasses(passes),
    read: async (query = '') => {
      const response = await app.request(`${path}${query}`);
      expect(response.status).toBe(200);
      return (await response.json()) as Listed;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /web/factory/projects/:id/intake/candidates', () => {
  it('lists the open records with no card, newest first, with what a card filed for one starts from', async () => {
    const t = await setup();
    t.open.issues = [
      listedIssue('acme/repo-0', 1, '2020-01-01T00:00:00Z'),
      listedIssue('acme/repo-0', 2, '2020-01-03T00:00:00Z'),
    ];
    t.open.pullRequests = [listedPullRequest('acme/repo-0', 3, '2020-01-02T00:00:00Z')];
    await t.pass();

    const listed = await t.read();

    expect(listed.candidates.map(candidate => candidate.title)).toEqual(['Issue 2', 'Pull request 3', 'Issue 1']);
    expect(listed.nextCursor).toBeUndefined();
    expect(listed.candidates[0]).toMatchObject({
      workItemId: expect.any(String),
      title: 'Issue 2',
      externalSource: {
        integrationId: 'github',
        type: 'issue',
        externalId: 'github:10:issue:2',
        url: 'https://github.com/acme/repo-0/issues/2',
      },
      key: 'acme/repo-0#2',
      url: 'https://github.com/acme/repo-0/issues/2',
      labels: ['bug'],
      author: 'maintainer',
      metadata: { number: 2, githubRepositoryId: 10 },
      createdAt: '2020-01-03T00:00:00.000Z',
    });
  });

  it('leaves out a record once a card is filed for it', async () => {
    const t = await setup();
    t.open.issues = [listedIssue('acme/repo-0', 1, BEFORE_LINK), listedIssue('acme/repo-0', 2, '2020-01-02T00:00:00Z')];
    await t.pass();
    const [first] = (await t.read()).candidates;

    const filed = await t.seed.workItems.upsert({
      orgId: ORG,
      userId: 'user-alice',
      factoryProjectId: t.project.id,
      input: {
        title: 'Issue 2',
        stages: ['intake'],
        sessions: {},
        metadata: {},
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github:10:issue:2' },
      },
    });

    expect(first?.title).toBe('Issue 2');
    expect(filed.item.workItem.id).toBe(first?.workItemId);
    expect((await t.read()).candidates.map(candidate => candidate.title)).toEqual(['Issue 1']);
  });

  it('pages through the list without repeating or skipping a record', async () => {
    const t = await setup();
    t.open.issues = Array.from({ length: 7 }, (_, index) =>
      listedIssue('acme/repo-0', index + 1, `2020-01-0${index + 1}T00:00:00Z`),
    );
    await t.pass();

    const titles: string[] = [];
    let query = '?limit=3';
    for (let page = 0; page < 5; page++) {
      const listed = await t.read(query);
      titles.push(...listed.candidates.map(candidate => candidate.title));
      if (!listed.nextCursor) break;
      query = `?limit=3&cursor=${encodeURIComponent(listed.nextCursor)}`;
    }

    expect(titles).toEqual([7, 6, 5, 4, 3, 2, 1].map(number => `Issue ${number}`));
  });

  it('narrows the list to one kind of record or to one integration', async () => {
    const t = await setup();
    t.open.issues = [listedIssue('acme/repo-0', 1, BEFORE_LINK)];
    t.open.pullRequests = [listedPullRequest('acme/repo-0', 2, BEFORE_LINK)];
    await t.pass();

    expect((await t.read('?kind=issue')).candidates.map(candidate => candidate.title)).toEqual(['Issue 1']);
    expect((await t.read('?kind=pull-request')).candidates.map(candidate => candidate.title)).toEqual([
      'Pull request 2',
    ]);
    expect((await t.read('?source=github')).candidates).toHaveLength(2);
    expect((await t.read('?source=linear')).candidates).toEqual([]);
  });

  it('says when each provider was last read to the end, and when the latest pass failed', async () => {
    const t = await setup();
    t.open.issues = [listedIssue('acme/repo-0', 1, BEFORE_LINK)];

    expect((await t.read()).passes).toEqual([]);

    await t.pass();
    const read = (await t.read()).passes;
    expect(read).toEqual([
      { integrationId: 'github', kind: 'issue', completeAt: expect.any(String), failed: false },
      { integrationId: 'github', kind: 'pull-request', completeAt: expect.any(String), failed: false },
    ]);

    t.open.unreadable = true;
    await t.pass();
    const failed = await t.read();
    expect(failed.passes).toEqual([
      { integrationId: 'github', kind: 'issue', completeAt: read[0]?.completeAt, failed: true },
      { integrationId: 'github', kind: 'pull-request', completeAt: expect.any(String), failed: false },
    ]);
    expect(failed.candidates.map(candidate => candidate.title)).toEqual(['Issue 1']);
  });

  it.each([1, 12])('calls no provider and writes nothing over ten reads with %i linked repositories', async count => {
    const t = await setup({ repositories: count });
    t.open.issues = t.slugs.map((slug, index) => listedIssue(slug, index + 1, BEFORE_LINK));
    await t.pass();
    const calls = () => ({
      issues: t.github.intake.listIssues.mock.calls.length,
      pullRequests: t.github.versionControl.listPullRequests.mock.calls.length,
    });
    const afterPass = calls();
    const boardVersion = () => readBoardVersion(t.seed.storage.ops, ORG, t.project.id);
    const version = await boardVersion();
    const stored = vi.spyOn(t.seed.workItems, 'storeIntakeCandidate');
    const removed = vi.spyOn(t.seed.workItems, 'removeIntakeCandidate');
    const changed = vi.fn();
    t.seed.workItems.onIntakeChanged(changed);

    for (let read = 0; read < 10; read++) {
      expect((await t.read()).candidates).toHaveLength(count);
    }

    expect(afterPass).toEqual({ issues: count, pullRequests: count });
    expect(calls()).toEqual(afterPass);
    expect(stored).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(await boardVersion()).toBe(version);
  });

  it('answers a project of another organization, and a malformed id, as not found', async () => {
    const t = await setup({ user: { workosId: 'user-mallory', organizationId: 'org-2' } });
    t.open.issues = [listedIssue('acme/repo-0', 1, BEFORE_LINK)];
    await t.pass();

    const other = await t.app.request(t.path);
    const malformed = await t.app.request('/web/factory/projects/not-a-uuid/intake/candidates');

    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: 'Project not found' });
    expect(malformed.status).toBe(404);
  });

  it('refuses a reader who is not signed in, or who has no organization', async () => {
    const anonymous = await setup({ user: null });
    const personal = await setup({ user: { workosId: 'user-alice' } });

    expect((await anonymous.app.request(anonymous.path)).status).toBe(401);
    expect((await personal.app.request(personal.path)).status).toBe(403);
  });

  it('refuses a cursor it did not hand out, and a kind it does not know', async () => {
    const t = await setup();

    const cursor = await t.app.request(`${t.path}?cursor=nonsense`);
    const kind = await t.app.request(`${t.path}?kind=thread`);

    expect(cursor.status).toBe(400);
    expect(await cursor.json()).toEqual({ error: 'invalid_cursor' });
    expect(kind.status).toBe(400);
  });
});
