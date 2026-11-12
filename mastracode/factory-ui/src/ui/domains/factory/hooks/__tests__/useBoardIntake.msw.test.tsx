/**
 * BDD coverage for the Intake swimlane: every new card is filed on the default
 * board before the project's intake routes place it, so only Work offers
 * records without a card. The server keeps that list, so the board reads it in
 * one request and asks no provider; a Linear, Jira, GitLab or incident.io feed
 * is offered only when one of that provider's sources is bound to the Factory
 * project being viewed.
 */
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, onTestFinished } from 'vitest';

import { builtinBoardCatalog, newProjectWorkBoardInfo, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import type { InstalledBoardInfo, IntakeCandidateInfo, IntakeCandidateListResponse } from '../../../../../api/types';
import {
  githubIssueRecord,
  githubPullRequestRecord,
  gitlabIssueRecord,
  gitlabMergeRequestRecord,
  intakeCandidatesHandler,
  jiraRecord,
  linearRecord,
} from '../../../../__tests__/fixtures/intakeCandidates';
import type { IntakeSourceBinding } from '../../services/intake';
import { useBoardIntake } from '../useBoardIntake';
import { githubWithLinearConfig, gitlabOnlyConfig, connectedLinear, disabledGitlab } from './fixtures/query-loading';

const repository: LinkedRepositoryPayload = { projectRepositoryId: 'repo-1', slug: 'acme/app' };
const workBoard = builtinBoardCatalog.boards.find(board => board.id === 'work')!;
const PROVIDER_LIST = /^\/web\/(github|gitlab|linear|jira|incidentio|intake)\/(.*\/)?(issues|prs|items)$/;

/** The paths this test's hook asked for, so a test can say which lists it read and which it left alone. */
function recordRequests() {
  const paths: string[] = [];
  const listener = ({ request }: { request: Request }) => {
    paths.push(new URL(request.url).pathname);
  };
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return {
    candidateReads: () => paths.filter(path => path.endsWith('/intake/candidates')),
    providerReads: () => paths.filter(path => PROVIDER_LIST.test(path)),
    cardReads: () => paths.filter(path => path.endsWith('/work-items')),
  };
}

function stubIntake(
  bindings: IntakeSourceBinding[],
  factoryIds: string[] = ['factory-1', 'factory-2'],
  records: IntakeCandidateInfo[] = [],
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
    intakeCandidatesHandler(TEST_BASE_URL, records),
  );
}

const renderIntake = (
  factoryProjectId: string,
  definition: InstalledBoardInfo = workBoard,
  repositories: readonly LinkedRepositoryPayload[] = [repository],
) => renderHookWithProviders(() => useBoardIntake({ factoryProjectId, repositories, definition }));

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
  const records = [linearRecord('ENG-1', { projectId: 'proj-1' }), linearRecord('REL-1', { projectId: 'proj-2' })];

  it('offers Work the issues of every source bound to the project, on its Intake', async () => {
    stubIntake(bindings, ['factory-1'], records);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('linear'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(result.current.candidates).toEqual([
      expect.objectContaining({ sourceKey: 'linear:ENG-1', source: 'linear-issue', column: 'intake' }),
      expect.objectContaining({ sourceKey: 'linear:REL-1', source: 'linear-issue', column: 'intake' }),
    ]);
  });

  it('offers a custom board no items without a card and never reads the list for it', async () => {
    stubIntake(bindings, ['factory-1'], records);
    const requests = recordRequests();

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
    expect(result.current.candidates).toEqual([]);
    expect(requests.candidateReads()).toEqual([]);
  });

  it('leaves out a record of a source that no longer feeds the board', async () => {
    // The server still holds the Jira record until its next read of Jira; nothing here offers Jira.
    stubIntake(bindings, ['factory-1'], [...records, jiraRecord('jira-1', 'OPS-1')]);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(result.current.candidates.map(candidate => candidate.source)).toEqual(['linear-issue', 'linear-issue']);
    // Nor do the person and label filters offer the people and labels of a source the board dropped.
    expect(result.current.participantCandidates.map(candidate => candidate.source)).toEqual([
      'linear-issue',
      'linear-issue',
    ]);
  });
});

