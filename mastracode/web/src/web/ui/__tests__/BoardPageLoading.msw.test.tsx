import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

/** Work-board columns in render order: stage id + the label used in the per-column skeleton name. */
const WORK_COLUMNS = [
  { id: 'intake', label: 'Intake' },
  { id: 'triage', label: 'Triage' },
  { id: 'planning', label: 'Planning' },
  { id: 'execute', label: 'Building' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
  { id: 'canceled', label: 'Canceled' },
] as const;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Stubs the Work board's data endpoints with gates on the two loading phases:
 * the work-items fetch (phase 1, all columns) and the GitHub issues feed
 * (phase 2, intake + triage columns). Everything else resolves immediately.
 */
function stubBoardEndpoints() {
  const workItemsGate = deferred();
  const issuesGate = deferred();

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              { id: REPO_ID, branch: 'main', sandboxWorkdir: '/repo', repository: { slug: 'acme/app', defaultBranch: 'main' } },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, async () => {
      await workItemsGate.promise;
      return HttpResponse.json({ workItems: [] });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: true, sourceIds: ['acme/app'] },
          linear: { enabled: false, sourceIds: null },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    // Serves both the intake feed (no label) and the triage feed (auto-triaged label).
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, async () => {
      await issuesGate.promise;
      return HttpResponse.json({ issues: [], nextPage: null });
    }),
    // Ambient workspace plumbing kicked off alongside the board queries.
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
  );

  return { workItemsGate, issuesGate };
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Board loading states', () => {
  it('shows every column with its own skeleton through both loading phases, then settles', async () => {
    const { workItemsGate, issuesGate } = stubBoardEndpoints();
    renderWorkBoard();

    // Phase 1: work items unresolved — the full column layout is already
    // rendered, each column carries its own loading region, and the old
    // full-width "Loading board" placeholder never appears.
    for (const column of WORK_COLUMNS) {
      const lane = await screen.findByTestId(`board-column-${column.id}`);
      within(lane).getByRole('status', { name: `Loading ${column.label} column` });
    }
    expect(screen.queryByRole('status', { name: 'Loading board' })).not.toBeInTheDocument();
    // The task badge would announce a false "0 of 0" while data resolves.
    expect(screen.queryByLabelText(/visible board tasks in Planning/)).not.toBeInTheDocument();

    // Phase 2: work items resolved, intake/triage feeds still resolving —
    // non-intake columns settle into their content while intake keeps its
    // column skeleton.
    workItemsGate.resolve();
    const planning = screen.getByTestId('board-column-planning');
    await waitFor(() => expect(within(planning).getByText('Nothing in planning')).toBeInTheDocument());
    expect(within(planning).queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('0 of 0 visible board tasks in Planning')).toBeInTheDocument();
    const intake = screen.getByTestId('board-column-intake');
    within(intake).getByRole('status', { name: 'Loading Intake column' });
    const triage = screen.getByTestId('board-column-triage');
    within(triage).getByRole('status', { name: 'Loading Triage column' });

    // Settled: all feeds resolved — no loading regions remain in any column.
    issuesGate.resolve();
    await waitFor(() => {
      for (const column of WORK_COLUMNS) {
        const lane = screen.getByTestId(`board-column-${column.id}`);
        expect(within(lane).queryByRole('status')).not.toBeInTheDocument();
      }
    });
    expect(within(intake).getByText('Intake is clear')).toBeInTheDocument();
  });
});
