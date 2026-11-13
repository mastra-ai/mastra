/**
 * BDD coverage for the Intake swimlane's provider gating: every new card is
 * filed on the default board before the project's intake routes place it, so
 * only Work offers items without a card, and a Linear or Jira feed only when
 * one of that provider's sources is bound to the Factory project being viewed.
 */
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, newProjectWorkBoardInfo, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import { queryKeys } from '../../../../../api/keys';
import type { InstalledBoardInfo } from '../../../../../api/types';
import type { GithubIssue } from '../../services/factory';
import type { GitLabIssue } from '../../services/gitlab';
import type { IntakeSourceBinding } from '../../services/intake';
import { useBoardIntake } from '../useBoardIntake';
import { githubWithLinearConfig, gitlabOnlyConfig, connectedLinear, disabledGitlab } from './fixtures/query-loading';

const repository: LinkedRepositoryPayload = { projectRepositoryId: 'repo-1', slug: 'acme/app' };
const workBoard = builtinBoardCatalog.boards.find(board => board.id === 'work')!;

const githubIssue = (number: number, labels: string[] = []): GithubIssue => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/acme/app/issues/${number}`,
  author: 'octocat',
  labels,
  comments: 0,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
});

/** One Factory whose Work lists the open issues of its GitHub repository, a page at a time. */
function stubGithubFeed(pages: GithubIssue[][]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'factory-1', name: 'factory-1', repositories: [] }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const page = Number(params.get('page') ?? '1');
      // The labelled read feeds Triage; none of these issues is auto-triaged.
      if (params.get('label')) return HttpResponse.json({ issues: [], nextPage: null });
      return HttpResponse.json({ issues: pages[page - 1] ?? [], nextPage: page < pages.length ? page + 1 : null });
    }),
  );
}

const renderIntake = (factoryProjectId: string, definition: InstalledBoardInfo = workBoard) =>
  renderHookWithProviders(() => useBoardIntake({ factoryProjectId, repositories: [repository], definition }));

/** A card the project already holds for a feed item, as the server lists it. */
const filedCard = (integrationId: string, externalId: string, board: string) => ({
  id: `card-${externalId}`,
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: 'factory-1',
  board,
  externalSource: { integrationId, type: 'issue', externalId },
  parentWorkItemId: null,
  title: externalId,
  stages: ['intake'],
  stageHistory: [],
  sessions: {},
  metadata: {},
  triageType: null,
  acceptedAt: null,
  description: null,
  revision: 1,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
});

/** Answers the lookup of which feed items are already filed with `cards`. */
function stubFiledCards(factoryProjectId: string, cards: ReturnType<typeof filedCard>[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/work-items`, () =>
      HttpResponse.json({ workItems: cards }),
    ),
  );
}

describe('useBoardIntake sources the server files itself', () => {
  const bindings: IntakeSourceBinding[] = [
    { integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1' },
    { integrationId: 'jira', sourceId: '10001', factoryProjectId: 'factory-1' },
    { integrationId: 'incidentio', sourceId: 'incidentio:follow-ups', factoryProjectId: 'factory-1' },
  ];

  /** Linear, Jira and incident.io connected, selected and bound to the viewed Factory. */
  function stubFiledSources() {
    const listRequests: string[] = [];
    const listed = (provider: string) => () => {
      listRequests.push(provider);
      return HttpResponse.json({ issues: [], nextCursor: null });
    };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'factory-1', name: 'factory-1', repositories: [] }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: false, sourceIds: null },
            linear: { enabled: true, sourceIds: ['proj-1'] },
            jira: { enabled: true, sourceIds: ['10001'] },
            incidentio: { enabled: true, sourceIds: ['incidentio:follow-ups'] },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, workspace: { name: 'Acme', urlKey: 'acme' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/jira/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: true,
          mode: 'platform',
          site: null,
          sites: [],
          reason: 'ready',
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, mode: 'platform', reason: 'ready' }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/issues`, listed('linear')),
      http.get(`${TEST_BASE_URL}/web/jira/issues`, listed('jira')),
      http.get(`${TEST_BASE_URL}/web/incidentio/issues`, listed('incidentio')),
    );
    return listRequests;
  }

  it('never asks Linear, Jira or incident.io for their issue lists, and counts the board as fed by them', async () => {
    const listRequests = stubFiledSources();

    const { result, client } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(listRequests).toEqual([]);
    expect(result.current.available).toEqual([]);
    expect(result.current.candidates).toEqual([]);
    expect(result.current.fed).toBe(true);
  });

  it('keeps the board pending until the bindings of a connected source have loaded', async () => {
    stubFiledSources();
    let releaseBindings: () => void = () => {};
    const bindingsRequested = new Promise<void>(resolve => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/intake/bindings`, async () => {
          resolve();
          await new Promise<void>(release => (releaseBindings = release));
          return HttpResponse.json({ bindings });
        }),
      );
    });

    const { result } = renderIntake('factory-1');

    await bindingsRequested;
    expect(result.current.isPending).toBe(true);

    releaseBindings();
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});

