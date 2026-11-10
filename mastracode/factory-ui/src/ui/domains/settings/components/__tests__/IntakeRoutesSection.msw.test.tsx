import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_INTAKE_ROUTES } from '@mastra/factory/boards/work-routes';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { shipBoard, workBoardInfo } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { IntakeRouteInfo } from '../../../../../api/types';
import { IntakeRoutesSection } from '../IntakeRoutesSection';

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
    allowWorkingPhase: route.allowWorkingPhase ?? false,
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
 * name, and a new route goes just ahead of the seeded catch-all, bumping its revision.
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
        allowWorkingPhase?: boolean;
      };
      state.requests.push({ method: 'POST', path: '', body });
      const route: IntakeRouteInfo = {
        ...seededRoutes()[0],
        id: `mine-${++created}`,
        name: body.name,
        when: body.when ?? null,
        target: { boardKey: body.target.boardKey, phaseKey: body.target.phaseKey ?? null, joinClosedIssue: false },
        on: body.on ?? ['work_item.created'],
        allowWorkingPhase: body.allowWorkingPhase ?? false,
        createdBy: 'admin',
      };
      const last = state.routes.at(-1);
      const catchAll = last?.createdBy === 'factory' && last.when === null && last.enabled;
      // Moving the catch-all down a slot is a write to it, so its revision goes up, as in storage.
      state.routes = catchAll
        ? [
            ...state.routes.slice(0, -1),
            { ...route, position: last.position },
            { ...last, position: last.position + 1, revision: last.revision + 1 },
          ]
        : [...state.routes, { ...route, position: state.routes.length }];
      return HttpResponse.json({ intakeRoute: route }, { status: 201 });
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
      state.routes = state.routes.filter(route => route.id !== current.id);
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

const routeNames = () =>
  within(screen.getByRole('list', { name: 'Intake routes' }))
    .getAllByRole('listitem')
    .map(item => item.querySelector('.truncate')?.textContent);

/** The rule builder's field selects have no label; they show what they are asking for. */
const ruleSelect = (prompt: string) => {
  const select = screen.getAllByRole('combobox').find(combobox => combobox.textContent?.includes(prompt));
  if (!select) throw new Error(`No rule select showing "${prompt}"`);
  return select;
};

const renderSection = () => renderWithProviders(<IntakeRoutesSection factoryId="fp-1" />);

