import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_INTAKE_ROUTES } from '@mastra/factory/boards/work-routes';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { shipBoard, workBoardInfo } from '../../../../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../../e2e/ui/msw-server';
import { MemoryRouter } from 'react-router';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { IntakeRouteInfo } from '../../../../../api/types';
import { NewCardsHere } from '../../../boardConfig/components/NewCardsHere';
import { CardMovesSection, IntakeRoutesSection } from '../IntakeRoutesSection';
import { catchesEveryArrival } from '../intakeRoutes';

const ROUTES_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/intake-routes`;

/** The routes a new project is seeded with, as the route API lists them. */
function seededRoutes(): IntakeRouteInfo[] {
  return DEFAULT_INTAKE_ROUTES.map(({ key, route }, position) => ({
    id: key,
    name: route.name,
    enabled: route.enabled ?? true,
    position,
    when: route.when ?? null,
    target: {
      boardKey: route.target.boardKey,
      phaseKey: route.target.phaseKey ?? null,
      joinClosedIssue: route.target.joinClosedIssue ?? false,
    },
    on: [...(route.on ?? ['work_item.created'])],
    revision: 1,
    createdBy: 'factory',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedBy: 'factory',
    updatedAt: '2026-11-01T00:00:00.000Z',
    problems: [],
  }));
}

/**
 * The project's intake routes behind the real route API's rules: writes check the revision they
 * name, and a route that places new cards goes just ahead of the first route taking every new card,
 * bumping the revision of each route it moves down.
 */
function serveRoutes({ canEdit = true, routes = seededRoutes() } = {}) {
  const state = { routes, requests: [] as { method: string; path: string; body?: unknown }[] };
  let created = 0;
  const find = (id: string) => state.routes.find(route => route.id === id);
  const stale = () => HttpResponse.json({ error: 'revision_mismatch', message: 'The route changed.' }, { status: 409 });
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/boards`, () =>
      HttpResponse.json({ boards: [workBoardInfo, shipBoard] }),
    ),
    http.get(ROUTES_URL, () => HttpResponse.json({ intakeRoutes: state.routes, canEdit })),
    http.post(ROUTES_URL, async ({ request }) => {
      const body = (await request.json()) as Pick<IntakeRouteInfo, 'name' | 'when'> & {
        target: { boardKey: string; phaseKey?: string };
        on?: IntakeRouteInfo['on'];
      };
      state.requests.push({ method: 'POST', path: '', body });
      const route: IntakeRouteInfo = {
        ...seededRoutes()[0],
        id: `mine-${++created}`,
        name: body.name,
        when: body.when ?? null,
        target: { boardKey: body.target.boardKey, phaseKey: body.target.phaseKey ?? null, joinClosedIssue: false },
        on: body.on ?? ['work_item.created'],
        createdBy: 'admin',
      };
      // A route that places new cards goes ahead of the first route taking every new card. Each
      // route that moves down a slot is a write to it, so its revision goes up, as in storage.
      const ahead = route.on.includes('work_item.created') ? state.routes.findIndex(catchesEveryArrival) : -1;
      state.routes = (ahead < 0 ? [...state.routes, route] : state.routes.toSpliced(ahead, 0, route)).map(
        (entry, position) =>
          entry === route
            ? { ...entry, position }
            : entry.position === position
              ? entry
              : { ...entry, position, revision: entry.revision + 1 },
      );
      return HttpResponse.json({ intakeRoute: state.routes.find(entry => entry.id === route.id) }, { status: 201 });
    }),
    http.patch<{ id: string }>(`${ROUTES_URL}/:id`, async ({ params, request }) => {
      const body = (await request.json()) as Partial<IntakeRouteInfo> & { expectedRevision: number };
      state.requests.push({ method: 'PATCH', path: params.id, body });
      const current = find(params.id);
      if (!current || current.revision !== body.expectedRevision) return stale();
      const { expectedRevision: _, ...patch } = body;
      const next = {
        ...current,
        ...patch,
        target: patch.target
          ? { ...patch.target, joinClosedIssue: patch.target.joinClosedIssue ?? false }
          : current.target,
        revision: current.revision + 1,
      };
      state.routes = state.routes.map(route => (route.id === current.id ? next : route));
      return HttpResponse.json({ intakeRoute: next });
    }),
    http.delete<{ id: string }>(`${ROUTES_URL}/:id`, ({ params, request }) => {
      const expected = Number(new URL(request.url).searchParams.get('expectedRevision'));
      state.requests.push({ method: 'DELETE', path: params.id, body: expected });
      const current = find(params.id);
      if (!current || current.revision !== expected) return stale();
      // The routes below move up a slot; each move is a write, so its revision goes up, as in storage.
      state.routes = state.routes
        .filter(route => route.id !== current.id)
        .map((route, position) =>
          route.position === position ? route : { ...route, position, revision: route.revision + 1 },
        );
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${ROUTES_URL}/reorder`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[] };
      state.requests.push({ method: 'POST', path: 'reorder', body });
      // Every route whose position changes is written, so its revision goes up, as in storage.
      state.routes = body.ids.map((id, position) => {
        const route = find(id)!;
        return route.position === position ? route : { ...route, position, revision: route.revision + 1 };
      });
      return HttpResponse.json({ intakeRoutes: state.routes });
    }),
  );
  return state;
}

const namesIn = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map(
      item =>
        within(item).queryByRole<HTMLInputElement>('textbox', { name: 'Route name' })?.value ??
        item.querySelector('.truncate')?.textContent,
    )
    .filter(name => name !== undefined);

const routeNames = () => namesIn(screen.getByRole('list', { name: 'Intake routes' }));

/** The row of the route named `name`. */
const routeRow = (name: string) =>
  screen.getAllByRole('listitem').find(item => within(item).queryByDisplayValue(name) !== null)!;

const renderSection = () =>
  renderWithProviders(
    <MemoryRouter>
      <IntakeRoutesSection factoryId="fp-1" />
      <Toaster />
    </MemoryRouter>,
  );

/** Opens a new route and names it; the returned group holds its controls. */
async function startRoute(user: ReturnType<typeof userEvent.setup>, name: string, button = 'Add route') {
  await user.click(await screen.findByRole('button', { name: button }));
  const draft = screen.getByRole('group', { name: button === 'Add route' ? 'New route' : 'New card move' });
  await user.type(within(draft).getByLabelText('New route name'), name);
  return draft;
}

/** Adds one condition to a route being written: field, then a typed value. */
async function addCondition(
  user: ReturnType<typeof userEvent.setup>,
  draft: HTMLElement,
  field: string,
  value?: string,
) {
  await user.click(within(draft).getByRole('button', { name: 'Add condition' }));
  await user.click(within(draft).getByRole('combobox', { name: 'Field' }));
  await user.click(await screen.findByRole('option', { name: field }));
  if (value !== undefined) await user.type(within(draft).getByRole('textbox', { name: 'Value' }), `${value}{Enter}`);
}

/**
 * Where the project's items live: a GitHub repository and a GitLab project linked to it, a Linear
 * project in team ENG and a Jira project PLAT bound to it, and a Linear team bound to another project.
 */
function serveProjectSources() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: 'fp-1',
            name: 'Factory',
            repositories: [
              listedRepository('repo-1', 'acme/app'),
              listedRepository('repo-2', 'acme/platform/api', { integrationId: 'gitlab' }),
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () =>
      HttpResponse.json({
        bindings: [
          { integrationId: 'linear', sourceId: 'linear-project-1', factoryProjectId: 'fp-1' },
          { integrationId: 'jira', sourceId: 'jira-10', factoryProjectId: 'fp-1' },
          { integrationId: 'linear', sourceId: 'linear-team:team-ops', factoryProjectId: 'fp-2' },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: 'linear-project-1',
            name: 'Billing',
            state: 'started',
            teams: [{ id: 'team-eng', key: 'ENG', name: 'Engineering' }],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/teams`, () =>
      HttpResponse.json({
        teams: [
          { id: 'team-eng', key: 'ENG', name: 'Engineering' },
          { id: 'team-ops', key: 'OPS', name: 'Operations' },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/jira/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'jira-10', key: 'PLAT', name: 'Platform' }] }),
    ),
  );
}

