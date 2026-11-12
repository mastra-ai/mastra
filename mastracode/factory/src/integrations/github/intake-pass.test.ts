/**
 * The GitHub side of the Intake candidates: the passes over a project's linked repositories and the
 * step that follows each event, on real storage, the real GitHub rules and the real dispatcher.
 * Only GitHub's own listings are faked.
 */
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import type { IntakeIssue } from '../../capabilities/intake.js';
import type { PullRequest } from '../../capabilities/version-control.js';
import { IntakeRoutes } from '../../routes/intake.js';
import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import type { IntakeConfig } from '../../storage/domains/intake/base.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { IntegrationContext } from '../base.js';
import { runIntakePasses } from '../intake-pass.js';
import { resolveGithubRules } from './default-rules.js';
import { attachGithubIntakePasses, withChangedGithubIntakeSources } from './intake-pass.js';
import { attachGithubRules, GithubRules } from './rules.js';
import type { ParsedGithubWebhook } from './webhook.js';

const BEFORE_LINK = '2020-01-01T00:00:00Z';
const AFTER_LINK = '2030-01-01T00:00:00Z';

const listedIssue = (number: number, createdAt: string, extra: Partial<IntakeIssue> = {}): IntakeIssue =>
  ({
    id: String(number),
    identifier: `#${number}`,
    title: `Issue ${number}`,
    url: `https://github.com/acme/repo/issues/${number}`,
    author: 'maintainer',
    state: 'open',
    stateType: 'unstarted',
    priority: null,
    assignee: null,
    assignees: [],
    source: 'acme/repo',
    labels: [],
    commentCount: 0,
    createdAt,
    updatedAt: createdAt,
    ...extra,
  }) as IntakeIssue;