describe('useBoardIntake items without a card', () => {
  const issues = [githubIssue(1), githubIssue(2)];

  it('counts feed items held back only when their card sits on another board', async () => {
    stubGithubFeed([issues]);
    stubFiledCards('factory-1', [filedCard('github', 'github-issue:2', 'release')]);

    const elsewhere = renderIntake('factory-1');
    await waitFor(() => expect(elsewhere.result.current.candidates).toHaveLength(1));
    expect(elsewhere.result.current.alreadyMaterialized).toBe(1);

    // The same card on this board is already visible in a column; nothing to explain.
    stubFiledCards('factory-1', [filedCard('github', 'github-issue:2', 'work')]);
    const here = renderIntake('factory-1');
    await waitFor(() => expect(here.result.current.candidates).toHaveLength(1));
    expect(here.result.current.alreadyMaterialized).toBe(0);
  });

  it('lists a GitHub issue with no card, and drops it once a board refresh reports it filed', async () => {
    stubGithubFeed([issues]);
    stubFiledCards('factory-1', []);
    const { result, client } = renderIntake('factory-1');
    await waitFor(() =>
      expect(result.current.candidates.map(candidate => candidate.sourceKey)).toEqual([
        'github-issue:1',
        'github-issue:2',
      ]),
    );

    stubFiledCards('factory-1', [filedCard('github', 'github-issue:2', 'work')]);
    // What a feed frame does to every read of the project's cards.
    act(() => void client.invalidateQueries({ queryKey: queryKeys.workItems('factory-1') }));

    await waitFor(() =>
      expect(result.current.candidates.map(candidate => candidate.sourceKey)).toEqual(['github-issue:1']),
    );
  });

  /** Answers each filed lookup only once released, with no card filed. */
  function holdFiledLookups() {
    const releases: (() => void)[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1/work-items`, async () => {
        await new Promise<void>(resolve => releases.push(resolve));
        return HttpResponse.json({ workItems: [] });
      }),
    );
    return {
      held: () => releases.length,
      answer: () => releases.splice(0).forEach(release => release()),
    };
  }

  describe('while the server has not said which feed items are already filed', () => {
    it('offers the next page of a feed only once the items of its first page are shown', async () => {
      stubGithubFeed([issues, []]);
      const filed = holdFiledLookups();

      const { result } = renderIntake('factory-1');

      // The feed answered, and its items are held back: the column has nothing to scroll past yet.
      await waitFor(() => expect(filed.held()).toBe(1));
      expect(result.current.candidates).toEqual([]);
      expect(result.current.isPending).toBe(true);
      expect(result.current.feedByColumn.intake?.hasNextPage).toBe(false);

      filed.answer();
      await waitFor(() => expect(result.current.candidates).toHaveLength(2));
      expect(result.current.isPending).toBe(false);
      expect(result.current.feedByColumn.intake?.hasNextPage).toBe(true);
    });

    it('keeps a later page loading until its items are known, with the earlier ones still listed', async () => {
      stubGithubFeed([issues, [githubIssue(3)]]);
      const { result } = renderIntake('factory-1');
      await waitFor(() => expect(result.current.candidates).toHaveLength(2));

      const filed = holdFiledLookups();
      await act(async () => {
        await result.current.feedByColumn.intake?.fetchNextPage();
      });
      await waitFor(() => expect(filed.held()).toBe(1));
      expect(result.current.candidates).toHaveLength(2);
      expect(result.current.isPending).toBe(false);
      expect(result.current.feedByColumn.intake?.isFetchingNextPage).toBe(true);

      filed.answer();
      await waitFor(() => expect(result.current.candidates).toHaveLength(3));
      expect(result.current.feedByColumn.intake?.isFetchingNextPage).toBe(false);
    });
  });

  it('leaves a feed as it is shown while a board refresh asks again which of its items are filed', async () => {
    stubGithubFeed([issues, []]);
    const { result, client } = renderIntake('factory-1');
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));

    const filed = holdFiledLookups();
    // What a feed frame does to every read of the project's cards.
    act(() => void client.invalidateQueries({ queryKey: queryKeys.workItems('factory-1') }));
    await waitFor(() => expect(filed.held()).toBe(1));

    // The items are known already: no row leaves, no page reads as loading, the next one stays on offer.
    expect(result.current.candidates).toHaveLength(2);
    expect(result.current.isPending).toBe(false);
    expect(result.current.feedByColumn.intake?.isFetchingNextPage).toBe(false);
    expect(result.current.feedByColumn.intake?.hasNextPage).toBe(true);

    filed.answer();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.candidates).toHaveLength(2);
  });

  it('reports a failed filed lookup as a failed feed, not an empty column, and asks again on retry', async () => {
    stubGithubFeed([issues]);
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1/work-items`, () =>
        HttpResponse.json({ error: 'nope' }, { status: 500 }),
      ),
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.feedByColumn.intake?.error).toBeInstanceOf(Error));
    expect(result.current.candidates).toEqual([]);
    expect(result.current.isPending).toBe(false);

    stubFiledCards('factory-1', []);
    await act(async () => {
      await result.current.feedByColumn.intake?.refetch();
    });
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(result.current.feedByColumn.intake?.error).toBeNull();
  });

  it('shows the one source picked when the lookup of a source the view hides fails, and looks nothing up for that source', async () => {
    stubGithubFeed([issues]);
    const sourceId = 'gitlab-project:encoded-source';
    const gitlabIssue: GitLabIssue = {
      id: '42',
      externalId: 'gitlab-issue:encoded-42',
      identifier: 'acme/app#42',
      title: 'Fix GitLab intake',
      url: 'https://gitlab.com/acme/app/-/issues/42',
      state: 'opened',
      stateType: 'unstarted',
      priority: null,
      assignee: 'ada',
      author: 'grace',
      source: 'acme/app',
      sourceId,
      labels: [],
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
    };
    const lookedUp: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: true, sourceIds: ['acme/app'] },
            gitlab: { enabled: true, sourceIds: [sourceId] },
            linear: { enabled: false, sourceIds: null },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () =>
        HttpResponse.json({ bindings: [{ integrationId: 'gitlab', sourceId, factoryProjectId: 'factory-1' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, reauthRequired: false }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/issues`, () =>
        HttpResponse.json({ issues: [gitlabIssue], nextCursor: null }),
      ),
      // The server answers for GitHub items and fails for GitLab ones.
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1/work-items`, ({ request }) => {
        const sources = new URL(request.url).searchParams.getAll('source');
        lookedUp.push(...sources);
        if (sources.some(source => source.includes('gitlab'))) {
          return HttpResponse.json({ error: 'nope' }, { status: 500 });
        }
        return HttpResponse.json({ workItems: [] });
      }),
    );

    const { result, client } = renderHookWithProviders(() =>
      useBoardIntake({
        factoryProjectId: 'factory-1',
        repositories: [repository],
        definition: workBoard,
        sourceFilters: { source: new Set(['github']), linearProject: new Set() },
      }),
    );

    // The hidden GitLab feed is read all the same: the person filters name its people.
    await waitFor(() =>
      expect(result.current.participantCandidates).toContainEqual(expect.objectContaining({ source: 'gitlab-issue' })),
    );
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    await waitFor(() => expect(client.isFetching()).toBe(0));

    expect(result.current.candidates.map(candidate => candidate.sourceKey)).toEqual([
      'github-issue:1',
      'github-issue:2',
    ]);
    expect(result.current.feedByColumn.intake?.error).toBeNull();
    expect(result.current.isPending).toBe(false);
    expect(lookedUp.filter(source => source.includes('gitlab'))).toEqual([]);
    expect(lookedUp).toContain('github-issue:1');
  });
});

