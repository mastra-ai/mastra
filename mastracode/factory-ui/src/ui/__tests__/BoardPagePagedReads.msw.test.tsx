import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod';

import { isStubbedProjectRead } from '../../../e2e/ui/board-reads';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { createAppRoutes } from '../router';
import { boardViewport, mockBoardRowLayout } from './boardRowLayout';
import { largeBoard, largeCardId } from './fixtures/largeBoard';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

const CARDS_PATH = `/web/factory/projects/${FACTORY_ID}/work-items`;
const PHASES_PATH = `/web/factory/projects/${FACTORY_ID}/boards/work/phases`;

const answeredCardsSchema = z.object({ workItems: z.array(z.unknown()).optional() });

/**
 * Opens the Work board of a project holding `count` cards, in Triage unless `stageOf` says where,
 * none of them with a session, and records what the page then asks the server about its cards.
 * `link` is the query of the address the board is opened from.
 */
function openLargeBoard(count: number, stageOf: (index: number) => string = () => 'triage', link = '') {
  const project = { cards: largeBoard(count).map((card, index) => ({ ...card, stages: [stageOf(index)] })) };
  const asked = {
    listings: new Array<URLSearchParams>(),
    cardReads: new Array<string[]>(),
    wholeBoards: 0,
    /** How many card bodies the answers to the page carried. */
    cardsDownloaded: 0,
  };
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
    if (url.pathname === PHASES_PATH) asked.listings.push(url.searchParams);
    if (url.pathname !== CARDS_PATH) return;
    if (url.searchParams.has('workItemId')) asked.cardReads.push(url.searchParams.getAll('workItemId'));
    else if (url.search === '') asked.wholeBoards += 1;
  };
  const countBodies = async ({ request, response }: { request: Request; response: Response }) => {
    const { pathname } = new URL(request.url);
    if (isStubbedProjectRead(request) || (pathname !== PHASES_PATH && pathname !== CARDS_PATH)) return;
    asked.cardsDownloaded += answeredCardsSchema.parse(await response.clone().json()).workItems?.length ?? 0;
  };
  server.events.on('request:start', record);
  server.events.on('response:mocked', countBodies);
  onTestFinished(() => {
    server.events.removeListener('request:start', record);
    server.events.removeListener('response:mocked', countBodies);
  });

  const boardPath = `/factories/${FACTORY_ID}/work`;
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`${boardPath}${link}`] });
  const { client } = renderWithProviders(<RouterProvider router={router} />);
  /** What a feed frame does to the board. */
  const refresh = () => act(() => client.invalidateQueries({ queryKey: queryKeys.workItems(FACTORY_ID) }));
  /** Leaves the link for the board's plain address. */
  const dropLink = () => act(() => router.navigate(boardPath));
  /** Shows the board at another query of its address: another order, search or filter. */
  const show = (query: string) => act(() => router.navigate(`${boardPath}${query}`));
  return { project, asked, refresh, dropLink, show };
}

const cardIds = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, offset) => largeCardId(from + offset));

