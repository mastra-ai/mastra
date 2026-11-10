import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { releaseBoard } from '../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { BoardCatalogResponse, IntakeRouteListResponse } from '../../api/types';
import { createAppRoutes } from '../router';
import { saveKanbanView, stageToggle } from './boardLayoutQueries';

type IntakeRoute = IntakeRouteListResponse['intakeRoutes'][number];

function intakeRouteTo(boardKey: string, overrides: Partial<IntakeRoute> = {}): IntakeRoute {
  return {
    id: `route-${boardKey}`,
    name: `File onto ${boardKey}`,
    enabled: true,
    position: 0,
    when: null,
    target: { boardKey, phaseKey: null, joinClosedIssue: false },
    on: ['work_item.created'],
    revision: 1,
    createdBy: 'user-1',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedBy: 'user-1',
    updatedAt: '2026-11-01T00:00:00.000Z',
    problems: [],
    ...overrides,
  };
}

function renderBoard(
  board = 'boards/release',
  workItems: unknown[] = [],
  boards = [releaseBoard],
  githubSourceIds: string[] = ['acme/app'],
  linear: { sourceIds: string[]; bindings: unknown[] } | null = null,
  intakeRoutes: IntakeRoute[] | (() => Response) = [intakeRouteTo('release')],
) {
  const intakeRequest = vi.fn(() => HttpResponse.json({ issues: [], pullRequests: [] }));
  server.use(
    http.get('*/api/agent-controller/code/sessions/:id/permissions', () => HttpResponse.json({ permissions: [] })),
    http.get('*/web/intake/bindings', () => HttpResponse.json({ bindings: linear?.bindings ?? [] })),
    http.get('*/auth/me', () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get('*/web/factory/projects', () =>
      HttpResponse.json({
        projects: [
          {
            id: 'fp-1',
            name: 'Factory',
            repositories: [listedRepository('repo-1', 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
          },
        ],
      }),
    ),
    http.get(
      '*/web/factory/projects/:id/intake-routes',
      typeof intakeRoutes === 'function'
        ? intakeRoutes
        : () => HttpResponse.json({ intakeRoutes } satisfies IntakeRouteListResponse),
    ),
    http.get('*/web/factory/projects/:id/boards', () => HttpResponse.json({ boards } satisfies BoardCatalogResponse)),
    http.get('*/web/intake/config', () =>
      HttpResponse.json({
        config: {
          github: { enabled: true, sourceIds: githubSourceIds },
          linear: { enabled: Boolean(linear), sourceIds: linear?.sourceIds ?? null },
        },
      }),
    ),
    http.get('*/web/linear/status', () =>
      HttpResponse.json({ enabled: Boolean(linear), connected: Boolean(linear), workspace: null }),
    ),
    http.get('*/web/factory/projects/:factoryId/sessions', () => HttpResponse.json({ sessions: [] })),
    http.get('*/web/github/projects/:id/issues', intakeRequest),
    http.get('*/web/github/projects/:id/prs', intakeRequest),
    http.get('*/web/factory/projects/:id/work-items', () =>
      HttpResponse.json({ workItems, runningSessionIds: [], parkedSessionIds: [] }),
    ),
  );
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/fp-1/${board}`] });
  const { client } = renderWithProviders(<RouterProvider router={router} />);
  return { intakeRequest, client, router };
}

describe('custom-only board routing', () => {
  // Its cards come from an intake route that targets it, not from a feed it browses.
  it.each(['list', 'board'])(
    'says intake is clear in a custom initial phase while an intake route files a connected source onto it, in the %s layout',
    async layout => {
      const { client } = renderBoard();
      const user = userEvent.setup();
      if (layout === 'board') await saveKanbanView(user);
      await waitForMutationsIdle(client);

      const queued = await screen.findByTestId('board-column-queued');
      expect(await within(queued).findByText('Intake is clear')).toBeVisible();
      expect(within(queued).queryByText(/No intake sources/)).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Connect issue source' })).not.toBeInTheDocument();

      await user.click(within(queued).getByRole('button', { name: 'Create card' }));
      expect(await screen.findByRole('textbox', { name: 'Work item title' })).toHaveFocus();
    },
  );

  it.each(['list', 'board'])(
    'offers intake setup in a custom initial phase in the %s layout when nothing is connected',
    async layout => {
      const { client } = renderBoard(undefined, undefined, undefined, []);
      const user = userEvent.setup();
      if (layout === 'board') await saveKanbanView(user);
      await waitForMutationsIdle(client);

      const queued = await screen.findByTestId('board-column-queued');
      expect(within(queued).getByText(/No intake sources/)).toBeVisible();
      expect(within(queued).getByRole('link', { name: 'Connect issue source' })).toHaveAttribute(
        'href',
        '/factories/fp-1/settings/intake',
      );
      expect(screen.getAllByRole('link', { name: 'Connect issue source' })).toHaveLength(1);

      await user.click(within(queued).getByRole('button', { name: 'Create card' }));
      expect(await screen.findByRole('textbox', { name: 'Work item title' })).toHaveFocus();
    },
  );

  // A connected source files onto the default board unless a route places its new cards
  // elsewhere, so a board no enabled arrival route targets never receives a card.
  it.each([
    ['no route targets it', [intakeRouteTo('work')]],
    ['its only route is off', [intakeRouteTo('release', { enabled: false })]],
    ['its only route moves existing cards on a later event', [intakeRouteTo('release', { on: ['work_item.closed'] })]],
    [
      'its only route joins pull requests to existing cards',
      [intakeRouteTo('release', { target: { boardKey: 'release', phaseKey: null, joinClosedIssue: true } })],
    ],
  ])('offers intake setup while a source is connected but %s', async (_case, intakeRoutes) => {
    const { client } = renderBoard(undefined, undefined, undefined, undefined, null, intakeRoutes);
    await waitForMutationsIdle(client);

    const queued = await screen.findByTestId('board-column-queued');
    expect(await within(queued).findByText(/No intake sources/)).toBeVisible();
    expect(within(queued).queryByText('Intake is clear')).not.toBeInTheDocument();
    expect(within(queued).getByRole('link', { name: 'Connect issue source' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/intake',
    );
  });

  // Without the routes the board can't tell whether anything files onto it, so it neither
  // promises issues nor asks to connect a source: it says the lookup failed and offers a retry.
  it('reports a failed intake route lookup with a retry instead of an empty state', async () => {
    let fail = true;
    const { client } = renderBoard(undefined, undefined, undefined, undefined, null, () =>
      fail
        ? HttpResponse.json({ error: 'Intake routes are unavailable' }, { status: 500 })
        : HttpResponse.json({ intakeRoutes: [intakeRouteTo('release')] } satisfies IntakeRouteListResponse),
    );
    await waitForMutationsIdle(client);

    const queued = await screen.findByTestId('board-column-queued');
    expect(await within(queued).findByRole('alert')).toHaveTextContent('Intake routes are unavailable');
    expect(within(queued).queryByText('Intake is clear')).not.toBeInTheDocument();
    expect(within(queued).queryByText(/No intake sources/)).not.toBeInTheDocument();

    fail = false;
    await userEvent.setup().click(within(queued).getByRole('button', { name: 'Retry' }));
    expect(await within(queued).findByText('Intake is clear')).toBeVisible();
    expect(within(queued).queryByRole('alert')).not.toBeInTheDocument();
  });

  // Selected sources are shared across factories; a source bound only to another project's board
  // files nothing here, so this project still has nothing connected.
  it('offers intake setup while the only selected source feeds another project', async () => {
    const { client } = renderBoard(undefined, undefined, undefined, [], {
      sourceIds: ['team-1'],
      bindings: [
        { integrationId: 'linear', sourceId: 'team-1', factoryProjectId: 'fp-other', board: 'work', labels: null },
      ],
    });
    await waitForMutationsIdle(client);

    const queued = await screen.findByTestId('board-column-queued');
    expect(await within(queued).findByText(/No intake sources/)).toBeVisible();
    expect(within(queued).getByRole('link', { name: 'Connect issue source' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/intake',
    );
  });

  it("offers no intake setup while a selected source feeds one of this project's boards", async () => {
    const { client } = renderBoard(undefined, undefined, undefined, [], {
      sourceIds: ['team-1'],
      bindings: [
        { integrationId: 'linear', sourceId: 'team-1', factoryProjectId: 'fp-1', board: 'work', labels: null },
      ],
    });
    await waitForMutationsIdle(client);

    const queued = await screen.findByTestId('board-column-queued');
    expect(await within(queued).findByText('Intake is clear')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Connect issue source' })).not.toBeInTheDocument();
  });

  it('renders declaration-ordered custom groups without built-in intake or automation', async () => {
    const { intakeRequest, client } = renderBoard();
    const columns = await screen.findByLabelText('Board stages');
    expect(
      within(columns)
        .getAllByRole('region')
        .map(region => region.getAttribute('aria-label')),
    ).toEqual(['Queued', 'Preparing', 'Shipping', 'Shipped']);
    for (const label of ['Preparing', 'Shipping', 'Shipped']) {
      expect(stageToggle(label, columns)).toHaveAttribute('aria-expanded', 'true');
    }
    expect(screen.queryByText('Auto-approve plans')).toBeNull();
    // Columns render before every query settles, so only judge the feeds once idle.
    await waitForMutationsIdle(client);
    expect(intakeRequest).not.toHaveBeenCalled();
  });

  it('labels each custom phase kind on a Kanban view', async () => {
    renderBoard();
    await saveKanbanView(userEvent.setup());
    expect(screen.getAllByLabelText('working phase')).toHaveLength(2);
    expect(screen.getByLabelText('terminal phase')).toBeTruthy();
  });

  it('opens another board with every group expanded even when it shares phase ids', async () => {
    const user = userEvent.setup();
    const hotfixBoard = { ...releaseBoard, id: 'hotfix', title: 'Hotfix' };
    const { router } = renderBoard('boards/release', [], [releaseBoard, hotfixBoard]);
    await user.click(stageToggle('Shipped', await screen.findByLabelText('Board stages')));
    expect(stageToggle('Shipped', screen.getByLabelText('Board stages'))).toHaveAttribute('aria-expanded', 'false');

    await act(() => router.navigate('/factories/fp-1/boards/hotfix'));

    await waitFor(() =>
      expect(stageToggle('Shipped', screen.getByLabelText('Board stages'))).toHaveAttribute('aria-expanded', 'true'),
    );
  });

  it.each([
    ['github pull request', { integrationId: 'github', type: 'pull-request', externalId: 'github:1', url: null }],
    ['gitlab merge request', { integrationId: 'gitlab', type: 'pull-request', externalId: 'gitlab:1', url: null }],
    ['slack thread', { integrationId: 'slack', type: 'slack-thread', externalId: 'slack:1', url: null }],
    ['manual', null],
  ])('renders a %s card in the initial phase', async (_label, externalSource) => {
    const now = '2026-09-01T12:00:00.000Z';
    renderBoard('boards/release', [
      {
        id: 'card-1',
        orgId: 'org-1',
        createdBy: 'user-1',
        factoryProjectId: 'fp-1',
        board: 'release',
        externalSource,
        parentWorkItemId: null,
        title: 'Release card',
        stages: ['queued'],
        stageHistory: [{ stage: 'queued', enteredAt: now, by: 'user-1' }],
        sessions: {},
        metadata: {},
        triageType: null,
        acceptedAt: null,
        commentCount: 0,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const queued = await screen.findByRole('region', { name: 'Queued' });
    expect(await within(queued).findByText('Release card')).toBeTruthy();
  });
  it.each(['boards/missing', 'work', 'review'])(
    'shows unavailable for %s rather than substituting another board',
    async route => {
      renderBoard(route);
      expect(await screen.findByText('Board unavailable: this board is not installed.')).toBeTruthy();
      expect(screen.queryByRole('group', { name: 'Board columns' })).toBeNull();
    },
  );
});