describe('useBoardIntake reading the list the server keeps', () => {
  const jiraBinding: IntakeSourceBinding = { integrationId: 'jira', sourceId: '10001', factoryProjectId: 'factory-1' };

  function stubEverySource(
    answer: IntakeCandidateInfo[] | ((request: Request) => IntakeCandidateListResponse | Response),
    passes: IntakeCandidateListResponse['passes'] = [],
  ) {
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: true, sourceIds: ['acme/app'] },
            linear: { enabled: false, sourceIds: null },
            jira: { enabled: true, sourceIds: ['10001'] },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [jiraBinding] })),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
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
      intakeCandidatesHandler(TEST_BASE_URL, answer, passes),
    );
  }

  it('reads issues and pull requests of every source in one request and asks no provider', async () => {
    stubEverySource([githubIssueRecord(1), githubPullRequestRecord(2), jiraRecord('jira-1', 'OPS-1')]);
    const requests = recordRequests();

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.candidates).toHaveLength(3));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.candidates.map(candidate => candidate.source)).toEqual([
      'github-issue',
      'github-pr',
      'jira-issue',
    ]);
    expect(requests.candidateReads()).toEqual(['/web/factory/projects/factory-1/intake/candidates']);
    expect(requests.providerReads()).toEqual([]);
  });

  it('asks for the next page with the cursor the server gave', async () => {
    const cursors: Array<string | null> = [];
    stubEverySource(request => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      cursors.push(cursor);
      return cursor
        ? { candidates: [githubIssueRecord(2)], passes: [] }
        : { candidates: [githubIssueRecord(1)], nextCursor: 'page-2', passes: [] };
    });

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.feedByColumn.intake?.hasNextPage).toBe(true));
    await act(async () => {
      await result.current.feedByColumn.intake?.fetchNextPage();
    });

    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(result.current.candidates.map(candidate => candidate.sourceKey)).toEqual([
      'github:10:issue:1',
      'github:10:issue:2',
    ]);
    expect(result.current.feedByColumn.intake?.hasNextPage).toBe(false);
    expect(cursors).toEqual([null, 'page-2']);
  });

  it('keeps showing what the server last read of a source it could not read again, and says the list may be behind', async () => {
    stubEverySource(
      [jiraRecord('jira-1', 'OPS-1')],
      [
        { integrationId: 'github', kind: 'issue', completeAt: '2026-01-01T00:00:00.000Z', failed: false },
        { integrationId: 'jira', kind: 'issue', completeAt: '2026-01-01T00:00:00.000Z', failed: true },
      ],
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.feedByColumn.intake).toMatchObject({ stale: true, error: null });
    expect(result.current.active).toBe('jira');
  });

  it('does not call the list behind when every read of its sources went through', async () => {
    stubEverySource(
      [jiraRecord('jira-1', 'OPS-1')],
      [
        { integrationId: 'jira', kind: 'issue', completeAt: '2026-01-01T00:00:00.000Z', failed: false },
        // Linear is not a source of this board, so its failed read says nothing about this list.
        { integrationId: 'linear', kind: 'issue', completeAt: null, failed: true },
      ],
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.feedByColumn.intake?.stale).toBe(false);
    expect(result.current.active).toBe('github');
  });

  it('reports a failed read of the list as an error of no one source', async () => {
    stubEverySource(() => HttpResponse.json({ error: 'nope' }, { status: 500 }));

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.feedByColumn.intake?.error).toBeInstanceOf(Error));
    expect(result.current.candidates).toEqual([]);
    expect(result.current.active).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });
});