const listedPullRequest = (number: number, createdAt: string): PullRequest =>
  ({
    id: String(number),
    title: `Pull request ${number}`,
    url: `https://github.com/acme/repo/pull/${number}`,
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

function issueEvent(action: 'opened' | 'closed', number: number, createdAt = AFTER_LINK): ParsedGithubWebhook {
  return {
    event: 'issues',
    deliveryId: `delivery-${action}-${number}`,
    payload: {
      action,
      installation: { id: 7 },
      repository: { id: 10, full_name: 'acme/repo' },
      sender: { login: 'maintainer' },
      issue: {
        number,
        title: `Issue ${number}`,
        html_url: `https://github.com/acme/repo/issues/${number}`,
        state: action === 'closed' ? 'closed' : 'open',
        user: { login: 'maintainer' },
        assignees: [],
        labels: [],
        created_at: createdAt,
      },
    },
  } as ParsedGithubWebhook;
}

async function setup() {
  const seeded = await createFactoryStorageForTests();
  const workItems = seeded.workItems;
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Project 1' } });
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '7',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '10', slug: 'acme/repo', defaultBranch: 'main' },
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
    sandboxWorkdir: '/workspace',
  });

  const select = (sourceIds: string[] | null, enabled = true) =>
    seeded.intake.saveConfig({ orgId: 'org-1', config: { github: { enabled, sourceIds } } });
  await select(['acme/repo']);

  const open = { issues: [] as IntakeIssue[], pullRequests: [] as PullRequest[] };
  const github = {
    rules: resolveGithubRules(),
    slug: 'factory-app',
    getRepositoryCollaboratorPermission: vi.fn().mockResolvedValue('write'),
    intake: { listIssues: vi.fn(async () => ({ issues: open.issues, nextCursor: null })) },
    versionControl: { listPullRequests: vi.fn(async () => ({ pullRequests: open.pullRequests, nextCursor: null })) },
  };
  const boards = createBoardRegistry();
  const context = {
    storage: {
      sourceControl,
      generic: seeded.integrations.forIntegration('github'),
      projects: seeded.projects,
      intake: seeded.intake,
    },
    runtime: { configVersion: 'factory-config-v1', workItems, boards },
  } as unknown as IntegrationContext;
  const offered = vi.spyOn(GithubRules.prototype, 'ingest');
  const passes = attachGithubIntakePasses(github as never, context);
  const scope = { orgId: 'org-1', factoryProjectId: project.id };

  return {
    workItems,
    scope,
    open,
    github,
    offered,
    select,
    seeded,
    pass: () => runIntakePasses(passes),
    /** What the worker runs between two full passes, after it has looked for missed pull requests. */
    discovery: withChangedGithubIntakeSources(
      async () => ({ repositories: 0, listed: 0, created: 0, repaired: 0, failed: 0, errors: [] }),
      passes,
    )!,
    /** The save of Settings › Intake, through its route. */
    save: (config: IntakeConfig) => {
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
        await next();
      });
      mountApiRoutes(
        app as never,
        new IntakeRoutes({
          auth: fakeRouteAuth(),
          audit: { emit: async () => {} },
          intake: seeded.intake,
          projects: seeded.projects,
          integrations: [{ id: 'github', intake: github.intake as never }],
        }).routes(),
      );
      return app.request('/web/intake/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
    },
    event: attachGithubRules(github as never, context)!,
    candidates: async (kind?: 'issue' | 'pull-request') =>
      (await workItems.listIntakeCandidates({ ...scope, ...(kind ? { kind } : {}), limit: 100 })).candidates,
    cards: () => workItems.list(scope),
    fileProposedCards: () =>
      new FactoryDecisionDispatcher({
        controller: {} as never,
        storage: workItems,
        boards,
        transitionService: new FactoryTransitionService({
          storage: workItems,
          boards,
          configVersion: 'factory-config-v1',
        }),
        factoryProjectExists: async () => true,
        ownerId: 'github-intake-test',
      }).runOnce(new Date(Date.now() + 1_000)),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the GitHub intake passes', () => {
  it('offers what was open before the repository was linked and hands none of it to the rules', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    t.open.pullRequests = [listedPullRequest(2, BEFORE_LINK)];

    expect(await t.pass()).toMatchObject({ failed: 0, offered: 0, stored: 2 });

    expect((await t.candidates('issue')).map(candidate => candidate.title)).toEqual(['Issue 1']);
    expect((await t.candidates('pull-request')).map(candidate => candidate.title)).toEqual(['Pull request 2']);
    expect(t.offered).not.toHaveBeenCalled();
    await t.fileProposedCards();
    expect(await t.cards()).toEqual([]);
  });

  it('hands an issue opened after the link to the rules once, and its card adopts the candidate', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(42, AFTER_LINK)];

    expect(await t.pass()).toMatchObject({ failed: 0, offered: 1, stored: 1 });
    expect(await t.pass()).toMatchObject({ failed: 0, offered: 0, stored: 0 });
    expect(t.offered).toHaveBeenCalledTimes(1);

    const [candidate] = await t.candidates();
    await t.fileProposedCards();
    const [card] = await t.cards();
    expect(card?.workItem.id).toBe(candidate!.workItemId);
    expect(await t.candidates()).toEqual([]);

    expect(await t.pass()).toMatchObject({ failed: 0, offered: 0, stored: 0, removed: 0 });
    expect(t.offered).toHaveBeenCalledTimes(1);
  });

  it('leaves an issue alone whose card was filed before keys named the repository', async () => {
    const t = await setup();
    await t.workItems.upsert({
      ...t.scope,
      userId: 'user-1',
      input: {
        title: 'Issue 1',
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:1',
          url: 'https://github.com/acme/repo/issues/1',
        },
      },
    });
    t.open.issues = [listedIssue(1, AFTER_LINK)];

    expect(await t.pass()).toMatchObject({ failed: 0, offered: 0, stored: 0 });

    expect(await t.candidates()).toEqual([]);
    expect(await t.cards()).toHaveLength(1);
  });

  it('stops offering what GitHub no longer lists as open, and nothing when GitHub cannot be read', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK), listedIssue(2, BEFORE_LINK)];
    await t.pass();

    t.github.intake.listIssues.mockRejectedValueOnce(new Error('GitHub is down'));
    expect(await t.pass()).toMatchObject({ failed: 1, removed: 0 });
    expect(await t.candidates()).toHaveLength(2);

    t.open.issues = [listedIssue(2, BEFORE_LINK)];
    expect(await t.pass()).toMatchObject({ failed: 0, removed: 1 });
    expect((await t.candidates()).map(candidate => candidate.title)).toEqual(['Issue 2']);
  });

  it('removes nothing while the listing is cut off before its end', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK), listedIssue(2, BEFORE_LINK)];
    await t.pass();

    t.open.issues = [listedIssue(2, BEFORE_LINK)];
    t.github.intake.listIssues.mockImplementation(async () => ({ issues: t.open.issues, nextCursor: 'more' }));
    expect(await t.pass()).toMatchObject({ failed: 0, removed: 0 });
    expect(await t.candidates()).toHaveLength(2);

    t.github.intake.listIssues.mockImplementation(async () => ({ issues: t.open.issues, nextCursor: null }));
    expect(await t.pass()).toMatchObject({ failed: 0, removed: 1 });
  });

  it('never offers a pull request that an issue card already holds', async () => {
    const t = await setup();
    const { item: card } = await t.workItems.upsert({
      ...t.scope,
      userId: 'user-1',
      input: {
        title: 'Issue 1',
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github:10:issue:1',
          url: 'https://github.com/acme/repo/issues/1',
        },
      },
    });
    const attached = await t.workItems.attachSource({
      orgId: 'org-1',
      id: card.id,
      source: {
        integrationId: 'github',
        type: 'pull-request',
        externalId: 'github:10:pull-request:2',
        url: 'https://github.com/acme/repo/pull/2',
      },
      metadata: null,
    });
    expect(attached?.attached).toBe(true);
    t.open.pullRequests = [listedPullRequest(2, AFTER_LINK)];

    expect(await t.pass()).toMatchObject({ failed: 0, offered: 0, stored: 0 });

    expect(t.offered).not.toHaveBeenCalled();
    expect(await t.candidates()).toEqual([]);
  });

  it('lists each linked repository once a pass, however many cards the board holds', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    await t.pass();
    const callsOf = async () => {
      const before =
        t.github.intake.listIssues.mock.calls.length + t.github.versionControl.listPullRequests.mock.calls.length;
      await t.pass();
      return (
        t.github.intake.listIssues.mock.calls.length +
        t.github.versionControl.listPullRequests.mock.calls.length -
        before
      );
    };
    const onEmptyBoard = await callsOf();

    for (let index = 0; index < 40; index += 1) {
      await t.workItems.upsert({ ...t.scope, userId: 'user-1', input: { title: `Native card ${index}` } });
    }

    expect(onEmptyBoard).toBe(2);
    expect(await callsOf()).toBe(onEmptyBoard);
  });
});