describe('useBoardIntake GitLab routing', () => {
  it('never queries GitHub issues for a GitLab-linked Work board', async () => {
    const sourceId = 'gitlab-project:encoded-source';
    let githubIssueRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: false, sourceIds: [] },
            gitlab: { enabled: true, sourceIds: [sourceId] },
            linear: { enabled: false, sourceIds: [] },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () =>
        HttpResponse.json({
          bindings: [{ integrationId: 'gitlab', sourceId, factoryProjectId: 'factory-1' }],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, reauthRequired: false }),
      ),
      http.get(`${TEST_BASE_URL}/web/gitlab/issues`, () => HttpResponse.json({ issues: [], nextCursor: null })),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
      http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, () => {
        githubIssueRequests++;
        return HttpResponse.json({ issues: [], nextPage: null });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useBoardIntake({
        factoryProjectId: 'factory-1',
        repositories: [{ ...repository, provider: 'gitlab' }],
        definition: workBoard,
      }),
    );

    await waitFor(() => expect(result.current.active).toBe('gitlab'));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(githubIssueRequests).toBe(0);
  });

  it('browses the GitLab MR feed on Work for a GitLab-linked repository and never requests GitHub PRs', async () => {
    stubGithubFeed([[]]);
    let githubRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/gitlab/projects/repo-1/prs`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('factoryProjectId')).toBe('factory-1');
        expect(url.searchParams.get('page')).toBe('1');
        return HttpResponse.json({
          pullRequests: [
            {
              number: 5,
              externalId: 'gitlab-pr:encoded-5',
              title: 'Validate GitLab',
              url: 'https://gitlab.com/acme/app/-/merge_requests/5',
              author: 'rhys',
              assignees: [],
              requestedReviewers: [],
              baseBranch: 'main',
              headBranch: 'test-branch',
              createdAt: '2026-09-18T00:00:00Z',
              updatedAt: '2026-09-18T00:00:00Z',
            },
          ],
          nextPage: null,
        });
      }),
      http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/prs`, () => {
        githubRequests++;
        return HttpResponse.json({ pullRequests: [], nextPage: null });
      }),
    );
    const { result } = renderHookWithProviders(() =>
      useBoardIntake({
        factoryProjectId: 'factory-1',
        repositories: [{ ...repository, provider: 'gitlab' }],
        definition: workBoard,
      }),
    );

    await waitFor(() =>
      expect(result.current.candidates).toContainEqual(
        expect.objectContaining({ source: 'gitlab-pr', sourceKey: 'gitlab-pr:encoded-5' }),
      ),
    );
    expect(githubRequests).toBe(0);
  });

  it('offers Work an issue from a GitLab project bound to the Factory', async () => {
    const sourceId = 'gitlab-project:encoded-source';
    const issue: GitLabIssue = {
      id: '42',
      externalId: 'gitlab-issue:encoded-42',
      identifier: 'acme/app#42',
      title: 'Fix GitLab intake',
      url: 'https://gitlab.com/acme/app/-/issues/42',
      state: 'opened',
      stateType: 'unstarted',
      priority: null,
      assignee: 'ada',
      author: 'grace',
      source: 'acme/app',
      sourceId,
      labels: ['bug'],
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
    };
    server.use(
      http.get(TEST_BASE_URL + '/web/intake/config', () =>
        HttpResponse.json({
          config: {
            github: { enabled: false, sourceIds: null },
            gitlab: { enabled: true, sourceIds: [sourceId] },
            linear: { enabled: false, sourceIds: null },
          },
        }),
      ),
      http.get(TEST_BASE_URL + '/web/intake/bindings', () =>
        HttpResponse.json({
          bindings: [{ integrationId: 'gitlab', sourceId, factoryProjectId: 'factory-1' }],
        }),
      ),
      http.get(TEST_BASE_URL + '/web/gitlab/status', () =>
        HttpResponse.json({ enabled: true, configured: true, reauthRequired: false }),
      ),
      http.get(TEST_BASE_URL + '/web/gitlab/issues', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('factoryProjectId')).toBe('factory-1');
        expect(url.searchParams.has('board')).toBe(false);
        return HttpResponse.json({ issues: [issue], nextCursor: null });
      }),
      http.get(TEST_BASE_URL + '/web/linear/status', () => HttpResponse.json({ enabled: false, connected: false })),
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('gitlab'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.candidates[0]).toMatchObject({
      source: 'gitlab-issue',
      sourceKey: issue.externalId,
      column: 'intake',
    });
  });
});

