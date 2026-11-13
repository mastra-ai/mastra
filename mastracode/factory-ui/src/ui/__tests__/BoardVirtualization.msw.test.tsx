import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { saveKanbanView } from './boardLayoutQueries';
import { boardViewport, mockBoardRowLayout } from './boardRowLayout';
import { largeBoard, largeCardId } from './fixtures/largeBoard';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

const ITEM_COUNT = 250;

function serveWorkItems(count: number) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: largeBoard(count) }),
    ),
  );
}

function renderBoard(search = '', itemCount = ITEM_COUNT) {
  stubWorkBoard();
  serveWorkItems(itemCount);
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/work${search}`],
  });
  const { client } = renderWithProviders(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  return { router, client };
}

describe('Large factory boards', () => {
  beforeEach(mockBoardRowLayout);
  afterEach(() => vi.restoreAllMocks());

  it.each(['list', 'board'] as const)(
    'given a large %s, when scrolling far down and back, recycles cards instead of accumulating them',
    async layout => {
      renderBoard();
      await screen.findByLabelText('Large task 249');
      if (layout === 'board') await saveKanbanView(userEvent.setup());

      expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
      fireEvent.scroll(boardViewport(), { target: { scrollTop: 6000 } });
      await waitFor(() => expect(screen.queryByLabelText('Large task 249')).not.toBeInTheDocument());
      expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);

      fireEvent.scroll(boardViewport(), { target: { scrollTop: 0 } });
      expect(await screen.findByLabelText('Large task 249')).toBeInTheDocument();
      expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
    },
  );

  it('given a deep link to the last issue, shows and focuses it without mounting all preceding issues', async () => {
    renderBoard(`?item=${largeCardId(0)}`);
    expect(await screen.findByLabelText('Large task 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details for Large task 0' })).toHaveFocus();
    expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
  });

  it('given a handled deep link, a sort that moves the target does not scroll the board back to it', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    onTestFinished(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });
    const { router } = renderBoard(`?item=${largeCardId(100)}`);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Details for Large task 100' })).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fireEvent.scroll(boardViewport(), { target: { scrollTop: 0 } });
    const scrollTo = vi.spyOn(boardViewport(), 'scrollTo');
    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?item=${largeCardId(100)}&sort=created-oldest`));

    expect(await screen.findByLabelText('Large task 0')).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(boardViewport().scrollTop).toBe(0);
  });

  it('given an issue the board has not loaded, finds it by searching the full dataset', async () => {
    const { router } = renderBoard();
    await screen.findByLabelText('Large task 249');
    expect(screen.queryByLabelText('Large task 137')).not.toBeInTheDocument();
    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?search=task+137`));
    expect(await screen.findByLabelText('Large task 137')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('work-item-card')).toHaveLength(1));
  });

  it('given open details, scrolling keeps the card and its description draft alive', async () => {
    renderBoard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for Large task 249' }));
    const details = await screen.findByRole('dialog', { name: 'Large task 249' });
    await user.click(await within(details).findByRole('button', { name: 'Add a description' }));
    const draft = within(details).getByRole('textbox', { name: 'Description' });
    await user.type(draft, 'Keep this draft while I scroll');

    fireEvent.scroll(boardViewport(), { target: { scrollTop: 6000 } });
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Large task 248' })).not.toBeInTheDocument());
    expect(details).toBeInTheDocument();
    expect(draft).toHaveValue('Keep this draft while I scroll');
    expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
  });

  it('given an open description draft, changing sort retains the same issue when its position changes', async () => {
    const { router } = renderBoard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for Large task 249' }));
    const details = await screen.findByRole('dialog', { name: 'Large task 249' });
    await user.click(await within(details).findByRole('button', { name: 'Add a description' }));
    const draft = within(details).getByRole('textbox', { name: 'Description' });
    await user.type(draft, 'Keep this draft after sorting');

    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?sort=created-oldest`));

    expect(await screen.findByLabelText('Large task 0')).toBeInTheDocument();
    expect(details).toBeInTheDocument();
    expect(draft).toHaveValue('Keep this draft after sorting');
    expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
  });

  it('given an open description draft, a refresh crossing the virtualization threshold keeps the draft both ways', async () => {
    const { client } = renderBoard('', 30);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for Large task 29' }));
    const details = await screen.findByRole('dialog', { name: 'Large task 29' });
    await user.click(await within(details).findByRole('button', { name: 'Add a description' }));
    const draft = within(details).getByRole('textbox', { name: 'Description' });
    await user.type(draft, 'Keep this draft across refreshes');

    serveWorkItems(31);
    await act(() => client.invalidateQueries());
    expect(await screen.findByLabelText('Large task 30')).toBeInTheDocument();
    expect(details).toBeInTheDocument();
    expect(draft).toHaveValue('Keep this draft across refreshes');

    serveWorkItems(30);
    await act(() => client.invalidateQueries());
    await waitFor(() => expect(screen.queryByLabelText('Large task 30')).not.toBeInTheDocument());
    expect(details).toBeInTheDocument();
    expect(draft).toHaveValue('Keep this draft across refreshes');
  });

  it('given a focused card, scrolling preserves keyboard focus until the user leaves it', async () => {
    renderBoard();
    const details = await screen.findByRole('button', { name: 'Details for Large task 249' });
    act(() => details.focus());

    fireEvent.scroll(boardViewport(), { target: { scrollTop: 6000 } });
    await waitFor(() => expect(screen.queryByLabelText('Large task 248')).not.toBeInTheDocument());
    expect(details).toHaveFocus();

    act(() => details.blur());
    await waitFor(() => expect(screen.queryByLabelText('Large task 249')).not.toBeInTheDocument());
  });

  it('given an active drag, scrolling keeps its source mounted until the drag ends', async () => {
    renderBoard();
    const card = await screen.findByLabelText('Large task 249');
    const transferred = new Map<string, string>();
    const dataTransfer = { setData: (type: string, value: string) => transferred.set(type, value) };
    fireEvent.dragStart(card, { dataTransfer });

    fireEvent.scroll(boardViewport(), { target: { scrollTop: 6000 } });
    await waitFor(() => expect(screen.queryByLabelText('Large task 248')).not.toBeInTheDocument());
    expect(card).toBeInTheDocument();

    fireEvent.dragEnd(card, { dataTransfer });
    await waitFor(() => expect(screen.queryByLabelText('Large task 249')).not.toBeInTheDocument());
  });
});
