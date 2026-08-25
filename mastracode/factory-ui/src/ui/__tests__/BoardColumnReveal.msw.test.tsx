/**
 * A column renders one page of cards at a time: a board that has run for a
 * while holds hundreds of items per lane, and every card mounts a run spec, an
 * activity read and a status pass on each list poll. A card linked to by
 * `?item=` renders however deep it sits, so the board can scroll to it.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const REVEAL_STEP = 30;
const ITEM_COUNT = 45;

const buildWorkItems = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    externalSource: null,
    parentWorkItemId: null,
    title: `Task ${index}`,
    stages: ['triage'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: `2026-07-18T00:${String(index).padStart(2, '0')}:00.000Z`,
    updatedAt: `2026-07-18T00:${String(index).padStart(2, '0')}:00.000Z`,
  }));

const workItems = buildWorkItems(ITEM_COUNT);

/** The board lists newest first, so the oldest card is the one past the page. */
const OLDEST_TITLE = 'Task 0';

/** Reports the sentinel as in view the moment it is observed. */
function stubSentinelAlwaysInView() {
  const original = globalThis.IntersectionObserver;
  vi.stubGlobal(
    'IntersectionObserver',
    class AlwaysInView {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe() {
        this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
      }
      disconnect() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    },
  );
  return () => vi.stubGlobal('IntersectionObserver', original);
}

function stubBoardEndpoints(items: object[] = workItems) {
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
      HttpResponse.json({ workItems: items }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: false, sourceIds: null }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
  );
}

function renderBoard(search = '') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/work${search}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Board column reveal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders one page of a long column, keeping the rest out of the tree', async () => {
    stubBoardEndpoints();
    renderBoard();

    await screen.findByLabelText(`Task ${ITEM_COUNT - 1}`);
    await waitFor(() => expect(screen.getAllByTestId('work-item-card')).toHaveLength(REVEAL_STEP));
    expect(screen.queryByLabelText(OLDEST_TITLE)).not.toBeInTheDocument();
  });

  // An observer only reports crossings. A sentinel that never leaves view — a
  // lane short enough to sit inside the root margin — reported once and the
  // column stalled two pages in, with the rest of its cards never rendered.
  it('keeps revealing while the sentinel stays in view', async () => {
    stubSentinelAlwaysInView();
    stubBoardEndpoints(buildWorkItems(REVEAL_STEP * 2 + 10));

    renderBoard();

    await waitFor(() => expect(screen.getAllByTestId('work-item-card')).toHaveLength(REVEAL_STEP * 2 + 10));
  });

  // Paging a column hides its oldest cards, so the board has to offer a way to
  // reach one without scrolling for it. Filtering runs before the paging, so a
  // match renders however deep it sat.
  it('finds a card past the first page through the board search', async () => {
    stubBoardEndpoints();
    renderBoard();
    await screen.findByLabelText(`Task ${ITEM_COUNT - 1}`);

    const filters = within(screen.getByLabelText('Board filters'));
    await userEvent.setup().type(filters.getByRole('textbox', { name: 'Search cards' }), OLDEST_TITLE);

    expect(await screen.findByLabelText(OLDEST_TITLE)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('work-item-card')).toHaveLength(1));
  });

  it('renders a linked card even when it sits past the first page', async () => {
    stubBoardEndpoints();
    renderBoard('?item=item-0');

    expect(await screen.findByLabelText(OLDEST_TITLE)).toBeInTheDocument();
  });
});
