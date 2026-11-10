/**
 * BDD coverage for the Intake swimlane's provider gating: every new card is
 * filed on the default board before the project's intake routes place it, so
 * only Work offers items without a card, and a Linear or Jira feed only when
 * one of that provider's sources is bound to the Factory project being viewed.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import { queryKeys } from '../../../../../api/keys';
import type { InstalledBoardInfo } from '../../../../../api/types';
import type { GithubIssue } from '../../services/factory';
import type { GitLabIssue } from '../../services/gitlab';
import type { IntakeSourceBinding } from '../../services/intake';
import type { JiraIssue } from '../../services/jira';
import type { LinearIssue } from '../../services/linear';
import { useBoardIntake } from '../useBoardIntake';
import { githubWithLinearConfig, gitlabOnlyConfig, connectedLinear, disabledGitlab } from './fixtures/query-loading';

const repository: LinkedRepositoryPayload = { projectRepositoryId: 'repo-1', slug: 'acme/app' };
const workBoard = builtinBoardCatalog.boards.find(board => board.id === 'work')!;

const linearIssue = (identifier: string, sourceId: string): LinearIssue => ({
  id: identifier,
  identifier,
  title: `${identifier} title`,
  url: `https://linear.app/acme/issue/${identifier}`,
  state: 'Todo',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: null,
  team: 'ENG',
  sourceId,
  labels: [],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
});

function stubIntake(
  bindings: IntakeSourceBinding[],
  factoryIds: string[] = ['factory-1', 'factory-2'],
  issues: LinearIssue[] = [],
) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: factoryIds.map(id => ({ id, name: id, repositories: [] })),
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: false, sourceIds: null },
          linear: { enabled: true, sourceIds: ['proj-1', 'proj-2'] },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: true, connected: true, workspace: { name: 'Acme', urlKey: 'acme' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/issues`, () => HttpResponse.json({ issues, nextCursor: null })),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, () => HttpResponse.json({ issues: [] })),
  );
}

const renderIntake = (
  factoryProjectId: string,
  definition: InstalledBoardInfo = workBoard,
  knownSourceKeys = new Set<string>(),
  elsewhereSourceKeys?: Set<string>,
) =>
  renderHookWithProviders(() =>
    useBoardIntake({ factoryProjectId, repositories: [repository], definition, knownSourceKeys, elsewhereSourceKeys }),
  );

describe('useBoardIntake Linear gating', () => {
  it('given a source bound to Work on the viewed project, when the board loads, then the Linear feed is offered', async () => {
    stubIntake([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1' }]);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toContain('linear'));
  });

  it('reports a failed binding load instead of treating it as nothing bound', async () => {
    stubIntake([]);
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual(['linear']);
    expect(result.current.candidates).toEqual([]);
    expect(result.current.feedByColumn.intake?.error).toBeInstanceOf(Error);
  });

  it('keeps a Linear-eligible board pending until its bindings have loaded', async () => {
    const binding: IntakeSourceBinding = {
      integrationId: 'linear',
      sourceId: 'proj-1',
      factoryProjectId: 'factory-1',
    };
    stubIntake([binding]);
    let releaseBindings: () => void = () => {};
    const bindingsRequested = new Promise<void>(resolve => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/intake/bindings`, async () => {
          resolve();
          await new Promise<void>(release => (releaseBindings = release));
          return HttpResponse.json({ bindings: [binding] });
        }),
      );
    });

    const { result } = renderIntake('factory-1');

    await bindingsRequested;
    // Config may already be in; bindings are not. Either way the board must
    // not present itself as a settled, feed-less board.
    expect(result.current.available).not.toContain('linear');
    expect(result.current.isPending).toBe(true);

    releaseBindings();
    await waitFor(() => expect(result.current.available).toContain('linear'));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('given the source is bound to another Factory, when the board loads, then the Linear feed is withheld', async () => {
    stubIntake([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1' }]);

    const { result } = renderIntake('factory-2');

    await waitFor(() => expect(result.current.available).toEqual([]));
    expect(result.current.available).not.toContain('linear');
  });

  it('given no bindings and a single Factory, when the board loads, then the Linear feed is still withheld', async () => {
    stubIntake([], ['factory-1']);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
  });
});

describe('useBoardIntake project-bound sources', () => {
  const bindings: IntakeSourceBinding[] = [
    { integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1' },
    { integrationId: 'linear', sourceId: 'proj-2', factoryProjectId: 'factory-1' },
  ];
  const issues = [linearIssue('ENG-1', 'proj-1'), linearIssue('REL-1', 'proj-2')];

  it('offers Work the issues of every source bound to the project, on its Intake', async () => {
    stubIntake(bindings, ['factory-1'], issues);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('linear'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(result.current.candidates).toEqual([
      expect.objectContaining({ sourceKey: 'linear:ENG-1', column: 'intake' }),
      expect.objectContaining({ sourceKey: 'linear:REL-1', column: 'intake' }),
    ]);
  });

  it('offers a custom board no items without a card, since intake routes place them after Work files them', async () => {
    stubIntake(bindings, ['factory-1'], issues);

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
    expect(result.current.candidates).toEqual([]);
  });

  it('counts feed items held back only when their card sits on another board', async () => {
    stubIntake(bindings, ['factory-1'], issues);
    const known = new Set(['linear:REL-1']);

    const elsewhere = renderIntake('factory-1', workBoard, known, known);
    await waitFor(() => expect(elsewhere.result.current.candidates).toHaveLength(1));
    expect(elsewhere.result.current.alreadyMaterialized).toBe(1);

    // The same card on this board is already visible in a column; nothing to explain.
    const here = renderIntake('factory-1', workBoard, known, new Set());
    await waitFor(() => expect(here.result.current.candidates).toHaveLength(1));
    expect(here.result.current.alreadyMaterialized).toBe(0);
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
        knownSourceKeys: new Set(),
      }),
    );

    await waitFor(() => expect(result.current.active).toBe('gitlab'));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(githubIssueRequests).toBe(0);
  });

  it('browses the GitLab MR feed on Work for a GitLab-linked repository and never requests GitHub PRs', async () => {
    stubIntake([]);
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
        knownSourceKeys: new Set(),
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
  const githubIssue = (number: number, labels: string[]): GithubIssue => ({
    number,
    title: `Issue ${number}`,
    url: `https://github.com/acme/app/issues/${number}`,
    author: 'octocat',
    labels,
    comments: 0,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
  });
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

const jiraIssue: JiraIssue = {
  id: 'jira-issue-acme-eng-42',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://acme.atlassian.net/browse/ENG-42',
  state: 'To Do',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  project: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
  sourceId: '10001',
};

function stubJiraIntake(
  bindings: IntakeSourceBinding[],
  {
    factoryIds = ['factory-1', 'factory-2'],
    githubEnabled = false,
    issues = [jiraIssue],
  }: { factoryIds?: string[]; githubEnabled?: boolean; issues?: JiraIssue[] } = {},
) {
  const requestedFactoryIds: Array<string | null> = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: factoryIds.map(id => ({ id, name: id, repositories: [] })),
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: githubEnabled, sourceIds: githubEnabled ? ['acme/app'] : null },
          linear: { enabled: false, sourceIds: null },
          jira: { enabled: true, sourceIds: ['10001'] },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
    http.get(`${TEST_BASE_URL}/web/jira/status`, () =>
      HttpResponse.json({ enabled: true, configured: true, mode: 'platform', site: null, sites: [], reason: 'ready' }),
    ),
    http.get(`${TEST_BASE_URL}/web/jira/issues`, ({ request }) => {
      requestedFactoryIds.push(new URL(request.url).searchParams.get('factoryProjectId'));
      return HttpResponse.json({ issues, nextCursor: null });
    }),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, () => HttpResponse.json({ issues: [] })),
  );
  return requestedFactoryIds;
}

describe('useBoardIntake Jira gating', () => {
  const workBinding: IntakeSourceBinding = {
    integrationId: 'jira',
    sourceId: '10001',
    factoryProjectId: 'factory-1',
  };

  it('given Jira is enabled but not configured, when the board loads, then the Jira feed is withheld', async () => {
    const requestedFactoryIds = stubJiraIntake([workBinding]);
    server.use(
      http.get(`${TEST_BASE_URL}/web/jira/status`, () =>
        HttpResponse.json({ enabled: true, configured: false, mode: 'platform', reason: 'organization_required' }),
      ),
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).not.toContain('jira');
    expect(requestedFactoryIds).toEqual([]);
  });

  it('given a source bound to Work on the viewed project, when the board loads, then the Jira feed is offered with Factory-scoped requests', async () => {
    const requestedFactoryIds = stubJiraIntake([workBinding]);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toContain('jira'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(requestedFactoryIds).toEqual(['factory-1']);
  });

  it('given the source is bound to another Factory, when the board loads, then the Jira feed is withheld and nothing is fetched', async () => {
    const requestedFactoryIds = stubJiraIntake([workBinding]);

    const { result } = renderIntake('factory-2');

    await waitFor(() => expect(result.current.available).toEqual([]));
    expect(result.current.available).not.toContain('jira');
    expect(requestedFactoryIds).toEqual([]);
  });

  it('given no routing and several Factories, when the board loads, then the Jira feed is withheld', async () => {
    stubJiraIntake([]);

    const { result } = renderIntake('factory-2');

    await waitFor(() => expect(result.current.available).toEqual([]));
  });

  it('given no routing and a single Factory, when the board loads, then the Jira feed is still withheld', async () => {
    stubJiraIntake([], { factoryIds: ['factory-1'] });

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
  });

  it('withholds the Jira feed from a custom board', async () => {
    const requestedFactoryIds = stubJiraIntake([workBinding]);

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
    expect(requestedFactoryIds).toEqual([]);
  });

  it('given an issue bound here, when candidates map, then they carry the jira source identity', async () => {
    stubJiraIntake([workBinding]);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    const candidate = result.current.candidates[0];
    expect(candidate.sourceKey).toBe('jira-issue-acme-eng-42');
    expect(candidate.source).toBe('jira-issue');
    expect(candidate.url).toBe('https://acme.atlassian.net/browse/ENG-42');
    expect(candidate.column).toBe('intake');
    expect(candidate.metadata).toMatchObject({ identifier: 'ENG-42' });
  });

  it('given the issue is already a card, when candidates map, then the known source key is dropped', async () => {
    stubJiraIntake([workBinding]);

    const { result } = renderIntake('factory-1', workBoard, new Set(['jira-issue-acme-eng-42']));

    await waitFor(() => expect(result.current.participantCandidates).toHaveLength(1));
    expect(result.current.candidates).toEqual([]);
  });

  it('given GitHub and Jira are available, when the board loads, then both feed intake candidates', async () => {
    stubJiraIntake([workBinding], {
      githubEnabled: true,
    });

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toEqual(['github', 'jira']));
    await waitFor(() =>
      expect(result.current.candidates.map(candidate => candidate.sourceKey)).toContain('jira-issue-acme-eng-42'),
    );
    expect(result.current.candidates.find(candidate => candidate.source === 'jira-issue')?.column).toBe('intake');
  });
});

describe('useBoardIntake query loading', () => {
  describe('when GitHub intake is ready and Linear status is still loading', () => {
    it('keeps intake pending until all configured sources are discovered', async () => {
      stubIntake([]);
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
      stubIntake([]);
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
        knownSourceKeys: new Set(),
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
        knownSourceKeys: new Set(),
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

    const { result } = renderHookWithProviders(() =>
      useBoardIntake({
        factoryProjectId: 'factory-1',
        repositories,
        definition: workBoard,
        knownSourceKeys: new Set(['github:2:issue:5']),
      }),
    );

    await waitFor(() => expect(result.current.candidates).toHaveLength(4));
    expect(result.current.candidates.filter(candidate => candidate.source === 'github-issue')).toEqual([
      expect.objectContaining({ sourceKey: 'github:1:issue:5' }),
    ]);
  });
});