describe('useBoardIntake GitHub issues', () => {
  const issues = [githubIssue(1, ['bug']), githubIssue(2, ['Release']), githubIssue(3, [])];

  function stubGithub() {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'factory-1', name: 'factory-1', repositories: [] }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
      http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, ({ request }) =>
        HttpResponse.json({
          issues: new URL(request.url).searchParams.get('label') ? [] : issues,
          nextCursor: null,
        }),
      ),
    );
  }
  it("offers an auto-triaged issue in Intake on a new project's Work, which has no Triage, and never fetches the triaged feed", async () => {
    stubGithub();
    const triagedRequests: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, ({ request }) => {
        const label = new URL(request.url).searchParams.get('label');
        if (label) triagedRequests.push(label);
        return HttpResponse.json({
          issues: label ? [] : [...issues, githubIssue(4, ['status: auto-triaged'])],
          nextCursor: null,
        });
      }),
    );

    const { result } = renderIntake('factory-1', newProjectWorkBoardInfo);

    await waitFor(() => expect(result.current.active).toBe('github'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(4));
    expect(result.current.candidates.find(candidate => candidate.sourceKey === 'github-issue:4')).toMatchObject({
      column: 'intake',
    });
    expect(result.current.feedByColumn).not.toHaveProperty('triage');
    expect(result.current.isTriagePending).toBe(false);
    expect(triagedRequests).toEqual([]);
  });

  it('keeps an auto-triaged issue out of Intake on Work that kept Triage, where the triaged feed offers it', async () => {
    stubGithub();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, ({ request }) =>
        HttpResponse.json({
          issues: new URL(request.url).searchParams.get('label')
            ? [githubIssue(4, ['status: auto-triaged'])]
            : [...issues, githubIssue(4, ['status: auto-triaged'])],
          nextCursor: null,
        }),
      ),
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('github'));
    await waitFor(() =>
      expect(result.current.candidates.filter(candidate => candidate.sourceKey === 'github-issue:4')).toEqual([
        expect.objectContaining({ column: 'triage' }),
      ]),
    );
    expect(result.current.feedByColumn).toHaveProperty('triage');
  });

  it('offers Work every issue of a selected repository, whatever its labels', async () => {
    stubGithub();

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('github'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(3));
    expect(result.current.candidates.map(candidate => candidate.sourceKey)).toEqual([
      'github-issue:1',
      'github-issue:2',
      'github-issue:3',
    ]);
  });

  it('withholds the GitHub feed from a custom board', async () => {
    stubGithub();

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
  });
});