describe('useBoardIntake GitLab routing', () => {
  it('offers Work the merge requests of a GitLab-linked repository and none of GitHub', async () => {
    stubIntake(
      [],
      ['factory-1'],
      [gitlabMergeRequestRecord('gitlab-pr:encoded-5', 5, { title: 'Validate GitLab' }), githubPullRequestRecord(7)],
    );

    const { result } = renderIntake('factory-1', workBoard, [{ ...repository, provider: 'gitlab' }]);

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.candidates).toEqual([
      expect.objectContaining({ source: 'gitlab-pr', sourceKey: 'gitlab-pr:encoded-5', title: 'Validate GitLab' }),
    ]);
  });

  it('offers Work an issue from a GitLab project bound to the Factory', async () => {
    const sourceId = 'gitlab-project:encoded-source';
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
      http.get(TEST_BASE_URL + '/web/linear/status', () => HttpResponse.json({ enabled: false, connected: false })),
      intakeCandidatesHandler(TEST_BASE_URL, [gitlabIssueRecord('gitlab-issue:encoded-42', 'acme/app#42')]),
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('gitlab'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.candidates[0]).toMatchObject({
      source: 'gitlab-issue',
      sourceKey: 'gitlab-issue:encoded-42',
      column: 'intake',
    });
  });
});

describe('useBoardIntake GitHub issues', () => {
  const records = [
    githubIssueRecord(1, { labels: ['bug'] }),
    githubIssueRecord(2, { labels: ['Release'] }),
    githubIssueRecord(3),
  ];
  const triaged = githubIssueRecord(4, { labels: ['status: auto-triaged'] });

  function stubGithub(listed: IntakeCandidateInfo[] = records) {
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
      intakeCandidatesHandler(TEST_BASE_URL, listed),
    );
  }

  it("offers an auto-triaged issue in Intake on a new project's Work, which has no Triage", async () => {
    stubGithub([...records, triaged]);

    const { result } = renderIntake('factory-1', newProjectWorkBoardInfo);

    await waitFor(() => expect(result.current.active).toBe('github'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(4));
    expect(result.current.candidates.find(candidate => candidate.sourceKey === 'github:10:issue:4')).toMatchObject({
      column: 'intake',
    });
    expect(result.current.feedByColumn).not.toHaveProperty('triage');
    expect(result.current.isTriagePending).toBe(false);
  });

  it('offers an auto-triaged issue in Triage on Work that kept Triage, out of the same read', async () => {
    stubGithub([...records, triaged]);
    const requests = recordRequests();

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('github'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(4));
    expect(result.current.candidates.filter(candidate => candidate.sourceKey === 'github:10:issue:4')).toEqual([
      expect.objectContaining({ column: 'triage' }),
    ]);
    expect(result.current.feedByColumn).toHaveProperty('triage');
    expect(requests.candidateReads()).toHaveLength(1);
  });

  it('offers Work every issue of a selected repository, whatever its labels', async () => {
    stubGithub();

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('github'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(3));
    expect(result.current.candidates.map(candidate => candidate.sourceKey)).toEqual([
      'github:10:issue:1',
      'github:10:issue:2',
      'github:10:issue:3',
    ]);
  });

  it('withholds the GitHub feed from a custom board', async () => {
    stubGithub();

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
  });
});

function stubJiraIntake(
  bindings: IntakeSourceBinding[],
  {
    factoryIds = ['factory-1', 'factory-2'],
    githubEnabled = false,
    records = [jiraRecord('jira-issue-acme-eng-42', 'ENG-42')],
  }: { factoryIds?: string[]; githubEnabled?: boolean; records?: IntakeCandidateInfo[] } = {},
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
    intakeCandidatesHandler(TEST_BASE_URL, records),
  );
}

