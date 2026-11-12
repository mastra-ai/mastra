import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router';

import { keptReviewBoard, shipBoard, workBoard } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../e2e/ui/render';
import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../api/types';
import { IntakeRoutesSection } from '../../settings/components/IntakeRoutesSection';
import { CardMovesMap } from '../moves/CardMovesMap';
import { seededRoutes } from './fixtures';

const PROJECT_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1`;

/** The routes a new project is seeded with, as the route API lists them. */
function serve({
  routes = seededRoutes(),
  boards = [workBoard, shipBoard],
}: { routes?: IntakeRouteInfo[]; boards?: InstalledBoardInfo[] } = {}) {
  server.use(
    http.get(`${PROJECT_URL}/boards`, () => HttpResponse.json({ boards })),
    http.get(`${PROJECT_URL}/intake-routes`, () => HttpResponse.json({ intakeRoutes: routes, canEdit: true })),
  );
}

function Location() {
  const { pathname, search, hash } = useLocation();
  return <output aria-label="Location">{`${pathname}${search}${hash}`}</output>;
}

const location = () => screen.getByRole('status', { name: 'Location' }).textContent;

function renderIntake(entry = '/factories/fp-1/settings/intake?view=map') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[entry]}>
      <IntakeRoutesSection factoryId="fp-1" />
      <Location />
    </MemoryRouter>,
  );
}

const mapRoutes = async () => screen.findByRole('list', { name: 'Intake routes in order' });

afterEach(() => vi.restoreAllMocks());

describe('intake routes map', () => {
  it('lists new-card routes in the order they are tried, each with where its cards land', async () => {
    serve();
    renderIntake();

    const routes = within(await mapRoutes()).getAllByRole('link');
    expect(routes.map(route => route.getAttribute('aria-label'))).toEqual([
      'Pull requests that close a waiting issue join its card: Joins the issue’s card, moves it to Work › PR review',
      'Outside authors wait in Intake: Work › Intake',
      'Pull requests go to Review: Work › PR review',
      'Everything else goes to Work › Intake: Work › Intake',
    ]);
    // Only the last one takes every new card, and the map says so.
    expect(within(routes[3]).getByText('Catch-all')).toBeInTheDocument();
    expect(within(routes[0]).queryByText('Catch-all')).not.toBeInTheDocument();
    // The boards cards land on list the phases they land in, and nothing else.
    const work = screen.getByRole('list', { name: 'Work phases' });
    expect(
      within(work)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual(['Intake', 'PR review']);
    expect(screen.queryByRole('list', { name: 'Ship phases' })).not.toBeInTheDocument();
  });

  it('dims a route that is switched off and says it is off', async () => {
    serve({
      routes: seededRoutes().map(route => (route.id === 'pull-requests' ? { ...route, enabled: false } : route)),
    });
    renderIntake();

    const off = within(await mapRoutes()).getByRole('link', { name: /^Pull requests go to Review/ });
    expect(within(off).getByText('Off')).toBeInTheDocument();
    expect(off).toHaveAttribute('data-dimmed');
    const on = screen.getByRole('link', { name: /^Outside authors wait in Intake/ });
    expect(on).not.toHaveAttribute('data-dimmed');
  });

  it('marks routes below the catch-all as never running', async () => {
    const routes = seededRoutes();
    const catchAll = routes.findIndex(route => route.id === 'everything-else');
    const late = { ...routes[2], id: 'late', name: 'Late route', position: catchAll + 1 };
    serve({ routes: [...routes, late] });
    renderIntake();

    const link = within(await mapRoutes()).getByRole('link', { name: /^Late route/ });
    expect(within(link).getByText('Never runs: a route above takes every new card.')).toBeInTheDocument();
  });

  it('traces one source: routes that only take other sources fade', async () => {
    serve();
    renderIntake();
    await mapRoutes();

    await userEvent.click(screen.getByRole('button', { name: 'Linear' }));

    expect(screen.getByRole('button', { name: 'Linear' })).toHaveAttribute('aria-pressed', 'true');
    // Outside authors only names GitHub and GitLab, so Linear cards never take it.
    expect(screen.getByRole('link', { name: /^Outside authors wait in Intake/ })).toHaveAttribute('data-dimmed');
    expect(screen.getByRole('link', { name: /^Pull requests go to Review/ })).not.toHaveAttribute('data-dimmed');
  });

  it('opens a route in the editor when it is clicked', async () => {
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
    serve();
    renderIntake();

    await userEvent.click(within(await mapRoutes()).getByRole('link', { name: /^Pull requests go to Review/ }));

    expect(location()).toBe('/factories/fp-1/settings/intake#intake-route-pull-requests');
    expect(screen.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() =>
      expect(scrolled.mock.contexts).toContain(document.getElementById('intake-route-pull-requests')),
    );
    const row = document.getElementById('intake-route-pull-requests')!;
    expect(within(row).getByDisplayValue('Pull requests go to Review')).toBeInTheDocument();
  });

  it('switches between the editor and the map, keeping the choice in the URL', async () => {
    serve();
    renderIntake('/factories/fp-1/settings/intake');

    expect(await screen.findByRole('list', { name: 'Intake routes' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Map' }));

    expect(await mapRoutes()).toBeInTheDocument();
    expect(location()).toBe('/factories/fp-1/settings/intake?view=map');
  });
});

function renderMoves(board: InstalledBoardInfo, routes?: IntakeRouteInfo[]) {
  serve({ boards: [board], routes });
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/fp-1/boards/${board.id}/moves?view=map`]}>
      <CardMovesMap
        factoryId="fp-1"
        boardId={board.id}
        moveHref={id => `/factories/fp-1/boards/${board.id}/moves#intake-route-${id}`}
      />
      <Location />
    </MemoryRouter>,
  );
}