describe('useBoardIntake query loading', () => {
  describe('when GitHub intake is ready and Linear status is still loading', () => {
    it('keeps intake pending until all configured sources are discovered', async () => {
      stubGithubFeed([[]]);
      let release = () => {};
      const held = new Promise<void>(resolve => {
        release = resolve;
      });
      let statusRequested = false;
      server.use(
        http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: githubWithLinearConfig })),
        http.get(`${TEST_BASE_URL}/web/linear/status`, async () => {
          statusRequested = true;
          await held;
          return HttpResponse.json(connectedLinear);
        }),
      );
      const { result, unmount } = renderIntake('factory-1');
      try {
        await waitFor(() => expect(statusRequested).toBe(true));
        expect(result.current.isPending).toBe(true);
        release();
        await waitFor(() => expect(result.current.isPending).toBe(false));
        expect(result.current.active).toBe('github');
      } finally {
        release();
        unmount();
      }
    });
  });

  describe('when intake configuration is still loading', () => {
    it('starts GitLab status before configuration resolves', async () => {
      stubGithubFeed([[]]);
      let release = () => {};
      const held = new Promise<void>(resolve => {
        release = resolve;
      });
      let requested = false;
      server.use(
        http.get(`${TEST_BASE_URL}/web/intake/config`, async () => {
          await held;
          return HttpResponse.json({ config: gitlabOnlyConfig });
        }),
        http.get(`${TEST_BASE_URL}/web/gitlab/status`, () => {
          requested = true;
          return HttpResponse.json(disabledGitlab);
        }),
      );
      const { unmount } = renderIntake('factory-1');
      try {
        await waitFor(() => expect(requested).toBe(true));
      } finally {
        release();
        unmount();
      }
    });
  });
});