describe('The board of a large project', () => {
  beforeEach(mockBoardRowLayout);
  afterEach(() => vi.restoreAllMocks());

  it('opens on the count of every card of a phase and its first cards only, in one read', async () => {
    const { asked } = openLargeBoard(250);

    expect(await screen.findByRole('button', { name: 'Triage, 250' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Load more cards' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Large task 249' })).toBeInTheDocument();
    expect(asked.listings.map(listing => listing.get('cards'))).toEqual(['true']);
    expect(asked.cardReads).toEqual([]);
    expect(asked.wholeBoards).toBe(0);
  });

  it('lists a phase deeper on demand, and downloads only the cards it does not hold', async () => {
    const { asked } = openLargeBoard(250);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Load more cards' }));

    await waitFor(() => expect(asked.cardReads).toHaveLength(1));
    // The newest fifty came with the board; the next fifty are the ones to download.
    expect(asked.cardReads[0]?.toSorted()).toEqual(cardIds(150, 199));
    expect(asked.listings.at(-1)?.getAll('window')).toEqual(['triage:100']);
    expect(asked.listings.at(-1)?.has('cards')).toBe(false);
    expect(screen.getByRole('button', { name: 'Triage, 250' })).toBeInTheDocument();
    // The cards just downloaded are the rows the phase now lists below its first fifty.
    fireEvent.scroll(boardViewport(), { target: { scrollTop: 60 * 48 } });
    expect(await screen.findByRole('article', { name: 'Large task 189' })).toBeInTheDocument();
    expect(asked.wholeBoards).toBe(0);
  });

  it('lists a second phase deeper while the first one is still being read', async () => {
    let answerTriage = () => {};
    const triageHeld = new Promise<void>(resolve => {
      answerTriage = resolve;
    });
    const { asked } = openLargeBoard(240, index => (index < 120 ? 'triage' : 'planning'));
    server.use(
      http.get(`${TEST_BASE_URL}${PHASES_PATH}`, async ({ request }) => {
        const windows = new URL(request.url).searchParams.getAll('window');
        // Triage's deeper window alone is the read to hold; the ambient read answers every one.
        if (windows.length === 1) await triageHeld;
      }),
    );
    const user = userEvent.setup();
    const [moreOfTriage] = await screen.findAllByRole('button', { name: 'Load more cards' });
    if (!moreOfTriage) throw new Error('Triage offers no more cards');

    await user.click(moreOfTriage);
    await screen.findByRole('status', { name: 'Loading more cards' });
    await user.click(screen.getByRole('button', { name: 'Load more cards' }));
    try {
      // Planning is asked for while Triage's read is still held.
      await waitFor(() =>
        expect(asked.listings.some(listing => listing.getAll('window').includes('planning:100'))).toBe(true),
      );
    } finally {
      answerTriage();
    }

    // Each phase listed its newest fifty: the fifty-first of each follows.
    await waitFor(() => expect(asked.cardReads).not.toEqual([]));
    fireEvent.scroll(boardViewport(), { target: { scrollTop: 50 * 48 } });
    expect(await screen.findByRole('article', { name: 'Large task 69' })).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Large task 189' })).toBeInTheDocument();
    expect(asked.listings.at(-1)?.getAll('window').toSorted()).toEqual(['planning:100', 'triage:100']);
  });

  it('opens a link to the last card of a long phase on that card and the first cards, not the cards above it', async () => {
    const linked = largeCardId(0);
    const { asked } = openLargeBoard(2000, undefined, `?item=${linked}`);

    expect(await screen.findByRole('article', { name: 'Large task 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Triage, 2000' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Large task 1999' })).toBeInTheDocument();
    // The phase is not listed down to the card: the rest of it is still to load.
    expect(screen.getByRole('button', { name: 'Load more cards' })).toBeInTheDocument();
    expect(asked.listings.map(listing => [listing.get('item'), listing.getAll('window')])).toEqual([[linked, []]]);
    expect(asked.cardReads).toEqual([]);
    // The newest fifty, and the linked card.
    await waitFor(() => expect(asked.cardsDownloaded).toBe(51));
    expect(asked.wholeBoards).toBe(0);
  });

  it('asks for the linked card as long as the address names it, and no longer', async () => {
    const linked = largeCardId(0);
    const { asked, dropLink } = openLargeBoard(250, undefined, `?item=${linked}`);
    expect(await screen.findByRole('article', { name: 'Large task 0' })).toBeInTheDocument();

    await dropLink();

    await waitFor(() => expect(screen.queryByRole('article', { name: 'Large task 0' })).not.toBeInTheDocument());
    expect(asked.listings.map(listing => listing.get('item'))).toEqual([linked, null]);
    expect(screen.getByRole('article', { name: 'Large task 249' })).toBeInTheDocument();
    expect(asked.cardReads).toEqual([]);
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
    expect(screen.getByRole('article', { name: 'Large task 249' })).toBeInTheDocument();

    project.cards = project.cards.map(card =>
      card.id === largeCardId(249)
        ? { ...card, title: 'Renamed task', workItem: { ...card.workItem, title: 'Renamed task' } }
        : card,
    );
    await refresh();

    expect(asked.listings).toHaveLength(3);
    expect(asked.cardReads).toEqual([[largeCardId(249)]]);
    expect(await screen.findByRole('article', { name: 'Renamed task' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Large task 249' })).not.toBeInTheDocument();
    expect(asked.wholeBoards).toBe(0);
  });

  it('offers to read the board again when its read fails, and shows the board once the server answers', async () => {
    let down = true;
    openLargeBoard(60);
    server.use(
      http.get(`${TEST_BASE_URL}${PHASES_PATH}`, () =>
        down ? HttpResponse.json({ error: 'Board unavailable' }, { status: 500 }) : undefined,
      ),
    );
    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByText('Board unavailable')).toBeInTheDocument();

    down = false;
    await userEvent.click(retry);

    expect(await screen.findByRole('button', { name: 'Triage, 60' })).toBeInTheDocument();
    expect(screen.queryByText('Board unavailable')).not.toBeInTheDocument();
  });

  it('keeps a card open, with what is typed in it, when the order changes to one the page holds that lists the card deeper', async () => {
    const { asked, show } = openLargeBoard(120, undefined, '?sort=created-newest');
    const user = userEvent.setup();
    expect(await screen.findByRole('article', { name: 'Large task 119' })).toBeInTheDocument();
    await show('?sort=created-oldest');
    await user.click(await screen.findByText('Large task 0'));
    const panel = await screen.findByRole('dialog', { name: 'Large task 0' });
    await user.click(within(panel).getByRole('button', { name: 'Add a description' }));
    await user.type(within(panel).getByRole('textbox', { name: 'Description' }), 'Half a thought');

    // The newest order is one the page holds, read when no card was open: its fifty cards end far above this one.
    await show('?sort=created-newest');

    expect(await screen.findByRole('article', { name: 'Large task 119' })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        asked.listings
          .at(-1)
          ?.getAll('sort')
          .concat(asked.listings.at(-1)?.getAll('item') ?? []),
      ).toEqual(['created-newest', largeCardId(0)]),
    );
    expect(screen.getByRole('dialog', { name: 'Large task 0' })).toBe(panel);
    expect(within(panel).getByRole('textbox', { name: 'Description' })).toHaveValue('Half a thought');
  });
});