describe('a GitHub event and the Intake candidates', () => {
  it('offers a newly opened issue in Intake until the rules have filed its card', async () => {
    const t = await setup();

    await t.event(issueEvent('opened', 42));
    const [candidate] = await t.candidates();
    expect(candidate).toMatchObject({ title: 'Issue 42' });

    await t.fileProposedCards();
    const [card] = await t.cards();
    expect(card?.workItem.id).toBe(candidate!.workItemId);
    expect(await t.candidates()).toEqual([]);
  });

  it('offers nothing for an event on an issue whose card was filed before keys named the repository', async () => {
    const t = await setup();
    await t.workItems.upsert({
      ...t.scope,
      userId: 'user-1',
      input: {
        title: 'Issue 42',
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/acme/repo/issues/42',
        },
      },
    });

    await t.event({ ...issueEvent('opened', 42), deliveryId: 'delivery-edited-42' });

    expect(await t.candidates()).toEqual([]);
  });

  it('stores the same candidate the pass stores, so the two do not rewrite each other', async () => {
    const t = await setup();
    await t.event(issueEvent('opened', 42));
    t.open.issues = [listedIssue(42, AFTER_LINK)];
    const changed = vi.fn();
    t.workItems.onIntakeChanged(changed);

    expect(await t.pass()).toMatchObject({ failed: 0, offered: 0, stored: 0 });

    expect(changed).not.toHaveBeenCalled();
  });

  it('stops offering an issue the moment GitHub closes it', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    await t.pass();
    expect(await t.candidates()).toHaveLength(1);

    await t.event(issueEvent('closed', 1, BEFORE_LINK));

    expect(await t.candidates()).toEqual([]);
  });
});