/** The values offered in the open value list. */
const offered = async () => (await screen.findAllByRole('option')).map(option => option.textContent?.trim());

describe('IntakeRoutesSection', () => {
  it('suggests the repositories, team and project keys the project has, and saves the one picked', async () => {
    const state = serveRoutes();
    serveProjectSources();
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'acme/app goes to Ship');
    await addCondition(user, draft, 'Repository, team or project');
    await user.click(within(draft).getByRole('combobox', { name: 'Value' }));
    await waitFor(async () => expect(await offered()).toEqual(['acme/app', 'acme/platform/api', 'ENG', 'PLAT']));
    await user.click(screen.getByRole('option', { name: 'acme/app' }));
    await user.click(within(draft).getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    await user.click(within(draft).getByRole('button', { name: 'Add route' }));

    await waitFor(() => expect(state.requests).toHaveLength(1));
    expect(state.requests[0]?.body).toMatchObject({
      when: { operator: 'AND', conditions: [{ field: 'source.repository', operator: 'equals', value: 'acme/app' }] },
    });
  });

  it('saves a repository the project does not list yet, typed in, and several picked for "is any of"', async () => {
    const state = serveRoutes();
    serveProjectSources();
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'Elsewhere goes to Ship');
    await addCondition(user, draft, 'Repository, team or project');
    await user.click(within(draft).getByRole('combobox', { name: 'Value' }));
    await user.type(await screen.findByPlaceholderText('owner/repo, ENG, PLAT'), 'acme/next');
    await user.click(await screen.findByRole('option', { name: 'Use “acme/next”' }));
    await user.click(within(draft).getByRole('button', { name: 'Add condition' }));
    const fields = within(draft).getAllByRole('combobox', { name: 'Field' });
    await user.click(fields.at(-1)!);
    await user.click(await screen.findByRole('option', { name: 'Repository, team or project' }));
    await user.click(within(draft).getAllByRole('combobox', { name: 'Operator' }).at(-1)!);
    await user.click(await screen.findByRole('option', { name: 'is any of' }));
    await user.click(within(draft).getByRole('combobox', { name: 'Values' }));
    await user.click(await screen.findByRole('option', { name: 'ENG' }));
    await user.click(screen.getByRole('option', { name: 'PLAT' }));
    await user.keyboard('{Escape}');
    await user.click(within(draft).getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    await user.click(within(draft).getByRole('button', { name: 'Add route' }));

    await waitFor(() => expect(state.requests).toHaveLength(1));
    expect(state.requests[0]?.body).toMatchObject({
      when: {
        operator: 'AND',
        conditions: [
          { field: 'source.repository', operator: 'equals', value: 'acme/next' },
          { field: 'source.repository', operator: 'in', value: ['ENG', 'PLAT'] },
        ],
      },
    });
  });

  it("keeps a repository being typed when the project's repositories arrive mid-way, the control staying put", async () => {
    const state = serveRoutes();
    let release!: () => void;
    const arrived = new Promise<void>(resolve => (release = resolve));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, async () => {
        await arrived;
        return HttpResponse.json({
          projects: [{ id: 'fp-1', name: 'Factory', repositories: [listedRepository('repo-1', 'acme/app')] }],
        });
      }),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    );
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'acme/next goes to Ship');
    await addCondition(user, draft, 'Repository, team or project');
    await user.click(within(draft).getByRole('combobox', { name: 'Value' }));
    const search = await screen.findByPlaceholderText('owner/repo, ENG, PLAT');
    await user.type(search, 'acme/ne');
    release();
    await waitFor(async () => expect(await offered()).toContain('Use “acme/ne”'));
    await user.type(search, 'xt{Enter}');
    await user.click(within(draft).getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    await user.click(within(draft).getByRole('button', { name: 'Add route' }));

    await waitFor(() => expect(state.requests).toHaveLength(1));
    expect(state.requests[0]?.body).toMatchObject({
      when: { operator: 'AND', conditions: [{ field: 'source.repository', operator: 'equals', value: 'acme/next' }] },
    });
  });

  it('lists the repositories a typed name matches before using the name as typed, so Enter picks the repository', async () => {
    const state = serveRoutes();
    serveProjectSources();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({
          projects: [
            {
              id: 'fp-1',
              name: 'Factory',
              repositories: [listedRepository('repo-1', 'mastra-ai/mastra'), listedRepository('repo-2', 'acme/app')],
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'Mastra goes to Ship');
    await addCondition(user, draft, 'Repository, team or project');
    await user.click(within(draft).getByRole('combobox', { name: 'Value' }));
    await user.type(await screen.findByPlaceholderText('owner/repo, ENG, PLAT'), 'mastra');
    await waitFor(async () => expect(await offered()).toEqual(['mastra-ai/mastra', 'Use “mastra”']));
    await user.keyboard('{Enter}');
    await user.click(within(draft).getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    await user.click(within(draft).getByRole('button', { name: 'Add route' }));

    await waitFor(() => expect(state.requests).toHaveLength(1));
    expect(state.requests[0]?.body).toMatchObject({
      when: {
        operator: 'AND',
        conditions: [{ field: 'source.repository', operator: 'equals', value: 'mastra-ai/mastra' }],
      },
    });
  });

  it('suggests only the provider a condition beside it limits cards to', async () => {
    serveRoutes();
    serveProjectSources();
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'GitLab goes to Ship');
    await addCondition(user, draft, 'Provider');
    await user.click(within(draft).getByRole('combobox', { name: 'Value' }));
    await user.click(await screen.findByRole('option', { name: 'GitLab' }));
    await user.click(within(draft).getByRole('button', { name: 'Add condition' }));
    await user.click(within(draft).getAllByRole('combobox', { name: 'Field' }).at(-1)!);
    await user.click(await screen.findByRole('option', { name: 'Repository, team or project' }));
    await user.click(within(draft).getAllByRole('combobox', { name: 'Value' }).at(-1)!);
    await waitFor(async () => expect(await offered()).toEqual(['acme/platform/api']));
  });

  it('warns when a repository typed for GitHub has no owner, which never matches', async () => {
    serveRoutes();
    serveProjectSources();
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'Mastra goes to Ship');
    await addCondition(user, draft, 'Integration');
    await user.click(within(draft).getByRole('combobox', { name: 'Value' }));
    await user.click(await screen.findByRole('option', { name: 'GitHub' }));
    await user.click(within(draft).getByRole('button', { name: 'Add condition' }));
    await user.click(within(draft).getAllByRole('combobox', { name: 'Field' }).at(-1)!);
    await user.click(await screen.findByRole('option', { name: 'Repository, team or project' }));
    await user.click(within(draft).getAllByRole('combobox', { name: 'Value' }).at(-1)!);
    await user.type(await screen.findByPlaceholderText('owner/repo, ENG, PLAT'), 'mastra');
    await user.click(await screen.findByRole('option', { name: 'Use “mastra”' }));
    expect(await within(draft).findByText(/GitHub repositories are owner\/repo/)).toBeInTheDocument();
  });

  it('lists the routes that place new cards in the order they are tried, ending with the catch-all to Work › Intake', async () => {
    serveRoutes();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    // Routes that only move cards already on a board are on that board's Card moves page.
    expect(routeNames()).toEqual(
      DEFAULT_INTAKE_ROUTES.filter(({ route }) =>
        (route.on ?? ['work_item.created']).includes('work_item.created'),
      ).map(({ route }) => route.name),
    );
    expect(routeNames()).not.toContain('Closed issues go to Done');
    const last = within(screen.getByRole('list', { name: 'Intake routes' }))
      .getAllByRole('listitem')
      .at(-1)!;
    expect(routeNames().at(-1)).toBe('Everything else goes to Work › Intake');
    expect(within(last).getByText('Otherwise')).toBeInTheDocument();
    expect(within(last).getByLabelText('Board for new cards')).toHaveTextContent('Work');
    expect(within(last).getByRole('combobox', { name: 'Phase' })).toHaveTextContent('Intake');
    expect(screen.queryByText(/PRs → Review/)).toBeNull();
  });

  it('shows members the routes without a way to change them', async () => {
    serveRoutes({ canEdit: false });
    renderSection();

    expect(await screen.findByText('Only organization admins can change intake routes.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Use Everything else goes to Work › Intake' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add route' })).toBeNull();
    expect(screen.queryByLabelText('Board for new cards')).toBeNull();
  });

  it('sends new cards to another board, giving it its own closed, reopened, and pull request routes', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByLabelText('Board for new cards'));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));

    await waitFor(() => expect(state.requests.filter(request => request.method === 'POST')).toHaveLength(8));
    const byName = (name: string) => state.routes.find(route => route.name === name);
    expect(byName('Everything else goes to Ship › Inbox')).toMatchObject({
      id: 'everything-else',
      target: { boardKey: 'ship', phaseKey: 'inbox' },
    });
    // Status events move a card only through routes on its own board, so Ship gets its own.
    expect(byName('Closed issues go to Done on Ship')).toMatchObject({
      on: ['work_item.closed'],
      target: { boardKey: 'ship', phaseKey: 'shipped' },
    });
    expect(byName('Issues closed as not planned go to Canceled on Ship')?.target).toMatchObject({
      boardKey: 'ship',
      phaseKey: 'dropped',
    });
    expect(byName('Reopened issues go back to Intake on Ship')?.target.phaseKey).toBe('inbox');
    expect(byName('Merged pull requests go to Done on Ship')?.target.phaseKey).toBe('shipped');
    expect(byName('Pushes to a reviewed pull request re-review it on Ship')?.target).toMatchObject({
      boardKey: 'ship',
      phaseKey: 'pr',
    });
    // The copies only move existing cards, so they go after the catch-all, which never takes a
    // status event; Work keeps its own event routes for its cards.
    const names = state.routes.map(route => route.name);
    expect(names.indexOf('Closed issues go to Done on Ship')).toBeGreaterThan(
      names.indexOf('Everything else goes to Ship › Inbox'),
    );
    expect(byName('Closed issues go to Done')?.target.boardKey).toBe('work');
  });

  it('adds a route ahead of the catch-all so it can match new cards', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'Releases go to Ship');
    // With no condition it would take every new card and hide the routes below it.
    expect(within(draft).getByRole('button', { name: 'Add route' })).toBeDisabled();
    await addCondition(user, draft, 'Title', 'release');
    await user.click(within(draft).getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    expect(within(draft).getByRole('combobox', { name: 'Phase' })).toHaveTextContent('Inbox');
    await user.click(within(draft).getByRole('button', { name: 'Add route' }));

    await waitFor(() => expect(routeNames()).toContain('Releases go to Ship'));
    expect(state.requests).toEqual([
      {
        method: 'POST',
        path: '',
        body: {
          name: 'Releases go to Ship',
          when: { operator: 'AND', conditions: [{ field: 'item.title', operator: 'equals', value: 'release' }] },
          target: { boardKey: 'ship', phaseKey: 'inbox' },
        },
      },
    ]);
    expect(routeNames().slice(-2)).toEqual(['Releases go to Ship', 'Everything else goes to Work › Intake']);
  });

  it('offers new cards only the phases they can land in from the board’s first phase', async () => {
    serveRoutes();
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'Releases go to Ship');
    await user.click(within(draft).getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    await user.click(within(draft).getByRole('combobox', { name: 'Phase' }));

    const phases = (await screen.findAllByRole('option')).map(option => option.textContent);
    // Ship starts cards in Inbox, which moves them to Think, Make or Pr; Check is only reached from Make.
    expect(phases).toEqual(['Inbox', 'Think', 'Make', 'Pr']);
  });

  it("lets a pull request join its issue's card in any unfinished phase, since that card is already on the board", async () => {
    serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    const joining = routeRow('Pull requests that close a waiting issue join its card');
    await user.click(within(joining).getByRole('combobox', { name: 'Phase' }));

    const phases = (await screen.findAllByRole('option')).map(option => option.textContent);
    expect(phases).toEqual(workBoardInfo.phases.filter(phase => phase.kind !== 'terminal').map(phase => phase.name));
  });

  it('adds a route once however fast Add is pressed, and takes it back from the toast', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'Releases');
    await addCondition(user, draft, 'Title', 'release');
    await user.dblClick(within(draft).getByRole('button', { name: 'Add route' }));
    await waitFor(() => expect(routeNames()).toContain('Releases'));
    expect(state.requests.filter(({ method }) => method === 'POST')).toHaveLength(1);

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(state.routes.some(route => route.name === 'Releases')).toBe(false));
    expect(routeNames()).not.toContain('Releases');
  });

  it('keeps the board picker on a route whose board was removed, so an admin can point it elsewhere', async () => {
    const routes = seededRoutes().map(route =>
      route.id === 'outside-authors' ? { ...route, target: { ...route.target, boardKey: 'retired' } } : route,
    );
    const state = serveRoutes({ routes });
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    const row = routeRow('Outside authors wait in Intake');
    const board = within(row).getByRole('combobox', { name: 'Board' });
    expect(board).toHaveTextContent('retired (not installed)');
    expect(within(row).queryByRole('combobox', { name: 'Phase' })).toBeNull();
    await user.click(board);
    await user.click(await screen.findByRole('option', { name: 'Ship' }));

    await waitFor(() =>
      expect(state.routes.find(route => route.id === 'outside-authors')?.target).toMatchObject({ boardKey: 'ship' }),
    );
  });

  it('sends one repository to another board, picking the repository from the fields a route can test', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'acme/app goes to Ship');
    await user.click(within(draft).getByRole('button', { name: 'Add condition' }));
    await user.click(within(draft).getByRole('combobox', { name: 'Field' }));
    expect(await screen.findByRole('option', { name: 'Provider' })).toBeInTheDocument();
    // New cards have no event, so a new-card route can't test one.
    expect(screen.queryByRole('option', { name: 'Event' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Close reason' })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'Repository, team or project' }));
    expect(within(draft).getByRole('combobox', { name: 'Operator' })).toHaveTextContent('is');
    await user.click(within(draft).getByRole('combobox', { name: 'Value' }));
    await user.type(await screen.findByPlaceholderText('owner/repo, ENG, PLAT'), 'acme/app{Enter}');
    await user.click(within(draft).getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    await user.click(within(draft).getByRole('button', { name: 'Add route' }));

    await waitFor(() => expect(routeNames()).toContain('acme/app goes to Ship'));
    expect(state.requests[0]?.body).toMatchObject({
      name: 'acme/app goes to Ship',
      when: { operator: 'AND', conditions: [{ field: 'source.repository', operator: 'equals', value: 'acme/app' }] },
      target: { boardKey: 'ship', phaseKey: 'inbox' },
    });
  });

  it('offers named values for facts with a fixed set, and reads them back in the route row', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    const draft = await startRoute(user, 'Linear issues');
    await addCondition(user, draft, 'Integration');
    await user.click(within(draft).getByRole('combobox', { name: 'Value' }));
    expect(await screen.findByRole('option', { name: 'incident.io' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Linear' }));
    expect(within(draft).getByRole('combobox', { name: 'Value' })).toHaveTextContent('Linear');
    await user.click(within(draft).getByRole('button', { name: 'Add route' }));

    await waitFor(() => expect(routeNames()).toContain('Linear issues'));
    expect(state.requests[0]?.body).toMatchObject({
      when: { operator: 'AND', conditions: [{ field: 'source.integration', operator: 'equals', value: 'linear' }] },
    });
    const saved = screen.getByRole('group', { name: 'Linear issues conditions' });
    expect(within(saved).getByRole('combobox', { name: 'Value' })).toHaveTextContent('Linear');
  });

  it('adds a value to a several-value condition, keeping a saved value the board no longer has', async () => {
    const routes = seededRoutes().map(route =>
      route.id === 'closes-issue' && route.when?.operator === 'AND'
        ? {
            ...route,
            when: {
              ...route.when,
              conditions: route.when.conditions.map(condition =>
                'field' in condition && condition.field === 'closedIssue.phase'
                  ? { ...condition, value: ['intake', 'retired'] }
                  : condition,
              ),
            },
          }
        : route,
    );
    const state = serveRoutes({ routes });
    const user = userEvent.setup();
    renderSection();

    const conditions = await screen.findByRole('group', {
      name: 'Pull requests that close a waiting issue join its card conditions',
    });
    const values = within(conditions).getByRole('combobox', { name: 'Values' });
    expect(values).toHaveTextContent('Intake or retired');
    await user.click(values);
    await user.click(await screen.findByRole('option', { name: 'Triage' }));

    await waitFor(() =>
      expect(state.requests[0]?.body).toMatchObject({
        when: {
          conditions: expect.arrayContaining([
            { field: 'closedIssue.phase', operator: 'in', value: ['intake', 'retired', 'triage'] },
          ]),
        },
      }),
    );
    expect(values).toHaveTextContent('Intake, retired or Triage');
  });

  it('saves a condition changed in place, and undoes it from the toast', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    const conditions = await screen.findByRole('group', { name: 'Outside authors wait in Intake conditions' });
    await user.click(within(conditions).getByRole('radio', { name: 'Trusted' }));

    await waitFor(() =>
      expect(state.routes.find(route => route.id === 'outside-authors')?.when?.conditions).toContainEqual({
        field: 'author.trusted',
        operator: 'equals',
        value: true,
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(state.routes.find(route => route.id === 'outside-authors')?.when?.conditions).toContainEqual({
        field: 'author.trusted',
        operator: 'equals',
        value: false,
      }),
    );
    // The rows show the undone condition too, not the one that was just taken back.
    const undone = screen.getByRole('group', { name: 'Outside authors wait in Intake conditions' });
    expect(within(undone).getByRole('radio', { name: 'Trusted' })).not.toBeChecked();
    expect(within(undone).getByRole('radio', { name: 'Outside author' })).toBeChecked();
    expect(state.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'PATCH outside-authors',
      'PATCH outside-authors',
    ]);
  });

  it('renames a route in place when the name is left, and keeps the old name on Escape', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    const name = screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Route name' })[1];
    await user.clear(name);
    await user.type(name, 'Strangers wait{Escape}');
    expect(name).toHaveValue('Outside authors wait in Intake');
    await user.clear(name);
    await user.type(name, 'Strangers wait{Enter}');

    await waitFor(() =>
      expect(state.routes.find(route => route.id === 'outside-authors')?.name).toBe('Strangers wait'),
    );
    expect(state.requests).toHaveLength(1);
  });

  it('sends new cards elsewhere by changing the first route that takes them all, the one that applies', async () => {
    const routes = seededRoutes();
    const mine: IntakeRouteInfo = { ...routes.at(-1)!, id: 'mine', name: 'Everything else, mine', createdBy: 'admin' };
    const state = serveRoutes({ routes: [...routes.slice(0, -1), mine, routes.at(-1)!] });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByLabelText('Board for new cards'));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));

    await waitFor(() => expect(state.routes.find(route => route.id === 'mine')?.target.boardKey).toBe('ship'));
    expect(state.routes.find(route => route.id === 'everything-else')?.target.boardKey).toBe('work');
  });

  it('takes back sending new cards elsewhere from the toast, removing every route it copied', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByLabelText('Board for new cards'));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    await waitFor(() =>
      expect(state.routes.find(route => route.id === 'everything-else')?.target.boardKey).toBe('ship'),
    );
    // Several copies, so each delete renumbers routes another delete still has to name.
    const copies = state.routes.filter(route => route.createdBy === 'admin').map(route => route.id);
    expect(copies.length).toBeGreaterThan(1);

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(state.routes.find(route => route.id === 'everything-else')).toMatchObject({
        name: 'Everything else goes to Work › Intake',
        target: { boardKey: 'work', phaseKey: 'intake' },
      }),
    );
    expect(state.routes.map(route => route.id)).toEqual(seededRoutes().map(route => route.id));
    expect(screen.queryByText(/Someone else changed these routes first/)).not.toBeInTheDocument();
  });

  it('says where cards land when no route takes every new card, and lets admins pick that board', async () => {
    const state = serveRoutes({ routes: seededRoutes().filter(route => !catchesEveryArrival(route)) });
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByText('Everything else goes to')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Board for new cards'));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));

    await waitFor(() =>
      expect(state.routes.find(route => catchesEveryArrival(route))?.target).toMatchObject({
        boardKey: 'ship',
        phaseKey: 'inbox',
      }),
    );
  });

  it('tells members where unrouted cards land without offering to change it', async () => {
    serveRoutes({ canEdit: false, routes: seededRoutes().filter(route => !catchesEveryArrival(route)) });
    renderSection();

    const leftovers = (await screen.findByText('Everything else goes to')).parentElement!;
    expect(leftovers).toHaveTextContent('Work › Intake');
    expect(screen.queryByLabelText('Board for new cards')).toBeNull();
  });

  it('reorders, disables, and deletes routes with the revision each one was read at', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    const before = routeNames().indexOf('Pull requests go to Review');
    await user.click(screen.getByRole('button', { name: 'Pull requests go to Review actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move up' }));
    await waitFor(() => expect(routeNames().indexOf('Pull requests go to Review')).toBe(before - 1));

    await user.click(screen.getByRole('switch', { name: 'Use Outside authors wait in Intake' }));
    await waitFor(() => expect(state.routes.find(route => route.id === 'outside-authors')?.enabled).toBe(false));

    const closesIssue = 'Pull requests that close a waiting issue join its card';
    await user.click(screen.getByRole('button', { name: `${closesIssue} actions` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(routeNames()).not.toContain(closesIssue));
    await waitFor(() => expect(state.requests).toHaveLength(3));

    expect(state.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST reorder',
      'PATCH outside-authors',
      'DELETE closes-issue',
    ]);
    // The reorder swapped only the two routes it moved, keeping the hidden card moves in their slots.
    expect((state.requests[0]?.body as { ids: string[] }).ids).toEqual([
      'closes-issue',
      'pull-requests',
      'outside-authors',
      ...DEFAULT_INTAKE_ROUTES.slice(3).map(({ key }) => key),
    ]);
    expect(state.requests[1]?.body).toEqual({ enabled: false, expectedRevision: 2 });
    expect(state.requests[2]?.body).toBe(1);
  });

  it('puts a deleted route back where it was from the toast', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    const order = routeNames();
    await user.click(screen.getByRole('button', { name: 'Outside authors wait in Intake actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(state.routes.some(route => route.id === 'outside-authors')).toBe(false));

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(routeNames()).toEqual(order));
    expect(state.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'DELETE outside-authors',
      'POST ',
      'POST reorder',
    ]);
  });

  it('says someone else changed a route first, then shows their change', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    state.routes = state.routes.map(route =>
      route.id === 'everything-else' ? { ...route, name: 'Everything else, renamed', revision: 2 } : route,
    );
    await user.click(screen.getByRole('switch', { name: 'Use Everything else goes to Work › Intake' }));

    expect(
      await screen.findByText('Someone else changed these routes first, so your change wasn’t saved.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(routeNames().at(-1)).toBe('Everything else, renamed'));
    expect(screen.getByRole('switch', { name: 'Use Everything else, renamed' })).toBeChecked();
  });
});