describe('useBoardIntake across linked repositories', () => {
  const repositories: LinkedRepositoryPayload[] = [
    { projectRepositoryId: 'repo-1', slug: 'acme/app', externalId: '1' },
    { projectRepositoryId: 'repo-2', slug: 'acme/api', externalId: '2' },
    { projectRepositoryId: 'repo-3', slug: 'acme/docs', externalId: '3' },
  ];
  const issueIn = (repositoryId: number, number: number): GithubIssue => ({
    repositoryId,
    number,
    title: `Issue ${number}`,
    url: `https://github.com/acme/repo-${repositoryId}/issues/${number}`,
    author: 'octocat',
    labels: [],
    comments: 0,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
  });
  const pullIn = (repositoryId: number, number: number) => ({
    repositoryId,
    number,
    title: `PR ${number}`,
    url: `https://github.com/acme/repo-${repositoryId}/pull/${number}`,
    author: 'octocat',
    baseBranch: 'main',
    headBranch: `feat/${number}`,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
  });

  function stubRepositories(requested: string[]) {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'factory-1', name: 'factory-1', repositories: [] }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: true, sourceIds: ['acme/app', 'acme/api'] },
            linear: { enabled: false, sourceIds: null },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
      http.get(`${TEST_BASE_URL}/web/github/projects/:id/issues`, ({ params, request }) => {
        const id = String(params.id);
        const labelled = new URL(request.url).searchParams.get('label');
        if (!labelled) requested.push(`issues:${id}`);
        const repositoryId = Number(id.replace('repo-', ''));
        return HttpResponse.json({ issues: labelled ? [] : [issueIn(repositoryId, 5)], nextPage: null });
      }),
      http.get(`${TEST_BASE_URL}/web/github/projects/:id/prs`, ({ params }) => {
        const id = String(params.id);
        requested.push(`prs:${id}`);
        return HttpResponse.json({ pullRequests: [pullIn(Number(id.replace('repo-', '')), 9)], nextPage: null });
      }),
    );
  }

  it('offers Work the issues of every repository selected as an issue source, kept apart by repository', async () => {
    stubRepositories([]);

    const { result } = renderHookWithProviders(() =>
      useBoardIntake({
        factoryProjectId: 'factory-1',
        repositories,
        definition: workBoard,
      }),
    );

    await waitFor(() => expect(result.current.candidates).toHaveLength(5));
    expect(
      result.current.candidates.filter(candidate => candidate.source === 'github-issue').map(c => c.sourceKey),
    ).toEqual(['github:1:issue:5', 'github:2:issue:5']);
  });

  it('offers Work the pull requests of every linked GitHub repository, filed onto its Intake', async () => {
    const requested: string[] = [];
    stubRepositories(requested);

    const { result } = renderHookWithProviders(() =>
      useBoardIntake({
        factoryProjectId: 'factory-1',
        repositories,
        definition: workBoard,
      }),
    );

    await waitFor(() => expect(result.current.candidates).toHaveLength(5));
    const pullRequests = result.current.candidates.filter(candidate => candidate.source === 'github-pr');
    expect(pullRequests.map(candidate => [candidate.sourceKey, candidate.column])).toEqual([
      ['github:1:pull-request:9', 'intake'],
      ['github:2:pull-request:9', 'intake'],
      ['github:3:pull-request:9', 'intake'],
    ]);
    // Pull requests are not an issue source: Work still lists only its issue feeds.
    expect(result.current.available).toEqual(['github']);
    expect(requested).toEqual(expect.arrayContaining(['prs:repo-1', 'prs:repo-2', 'prs:repo-3']));
  });

  it('drops a second repository candidate that is already a card without hiding the first repository one', async () => {
    stubRepositories([]);

    stubFiledCards('factory-1', [filedCard('github', 'github:2:issue:5', 'work')]);
    const { result } = renderHookWithProviders(() =>
      useBoardIntake({
        factoryProjectId: 'factory-1',
        repositories,
        definition: workBoard,
      }),
    );

    await waitFor(() => expect(result.current.candidates).toHaveLength(4));
    expect(result.current.candidates.filter(candidate => candidate.source === 'github-issue')).toEqual([
      expect.objectContaining({ sourceKey: 'github:1:issue:5' }),
    ]);
  });
});
