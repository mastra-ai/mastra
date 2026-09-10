/**
 * BDD coverage for the Intake swimlane's Linear gating: a board only offers the
 * Linear feed when a Linear source is explicitly bound to that board of the
 * Factory project being viewed. Nothing is routed implicitly.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import type { InstalledBoardInfo } from '../../../../../api/types';
import type { GithubIssue } from '../../services/factory';
import type { IntakeLabelRoute, IntakeSourceBinding } from '../../services/intake';
import type { LinearIssue } from '../../services/linear';
import { useBoardIntake } from '../useBoardIntake';

const repository = { projectRepositoryId: 'repo-1', slug: 'acme/app' } as LinkedRepositoryPayload;
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
    http.get(`${TEST_BASE_URL}/web/intake/label-routes`, () => HttpResponse.json({ routes: [] })),
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
    useBoardIntake({ factoryProjectId, repository, definition, knownSourceKeys, elsewhereSourceKeys }),
  );

describe('useBoardIntake Linear gating', () => {
  it('given a source bound to Work on the viewed project, when the board loads, then the Linear feed is offered', async () => {
    stubIntake([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1', board: 'work' }]);

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
      board: 'work',
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
    stubIntake([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1', board: 'work' }]);

    const { result } = renderIntake('factory-2');

    await waitFor(() => expect(result.current.available).toEqual([]));
    expect(result.current.available).not.toContain('linear');
  });

  it('given a source routed to the Factory without a board, when Work loads, then the Linear feed is withheld', async () => {
    stubIntake(
      [{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1', board: null }],
      ['factory-1'],
    );

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
  });

  it('given no bindings and a single Factory, when the board loads, then the Linear feed is still withheld', async () => {
    stubIntake([], ['factory-1']);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
  });
});

describe('useBoardIntake board-bound sources', () => {
  const bindings: IntakeSourceBinding[] = [
    { integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1', board: 'work' },
    { integrationId: 'linear', sourceId: 'proj-2', factoryProjectId: 'factory-1', board: 'release' },
  ];
  const issues = [linearIssue('ENG-1', 'proj-1'), linearIssue('REL-1', 'proj-2')];

  it('offers a custom board only the issues bound to it, on its initial phase', async () => {
    stubIntake(bindings, ['factory-1'], issues);

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.active).toBe('linear'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.candidates[0]).toMatchObject({ sourceKey: 'linear:REL-1', column: 'queued' });
    expect(result.current.feedByColumn).toHaveProperty('queued');
    expect(result.current.feedByColumn).not.toHaveProperty('intake');
  });

  it('keeps issues bound to another board off Work', async () => {
    stubIntake(bindings, ['factory-1'], issues);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('linear'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.candidates[0]).toMatchObject({ sourceKey: 'linear:ENG-1', column: 'intake' });
  });

  it('counts feed items held back only when their card sits on another board', async () => {
    stubIntake(bindings, ['factory-1'], issues);
    const known = new Set(['linear:REL-1']);

    const elsewhere = renderIntake('factory-1', releaseBoard, known, known);
    await waitFor(() => expect(elsewhere.result.current.isPending).toBe(false));
    expect(elsewhere.result.current.candidates).toEqual([]);
    expect(elsewhere.result.current.alreadyMaterialized).toBe(1);

    // The same card on this board is already visible in a column; nothing to explain.
    const here = renderIntake('factory-1', releaseBoard, known, new Set());
    await waitFor(() => expect(here.result.current.isPending).toBe(false));
    expect(here.result.current.candidates).toEqual([]);
    expect(here.result.current.alreadyMaterialized).toBe(0);
  });

  it('withholds the Linear feed from a custom board with nothing bound to it', async () => {
    stubIntake([bindings[0]!], ['factory-1'], issues);

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
  });
});

describe('useBoardIntake GitHub label routes', () => {
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

  function stubGithub(routes: IntakeLabelRoute[]) {
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
      http.get(`${TEST_BASE_URL}/web/intake/label-routes`, ({ request }) => {
        const factoryProjectId = new URL(request.url).searchParams.get('factoryProjectId');
        return HttpResponse.json({ routes: routes.filter(route => route.factoryProjectId === factoryProjectId) });
      }),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
      http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, ({ request }) =>
        HttpResponse.json({
          issues: new URL(request.url).searchParams.get('label') ? [] : issues,
          nextCursor: null,
        }),
      ),
    );
  }
  const releaseRoute: IntakeLabelRoute = {
    factoryProjectId: 'factory-1',
    integrationId: 'github',
    label: 'release',
    board: 'release',
  };

  it('offers a custom board the issues carrying its routed label, on its initial phase', async () => {
    stubGithub([releaseRoute]);

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.active).toBe('github'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.candidates[0]).toMatchObject({ sourceKey: 'github-issue:2', column: 'queued' });
    expect(result.current.feedByColumn).toHaveProperty('queued');
    expect(result.current.feedByColumn).not.toHaveProperty('triage');
  });

  it('keeps routed issues off Work while unrouted ones stay', async () => {
    stubGithub([releaseRoute]);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.active).toBe('github'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(result.current.candidates.map(candidate => candidate.sourceKey)).toEqual([
      'github-issue:1',
      'github-issue:3',
    ]);
  });

  it('withholds the GitHub feed from a custom board with no label routed to it', async () => {
    stubGithub([]);

    const { result } = renderIntake('factory-1', releaseBoard);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.available).toEqual([]);
  });

  it('keeps a custom board pending until its label routes have loaded', async () => {
    stubGithub([releaseRoute]);
    let releaseRoutes: () => void = () => {};
    const routesRequested = new Promise<void>(resolve => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/intake/label-routes`, async () => {
          resolve();
          await new Promise<void>(release => (releaseRoutes = release));
          return HttpResponse.json({ routes: [releaseRoute] });
        }),
      );
    });

    const { result } = renderIntake('factory-1', releaseBoard);

    // Routes are in flight (the handler is holding the request): the board
    // must report pending rather than an empty feed.
    await routesRequested;
    expect(result.current.available).toEqual([]);
    expect(result.current.isPending).toBe(true);

    releaseRoutes();
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.isPending).toBe(false);
  });

  it('reports a failed label-route load instead of treating every issue as Work', async () => {
    stubGithub([releaseRoute]);
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/label-routes`, () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
    );

    const work = renderIntake('factory-1');
    await waitFor(() => expect(work.result.current.isPending).toBe(false));
    expect(work.result.current.candidates).toEqual([]);
    expect(work.result.current.feedByColumn.intake?.error).toBeInstanceOf(Error);

    const release = renderIntake('factory-1', releaseBoard);
    await waitFor(() => expect(release.result.current.isPending).toBe(false));
    expect(release.result.current.candidates).toEqual([]);
    expect(release.result.current.feedByColumn.queued?.error).toBeInstanceOf(Error);
  });
});