describe('CardMovesSection', () => {
  const moveNames = () => namesIn(screen.getByRole('list', { name: 'Card moves' }));

  it("lists only this board's moves, each led by the change that triggers it", async () => {
    serveRoutes();
    renderWithProviders(<CardMovesSection factoryId="fp-1" boardId="work" />);

    await screen.findByRole('list', { name: 'Card moves' });
    expect(moveNames()).toContain('Closed issues go to Done');
    expect(moveNames()).toContain('Merged pull requests go to Done');
    expect(moveNames()).not.toContain('Everything else goes to Work › Intake');
    expect(screen.getAllByRole('combobox', { name: 'When' }).map(picker => picker.textContent)).toContain(
      'A pull request is merged',
    );
    expect(screen.queryByRole('combobox', { name: 'Board' })).toBeNull();
  });

  it('says a board has no moves rather than showing an empty list', async () => {
    serveRoutes();
    renderWithProviders(<CardMovesSection factoryId="fp-1" boardId="ship" />);

    expect(await screen.findByText('No card moves on this board.')).toBeInTheDocument();
  });

  it('narrows a move with several triggers to the one picked, even when it was listed first', async () => {
    const routes = seededRoutes().map(route =>
      route.id === 'pull-request-merged'
        ? { ...route, on: ['pull_request.merged', 'pull_request.closed'] as IntakeRouteInfo['on'] }
        : route,
    );
    const state = serveRoutes({ routes });
    const user = userEvent.setup();
    renderWithProviders(<CardMovesSection factoryId="fp-1" boardId="work" />);

    await screen.findByRole('list', { name: 'Card moves' });
    const row = routeRow('Merged pull requests go to Done');
    await user.click(within(row).getByRole('combobox', { name: 'When' }));
    await user.click(await screen.findByRole('option', { name: 'A pull request is merged' }));

    await waitFor(() =>
      expect(state.routes.find(route => route.id === 'pull-request-merged')?.on).toEqual(['pull_request.merged']),
    );
  });

  it('adds a move on this board for the change picked', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderWithProviders(<CardMovesSection factoryId="fp-1" boardId="ship" />);

    const draft = await startRoute(user, 'Merged pull requests ship', 'Add card move');
    await user.click(within(draft).getByRole('combobox', { name: 'When' }));
    await user.click(await screen.findByRole('option', { name: 'A pull request is merged' }));
    await user.click(within(draft).getByRole('button', { name: 'Add card move' }));

    await waitFor(() => expect(moveNames()).toContain('Merged pull requests ship'));
    expect(state.requests[0]?.body).toMatchObject({
      name: 'Merged pull requests ship',
      on: ['pull_request.merged'],
      target: { boardKey: 'ship' },
    });
  });
});