describe('a GitHub event that lands while a pass is listing', () => {
  /** GitHub answers the listing with what was open when it was asked, and the event arrives before the answer does. */
  const duringTheListing = (t: Awaited<ReturnType<typeof setup>>, event: ParsedGithubWebhook) =>
    t.github.intake.listIssues.mockImplementationOnce(async () => {
      const answer = { issues: [...t.open.issues], nextCursor: null };
      await t.event(event);
      return answer;
    });

  it('keeps the issue an opened event stored, which the listing was read too early to hold', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    await t.pass();
    duringTheListing(t, issueEvent('opened', 42));

    expect(await t.pass()).toMatchObject({ failed: 0, removed: 0 });

    const offered = await t.candidates();
    expect(offered.map(candidate => candidate.title)).toEqual(['Issue 42', 'Issue 1']);
    await t.fileProposedCards();
    const [card, ...others] = await t.cards();
    expect(others).toEqual([]);
    expect(card?.workItem.id).toBe(offered[0]!.workItemId);
  });

  it('does not hand the rules a second time an issue the event stored and the listing holds too', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(42, AFTER_LINK)];
    duringTheListing(t, issueEvent('opened', 42));

    expect(await t.pass()).toMatchObject({ failed: 0, offered: 0, stored: 0 });

    expect(t.offered).toHaveBeenCalledTimes(1);
    expect(await t.candidates()).toHaveLength(1);
  });

  it('does not offer again the issue a closed event removed, which the listing still holds', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK), listedIssue(42, AFTER_LINK)];
    await t.pass();
    expect(t.offered).toHaveBeenCalledTimes(1);
    duringTheListing(t, issueEvent('closed', 42));

    expect(await t.pass()).toMatchObject({ failed: 0, offered: 0, stored: 0 });

    expect((await t.candidates()).map(candidate => candidate.title)).toEqual(['Issue 1']);
    // The closed event went through the rules; the pass handed them nothing more.
    expect(t.offered).toHaveBeenCalledTimes(2);
  });

  it('does not store again a closed issue the listing holds with a change', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    await t.pass();
    t.open.issues = [listedIssue(1, BEFORE_LINK, { labels: ['bug'] })];
    duringTheListing(t, issueEvent('closed', 1, BEFORE_LINK));

    expect(await t.pass()).toMatchObject({ failed: 0, stored: 0 });

    expect(await t.candidates()).toEqual([]);
  });

  it('leaves the issue an event closed and opened again, which the listing was read in between to lack', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    await t.pass();
    t.open.issues = [];
    t.github.intake.listIssues.mockImplementationOnce(async () => {
      await t.event(issueEvent('closed', 1, BEFORE_LINK));
      await t.event({ ...issueEvent('opened', 1, BEFORE_LINK), deliveryId: 'delivery-reopened-1' });
      return { issues: [], nextCursor: null };
    });

    expect(await t.pass()).toMatchObject({ failed: 0, removed: 0 });

    expect((await t.candidates()).map(candidate => candidate.title)).toEqual(['Issue 1']);
  });
});

