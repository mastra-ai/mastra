/**
 * Stage moves are multi-second server evaluations. While one is in flight the
 * card must announce where it is going ("Moving to Planning…") instead of
 * silently waiting, and drop the status once the server answers.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const ITEM_ID = 'item-1';
const SESSION_ID = 'session-1';
const THREAD_ID = 'thread-1';

const workItem = {
  id: ITEM_ID,
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: FACTORY_ID,
  source: 'github-issue',
  sourceKey: 'github-issue:1',
  parentWorkItemId: null,
  title: 'Fix login bug',
  url: null,
  stages: ['triage'],
  stageHistory: [],
  sessions: {
    chat: {
      sessionId: SESSION_ID,
      branch: 'fix-login',
      threadId: THREAD_ID,
      startedBy: 'user-1',
    },
  },
  metadata: {},
  revision: 1,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function createDataTransfer() {
  const values = new Map<string, string>();
  const types: string[] = [];
  return {
    types,
    effectAllowed: 'uninitialized',
    dropEffect: 'none',
    setData(type: string, value: string) {
      values.set(type, value);
      if (!types.includes(type)) types.push(type);
    },
    getData(type: string) {
      return values.get(type) ?? '';
    },
  };
}

/** Stubs the Work board's data endpoints with one triage item and a gated transition. */
function stubBoardEndpoints() {
  const transitionGate = deferred();
  const transitionRequests: string[] = [];

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
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [workItem] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${ITEM_ID}/transition`, async () => {
      transitionRequests.push(ITEM_ID);
      await transitionGate.promise;
      return HttpResponse.json({
        result: {
          status: 'accepted',
          transitionId: 'transition-1',
          itemId: ITEM_ID,
          revision: 2,
          stage: 'planning',
          decisions: [],
        },
      });
    }),
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({
        sessions: [
          {
            id: 'session-row-1',
            sessionId: SESSION_ID,
            projectRepositoryId: REPO_ID,
            orgId: 'org-1',
            userId: 'user-1',
            branch: 'fix-login',
            baseBranch: 'main',
            sandboxId: null,
            sandboxWorkdir: '/repo',
            materializedAt: '2026-07-18T00:00:00.000Z',
            createdAt: '2026-07-18T00:00:00.000Z',
            updatedAt: '2026-07-18T00:00:00.000Z',
          },
        ],
      }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
  );

  return { transitionGate, transitionRequests };
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Board card pending states', () => {
  it('shows "Moving to …" on the card while a menu move is in flight, then clears it', async () => {
    const { transitionGate } = stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    expect(card).toHaveTextContent('Fix login bug');

    await user.click(screen.getByRole('button', { name: 'Actions for Fix login bug' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to Planning' }));

    // In flight: the card narrates the destination via a live status row.
    const status = await screen.findByText('Moving to Planning…');
    expect(status.closest('[role="status"]')).not.toBeNull();

    // Server answered: the status row disappears.
    transitionGate.resolve();
    await waitFor(() => expect(screen.queryByText('Moving to Planning…')).not.toBeInTheDocument());
  });

  it('links a live-thread title to its workspace route and explains the click outcome', async () => {
    stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    const titleLink = await screen.findByRole('link', { name: /Fix login bug/ });
    expect(titleLink).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`,
    );
    const matches = matchRoutes(createAppRoutes(), titleLink.getAttribute('href') ?? '');
    expect(matches?.at(-1)?.route.path).toBe('threads/:threadId');

    await user.hover(titleLink);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Open thread — does not start an agent run');
  });

  it('ignores a card dropped back into its current column', async () => {
    const { transitionRequests } = stubBoardEndpoints();
    renderWorkBoard();

    const titleLink = await screen.findByRole('link', { name: /Fix login bug/ });
    const card = titleLink.closest<HTMLElement>('[data-testid="work-item-card"]');
    if (!card) throw new Error('Expected the title link inside its work item card');
    const currentColumn = screen.getByTestId('board-column-triage');
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(titleLink, { dataTransfer });
    fireEvent.dragOver(currentColumn, { dataTransfer });
    fireEvent.drop(currentColumn, { dataTransfer });
    await delay(50);

    expect(transitionRequests).toEqual([]);
    expect(currentColumn).toContainElement(card);
  });
});