describe('NewCardsHere', () => {
  const renderSummary = (board: typeof workBoardInfo) =>
    renderWithProviders(
      <MemoryRouter>
        <NewCardsHere factoryId="fp-1" board={board} />
      </MemoryRouter>,
    );

  it('counts the routes that can land new cards on this board, not card moves, issue joins, or routes the catch-all hides', async () => {
    const base = seededRoutes()[0];
    const route = (id: string, extra: Partial<IntakeRouteInfo>): IntakeRouteInfo => ({
      ...base,
      id,
      name: id,
      when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'issue' }] },
      target: { boardKey: 'work', phaseKey: 'intake', joinClosedIssue: false },
      on: ['work_item.created'],
      ...extra,
    });
    serveRoutes({
      routes: [
        route('Issues', {}),
        route('Joins its issue', { target: { boardKey: 'work', phaseKey: 'review', joinClosedIssue: true } }),
        route('Off', { enabled: false }),
        route('Elsewhere', { target: { boardKey: 'ship', phaseKey: null, joinClosedIssue: false } }),
        route('Reopened', { on: ['work_item.reopened'], when: null }),
        route('Everything else', { when: null }),
        route('Never reached', {}),
      ].map((entry, position) => ({ ...entry, position })),
    });
    renderSummary(workBoardInfo);

    expect(await screen.findByText('2 intake routes send new cards here.')).toBeInTheDocument();
  });

  it('says when no route sends new cards to a board, and links to where routes are edited', async () => {
    serveRoutes();
    renderSummary(shipBoard);

    expect(await screen.findByText('No intake route sends new cards here.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit routes' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/intake#new-cards',
    );
  });
});