const phaseCards = async () =>
  within(await screen.findByRole('list', { name: 'Phases' }))
    .getAllByRole('listitem')
    .map(item => item.textContent);

describe('card moves map', () => {
  it('shows each phase in board order with the phases it may move to', async () => {
    renderMoves(workBoard);

    const phases = within(await screen.findByRole('list', { name: 'Phases' })).getAllByRole('listitem');
    expect(phases.map(phase => within(phase).getByRole('heading').textContent)).toEqual([
      'Intake',
      'Triage',
      'Planning',
      'Building',
      'Review',
      'PR review',
      'Done',
      'Canceled',
    ]);
    const planning = phases[2];
    expect(planning).toHaveTextContent('Can move to Intake, Triage, Building, Done, Canceled');
    expect(planning).toHaveTextContent('Ends with submit_plan, after approval');
    expect(phases[0]).toHaveTextContent('New cards start here');
  });

  it('says a phase that may move anywhere once, instead of listing every phase', async () => {
    renderMoves(keptReviewBoard, []);

    const cards = await phaseCards();
    expect(cards[0]).toContain('Can move to any phase');
    expect(cards[0]).not.toContain('Reviewing, Done');
    // A finished phase with no moves of its own keeps its cards.
    expect(cards[2]).toContain('Cards stay here');
  });

  it('shows the moves an issue or pull request triggers, each opening in the editor', async () => {
    renderMoves(workBoard);

    const moves = within(await screen.findByRole('list', { name: 'Moves when an issue changes' }));
    const closed = moves.getByRole('link', { name: /Closed issues go to Done/ });
    // The route's name, what sets it off, and where it lands, each said once.
    expect(closed).toHaveTextContent('Closed issues go to DoneWhen a card is closed');
    expect(closed).toHaveTextContent('Moves toDone');
    expect(closed).not.toHaveTextContent('→');

    await userEvent.click(closed);

    expect(location()).toBe('/factories/fp-1/boards/work/moves#intake-route-closed-completed');
  });
});