describe('useBoardIntake Jira gating', () => {
  const workBinding: IntakeSourceBinding = {
    integrationId: 'jira',
    sourceId: '10001',
    factoryProjectId: 'factory-1',
  };

  it('given Jira is enabled but not configured, when the board loads, then the Jira feed is withheld', async () => {
    stubJiraIntake([workBinding]);
    server.use(
      http.get(`${TEST_BASE_URL}/web/jira/status`, () =>
        HttpResponse.json({ enabled: true, configured: false, mode: 'platform', reason: 'organization_required' }),
      ),
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).not.toContain('jira');
    expect(result.current.candidates.filter(candidate => candidate.source === 'jira-issue')).toEqual([]);
  });

  it('given a source bound to Work on the viewed project, when the board loads, then the Jira feed is offered', async () => {
    stubJiraIntake([workBinding]);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toContain('jira'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
  });

  it('given the source is bound to another Factory, when the board loads, then the Jira feed is withheld', async () => {
    stubJiraIntake([workBinding]);

    const { result } = renderIntake('factory-2');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
    expect(result.current.candidates.filter(candidate => candidate.source === 'jira-issue')).toEqual([]);
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
    stubJiraIntake([workBinding]);

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
    expect(result.current.candidates).toEqual([]);
  });

  it('given an issue bound here, when candidates map, then they carry the identity the server holds the record under', async () => {
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

  it('given GitHub and Jira are available, when the board loads, then both feed intake candidates', async () => {
    stubJiraIntake([workBinding], {
      githubEnabled: true,
      records: [githubIssueRecord(1), jiraRecord('jira-issue-acme-eng-42', 'ENG-42')],
    });

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toEqual(['github', 'jira']));
    await waitFor(() =>
      expect(result.current.candidates.map(candidate => candidate.sourceKey)).toEqual([
        'github:10:issue:1',
        'jira-issue-acme-eng-42',
      ]),
    );
    expect(result.current.candidates.find(candidate => candidate.source === 'jira-issue')?.column).toBe('intake');
  });

  it('offers only the picked source, and still knows the people and labels of the others', async () => {
    stubJiraIntake([workBinding], {
      githubEnabled: true,
      records: [githubIssueRecord(1), jiraRecord('jira-issue-acme-eng-42', 'ENG-42')],
    });

    const { result } = renderHookWithProviders(() =>
      useBoardIntake({
        factoryProjectId: 'factory-1',
        repositories: [repository],
        definition: workBoard,
        sourceFilters: { source: new Set(['jira']), linearProject: new Set() },
      }),
    );

    await waitFor(() =>
      expect(result.current.candidates.map(candidate => candidate.sourceKey)).toEqual(['jira-issue-acme-eng-42']),
    );
    expect(result.current.participantCandidates.map(candidate => candidate.sourceKey)).toEqual([
      'github:10:issue:1',
      'jira-issue-acme-eng-42',
    ]);
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
    it('starts GitLab status and the list before configuration resolves', async () => {
      stubIntake([]);
      const requests = recordRequests();
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
        await waitFor(() => expect(requests.candidateReads()).toHaveLength(1));
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
  const records = [
    githubIssueRecord(5, { repositoryId: 1 }),
    githubIssueRecord(5, { repositoryId: 2 }),
    githubPullRequestRecord(9, { repositoryId: 1 }),
    githubPullRequestRecord(9, { repositoryId: 2 }),
    githubPullRequestRecord(9, { repositoryId: 3 }),
  ];

  function stubRepositories() {
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
      intakeCandidatesHandler(TEST_BASE_URL, records),
    );
  }

  it('offers Work the issues of every repository, kept apart by repository', async () => {
    stubRepositories();

    const { result } = renderIntake('factory-1', workBoard, repositories);

    await waitFor(() => expect(result.current.candidates).toHaveLength(5));
    expect(
      result.current.candidates.filter(candidate => candidate.source === 'github-issue').map(c => c.sourceKey),
    ).toEqual(['github:1:issue:5', 'github:2:issue:5']);
  });

  it('offers Work the pull requests of every linked GitHub repository, filed onto its Intake, in the one read', async () => {
    stubRepositories();
    const requests = recordRequests();

    const { result } = renderIntake('factory-1', workBoard, repositories);

    await waitFor(() => expect(result.current.candidates).toHaveLength(5));
    const pullRequests = result.current.candidates.filter(candidate => candidate.source === 'github-pr');
    expect(pullRequests.map(candidate => [candidate.sourceKey, candidate.column])).toEqual([
      ['github:1:pull-request:9', 'intake'],
      ['github:2:pull-request:9', 'intake'],
      ['github:3:pull-request:9', 'intake'],
    ]);
    // Pull requests are not an issue source: Work still lists only its issue feeds.
    expect(result.current.available).toEqual(['github']);
    // Three repositories and two kinds of record cost the same single request as one repository.
    expect(requests.candidateReads()).toHaveLength(1);
    expect(requests.providerReads()).toEqual([]);
    // Intake no longer compares its list with the cards, so it reads no board.
    expect(requests.cardReads()).toEqual([]);
  });
});
