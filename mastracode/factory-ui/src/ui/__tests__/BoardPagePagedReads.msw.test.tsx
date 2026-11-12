import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, onTestFinished } from 'vitest';

import { isStubbedProjectRead } from '../../../e2e/ui/board-reads';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { createAppRoutes } from '../router';
import { largeBoard, largeCardId } from './fixtures/largeBoard';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

const CARDS_PATH = `/web/factory/projects/${FACTORY_ID}/work-items`;

/**
 * Opens the Work board of a project holding `count` cards in Triage, none of them with a session,
 * and records what the page then asks the server about its cards.
 */
function openLargeBoard(count: number) {
  const project = { cards: largeBoard(count) };
  const asked = { listings: new Array<URLSearchParams>(), cardReads: new Array<string[]>(), wholeBoards: 0 };
  stubWorkBoard();
  server.use(
    http.get(`${TEST_BASE_URL}${CARDS_PATH}`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      if (query.has('scope') || query.has('source')) return HttpResponse.json({ workItems: [] });
      const ids = query.getAll('workItemId');
      return HttpResponse.json({
        workItems: ids.length > 0 ? project.cards.filter(card => ids.includes(card.id)) : project.cards,
      });
    }),
  );
  const record = ({ request }: { request: Request }) => {
    // The ambient paged reads ask the stub above what the project holds: the page did not.
    if (request.method !== 'GET' || isStubbedProjectRead(request)) return;
    const url = new URL(request.url);
    if (url.pathname === `${CARDS_PATH}/columns`) asked.listings.push(url.searchParams);
    if (url.pathname !== CARDS_PATH) return;
    if (url.searchParams.has('workItemId')) asked.cardReads.push(url.searchParams.getAll('workItemId'));
    else if (url.search === '') asked.wholeBoards += 1;
  };
  server.events.on('request:start', record);
  onTestFinished(() => server.events.removeListener('request:start', record));

  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  const { client } = renderWithProviders(<RouterProvider router={router} />);
  /** What a feed frame does to the board. */
  const refresh = () => act(() => client.invalidateQueries({ queryKey: queryKeys.workItems(FACTORY_ID) }));
  return { project, asked, refresh };
}

const cardIds = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, offset) => largeCardId(from + offset));

describe('The board of a large project', () => {
  it('opens on the count of every card of a column and its first cards only, in one read', async () => {
    const { asked } = openLargeBoard(250);

    expect(await screen.findByRole('button', { name: 'Triage, 250' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Load more cards' })).toBeInTheDocument();
    expect(asked.listings.map(listing => listing.get('cards'))).toEqual(['true']);
    expect(asked.cardReads).toEqual([]);
    expect(asked.wholeBoards).toBe(0);
  });

  it('lists a column deeper on demand, and downloads only the cards it does not hold', async () => {
    const { asked } = openLargeBoard(250);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Load more cards' }));

    await waitFor(() => expect(asked.cardReads).toHaveLength(1));
    // The newest fifty came with the board; the next fifty are the ones to download.
    expect(asked.cardReads[0]?.toSorted()).toEqual(cardIds(150, 199));
    expect(asked.listings.at(-1)?.getAll('window')).toEqual(['triage:100']);
    expect(asked.listings.at(-1)?.has('cards')).toBe(false);
    expect(screen.getByRole('button', { name: 'Triage, 250' })).toBeInTheDocument();
    expect(asked.wholeBoards).toBe(0);
  });

  it('searches the whole project once typing stops, and finds a card it had not loaded', async () => {
    const { asked } = openLargeBoard(250);
    // No pause between keys: the search settles once, after the last one.
    const user = userEvent.setup({ delay: null });
    await screen.findByRole('button', { name: 'Triage, 250' });

    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'task 137');

    expect(await screen.findByRole('article', { name: 'Large task 137' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Triage, 1' })).toBeInTheDocument();
    expect(asked.listings.flatMap(listing => listing.get('q') ?? [])).toEqual(['task 137']);
    expect(asked.cardReads).toEqual([[largeCardId(137)]]);
    expect(asked.wholeBoards).toBe(0);
  });

  it('downloads nothing on a refresh that changed nothing, and one card when one card changed', async () => {
    const { project, asked, refresh } = openLargeBoard(250);
    await screen.findByRole('button', { name: 'Load more cards' });

    await refresh();

    expect(asked.listings.map(listing => listing.get('cards'))).toEqual(['true', null]);
    expect(asked.cardReads).toEqual([]);

    project.cards = project.cards.map(card =>
      card.id === largeCardId(249)
        ? { ...card, title: 'Renamed task', workItem: { ...card.workItem, title: 'Renamed task' } }
        : card,
    );
    await refresh();

    expect(asked.listings).toHaveLength(3);
    expect(asked.cardReads).toEqual([[largeCardId(249)]]);
    expect(asked.wholeBoards).toBe(0);
  });
});