describe('IntakeRoutesSection', () => {
  it("lists the project's own routes in the order they are tried, ending with the catch-all to Work › Intake", async () => {
    serveRoutes();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    expect(routeNames()).toEqual(DEFAULT_INTAKE_ROUTES.map(({ route }) => route.name));
    const last = within(screen.getByRole('list', { name: 'Intake routes' }))
      .getAllByRole('listitem')
      .at(-1)!;
    expect(last).toHaveTextContent('Everything else goes to Work › Intake');
    expect(last).toHaveTextContent('When: Every card');
    expect(last).toHaveTextContent('Goes to: Work › Intake');
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
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(routeNames().at(-1)).toBe('Everything else goes to Ship › Inbox'));
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
    expect(byName('Pushes to a reviewed pull request re-review it on Ship')).toMatchObject({
      allowWorkingPhase: true,
      target: { boardKey: 'ship', phaseKey: 'pr' },
    });
    // The copies sit ahead of the catch-all, and Work keeps its own event routes for its cards.
    expect(state.routes.at(-1)?.id).toBe('everything-else');
    expect(byName('Closed issues go to Done')?.target.boardKey).toBe('work');
  });

  it('adds a route ahead of the catch-all so it can match new cards', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Add route' }));
    await user.type(screen.getByLabelText('Route name'), 'Releases go to Ship');
    await user.click(screen.getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    expect(screen.getByRole('combobox', { name: 'Phase' })).toHaveTextContent('Inbox');
    await user.click(screen.getByRole('button', { name: 'Add route' }));

    await waitFor(() => expect(routeNames()).toContain('Releases go to Ship'));
    expect(state.requests).toEqual([
      {
        method: 'POST',
        path: '',
        body: { name: 'Releases go to Ship', when: null, target: { boardKey: 'ship', phaseKey: 'inbox' } },
      },
    ]);
    expect(routeNames().slice(-2)).toEqual(['Releases go to Ship', 'Everything else goes to Work › Intake']);
  });

  it('sends one repository to another board, picking the repository from the fields a route can test', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Add route' }));
    await user.type(screen.getByLabelText('Route name'), 'acme/app goes to Ship');
    await user.click(screen.getByRole('button', { name: /Add conditional rule/ }));
    await user.click(ruleSelect('Select field'));
    await user.click(await screen.findByRole('option', { name: /Source/ }));
    await user.click(ruleSelect('Select property'));
    expect(await screen.findByRole('option', { name: /Provider/ })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Repository, team or project/ }));
    await user.type(screen.getByPlaceholderText('Enter value'), 'acme/app');
    await user.click(screen.getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    await user.click(screen.getByRole('button', { name: 'Add route' }));

    await waitFor(() => expect(routeNames()).toContain('acme/app goes to Ship'));
    expect(state.requests[0]?.body).toMatchObject({
      name: 'acme/app goes to Ship',
      when: { operator: 'AND', conditions: [{ field: 'source.repository', operator: 'equals', value: 'acme/app' }] },
      target: { boardKey: 'ship', phaseKey: 'inbox' },
    });
  });

  it("won't save a new-card route that tests the event, which new cards don't have", async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Add route' }));
    await user.type(screen.getByLabelText('Route name'), 'Completed');
    await user.click(screen.getByRole('button', { name: 'Edit as JSON' }));
    await user.click(screen.getByLabelText('Applies when JSON'));
    await user.paste(
      JSON.stringify({
        operator: 'AND',
        conditions: [{ field: 'event.reason', operator: 'equals', value: 'completed' }],
      }),
    );

    expect(
      await screen.findByText(/only apply to routes that handle an event besides work_item\.created/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add route' })).toBeDisabled();
    expect(state.requests).toEqual([]);
  });

  it('sends new cards elsewhere by changing the first route that takes them all, the one that applies', async () => {
    const routes = seededRoutes();
    const mine: IntakeRouteInfo = { ...routes.at(-1)!, id: 'mine', name: 'Everything else, mine', createdBy: 'admin' };
    const state = serveRoutes({ routes: [...routes.slice(0, -1), mine, routes.at(-1)!] });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByLabelText('Board for new cards'));
    await user.click(await screen.findByRole('option', { name: 'Ship' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(state.routes.find(route => route.id === 'mine')?.target.boardKey).toBe('ship'));
    expect(state.routes.find(route => route.id === 'everything-else')?.target.boardKey).toBe('work');
  });

  it('reorders, disables, and deletes routes with the revision each one was read at', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    const before = routeNames().indexOf('Pull requests go to Review');
    await user.click(screen.getByRole('button', { name: 'Move Pull requests go to Review up' }));
    await waitFor(() => expect(routeNames().indexOf('Pull requests go to Review')).toBe(before - 1));

    await user.click(screen.getByRole('switch', { name: 'Use Outside authors wait in Intake' }));
    await waitFor(() => expect(state.routes.find(route => route.id === 'outside-authors')?.enabled).toBe(false));

    await user.click(screen.getByRole('button', { name: 'Delete Requested reviews go to Review' }));
    expect(state.requests).toHaveLength(2);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(routeNames()).not.toContain('Requested reviews go to Review'));

    expect(state.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST reorder',
      'PATCH outside-authors',
      'DELETE pull-request-review-requested',
    ]);
    // The reorder swapped it with the route moved up, so storage wrote it.
    expect(state.requests[1]?.body).toEqual({ enabled: false, expectedRevision: 2 });
    expect(state.requests[2]?.body).toBe(1);
  });

  it('asks to reload when someone else changed a route first, then shows their change', async () => {
    const state = serveRoutes();
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('list', { name: 'Intake routes' });
    state.routes = state.routes.map(route =>
      route.id === 'everything-else' ? { ...route, name: 'Everything else, renamed', revision: 2 } : route,
    );
    await user.click(screen.getByRole('switch', { name: 'Use Everything else goes to Work › Intake' }));

    expect(await screen.findByText('Someone else changed these routes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(routeNames().at(-1)).toBe('Everything else, renamed'));
    expect(screen.queryByText('Someone else changed these routes')).toBeNull();
  });
});