describe('the repositories an organization takes issues from', () => {
  it('offers no issue of a linked repository nobody picked as an issue source, and still its pull requests', async () => {
    const t = await setup();
    await t.select(null);
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    t.open.pullRequests = [listedPullRequest(2, BEFORE_LINK)];

    expect(await t.pass()).toMatchObject({ failed: 0, stored: 1 });

    expect(t.github.intake.listIssues).not.toHaveBeenCalled();
    expect((await t.candidates()).map(candidate => candidate.title)).toEqual(['Pull request 2']);
  });

  it('offers no issue while GitHub intake is switched off', async () => {
    const t = await setup();
    await t.select(['acme/repo'], false);
    t.open.issues = [listedIssue(1, BEFORE_LINK)];

    await t.pass();
    await t.event(issueEvent('opened', 42));

    expect(await t.candidates('issue')).toEqual([]);
  });

  it('stops offering the issues of a repository once it is no longer picked', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    await t.pass();
    expect(await t.candidates('issue')).toHaveLength(1);

    await t.select([]);

    expect(await t.pass()).toMatchObject({ failed: 0, removed: 1 });
    expect(await t.candidates('issue')).toEqual([]);
  });

  it('offers nothing for an event on an issue of a repository nobody picked', async () => {
    const t = await setup();
    await t.select(['acme/other']);

    await t.event(issueEvent('opened', 42));

    expect(await t.candidates()).toEqual([]);
  });
});

describe('a selection saved in Settings › Intake', () => {
  it('asks GitHub for nothing when it is saved, and the next run reads only the project it changed', async () => {
    const t = await setup();
    const sourceControl = t.seeded.sourceControl.forIntegration('github');
    const other = await t.seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Project 2' } });
    const [installation] = await sourceControl.installations.list({ orgId: 'org-1' });
    const repository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation!.id, externalId: '11', slug: 'acme/other', defaultBranch: 'main' },
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: other.id,
      installationId: installation!.id,
      createdByUserId: 'user-1',
    });
    await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/workspace',
    });
    const issuesOf = async (factoryProjectId: string) =>
      (
        await t.workItems.listIntakeCandidates({ orgId: 'org-1', factoryProjectId, kind: 'issue', limit: 100 })
      ).candidates.map(candidate => candidate.title);
    const read = () =>
      (t.github.intake.listIssues.mock.calls as unknown as Array<[{ sourceIds: string[] }]>).flatMap(
        ([input]) => input.sourceIds,
      );
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    await t.pass();
    expect(await issuesOf(other.id)).toEqual([]);
    t.github.intake.listIssues.mockClear();
    t.github.versionControl.listPullRequests.mockClear();

    expect((await t.save({ github: { enabled: true, sourceIds: ['acme/repo', 'acme/other'] } })).status).toBe(200);

    expect(t.github.intake.listIssues).not.toHaveBeenCalled();
    expect(t.github.versionControl.listPullRequests).not.toHaveBeenCalled();
    expect(await issuesOf(other.id)).toEqual([]);

    expect(await t.discovery([])).toMatchObject({ failed: 0 });

    expect(read()).toEqual(['acme/other']);
    expect(t.github.versionControl.listPullRequests).not.toHaveBeenCalled();
    expect(await issuesOf(other.id)).toEqual(['Issue 1']);

    await t.discovery([]);
    expect(read()).toEqual(['acme/other']);
  });

  it('stops offering the issues of a repository dropped from it without asking GitHub', async () => {
    const t = await setup();
    t.open.issues = [listedIssue(1, BEFORE_LINK)];
    await t.pass();
    t.github.intake.listIssues.mockClear();

    await t.save({ github: { enabled: true, sourceIds: [] } });
    expect(await t.candidates('issue')).toHaveLength(1);

    expect(await t.discovery([])).toMatchObject({ failed: 0 });
    expect(await t.candidates('issue')).toEqual([]);
    expect(t.github.intake.listIssues).not.toHaveBeenCalled();
  });
});
