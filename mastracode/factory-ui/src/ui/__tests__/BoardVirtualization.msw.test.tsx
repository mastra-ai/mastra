import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { saveKanbanView } from './boardLayoutQueries';
import { largeBoard, largeCandidatePage } from './fixtures/largeBoard';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

const ITEM_COUNT = 250;

function viewport() {
  const element = screen.getByTestId('board-column-triage').closest<HTMLElement>('.overflow-auto');
  if (!element) throw new Error('Missing board scroll container');
  return element;
}

function renderBoard(search = '') {
  stubWorkBoard();
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: largeBoard(ITEM_COUNT) }),
    ),
  );
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/work${search}`],
  });
  renderWithProviders(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  return router;
}

describe('Large factory boards', () => {
  beforeEach(() => {
    // Supply only browser geometry. TanStack Virtual, our components, queries,
    // and transport all run for real; jsdom itself has no layout engine.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.matches('.overflow-auto') ? 600 : 48;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const scroller = this.closest<HTMLElement>('.overflow-auto');
      const height = this.matches('.overflow-auto') ? 600 : 48;
      return new DOMRect(0, this === scroller ? 0 : -(scroller?.scrollTop ?? 0), 1200, height);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['list', 'board'] as const)(
    'given a large %s, when scrolling far down and back, recycles cards instead of accumulating them',
    async layout => {
      renderBoard();
      await screen.findByLabelText('Large task 249');
      if (layout === 'board') await saveKanbanView(userEvent.setup());

      expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
      fireEvent.scroll(viewport(), { target: { scrollTop: 6000 } });
      await waitFor(() => expect(screen.queryByLabelText('Large task 249')).not.toBeInTheDocument());
      expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);

      fireEvent.scroll(viewport(), { target: { scrollTop: 0 } });
      expect(await screen.findByLabelText('Large task 249')).toBeInTheDocument();
      expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
    },
  );

  it('given a deep link to the last issue, shows and focuses it without mounting all preceding issues', async () => {
    renderBoard('?item=large-0');
    expect(await screen.findByLabelText('Large task 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details for Large task 0' })).toHaveFocus();
    expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
  });

  it('given an offscreen issue, finds it by searching the full dataset', async () => {
    const router = renderBoard();
    await screen.findByLabelText('Large task 249');
    expect(screen.queryByLabelText('Large task 0')).not.toBeInTheDocument();
    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?search=Large+task+0`));
    expect(await screen.findByLabelText('Large task 0')).toBeInTheDocument();
    expect(screen.getAllByTestId('work-item-card')).toHaveLength(1);
  });

  it('given open details, scrolling keeps the card and its comment draft alive', async () => {
    renderBoard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for Large task 249' }));
    const details = await screen.findByRole('dialog', { name: 'Large task 249' });
    const comment = await within(details).findByRole('textbox', { name: 'Comment' });
    await user.type(comment, 'Keep this draft while I scroll');

    fireEvent.scroll(viewport(), { target: { scrollTop: 6000 } });
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Large task 248' })).not.toBeInTheDocument());
    expect(details).toBeInTheDocument();
    expect(comment).toHaveValue('Keep this draft while I scroll');
    expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
  });

  it('given an open comment draft, changing sort retains the same issue when its position changes', async () => {
    const router = renderBoard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for Large task 249' }));
    const details = await screen.findByRole('dialog', { name: 'Large task 249' });
    const comment = await within(details).findByRole('textbox', { name: 'Comment' });
    await user.type(comment, 'Keep this draft after sorting');

    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?sort=created-oldest`));

    expect(await screen.findByLabelText('Large task 0')).toBeInTheDocument();
    expect(details).toBeInTheDocument();
    expect(comment).toHaveValue('Keep this draft after sorting');
    expect(screen.getAllByTestId('work-item-card').length).toBeLessThan(35);
  });

  it('given a focused card, scrolling preserves keyboard focus until the user leaves it', async () => {
    renderBoard();
    const details = await screen.findByRole('button', { name: 'Details for Large task 249' });
    act(() => details.focus());

    fireEvent.scroll(viewport(), { target: { scrollTop: 6000 } });
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

    fireEvent.scroll(viewport(), { target: { scrollTop: 6000 } });
    await waitFor(() => expect(screen.queryByLabelText('Large task 248')).not.toBeInTheDocument());
    expect(card).toBeInTheDocument();

    fireEvent.dragEnd(card, { dataTransfer });
    await waitFor(() => expect(screen.queryByLabelText('Large task 249')).not.toBeInTheDocument());
  });

  it.each(['list', 'board'] as const)(
    'given a large candidate feed in %s layout, scrolling recycles candidates too',
    async layout => {
      renderBoard();
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
          HttpResponse.json({ workItems: [] }),
        ),
        http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
          HttpResponse.json({ config: { github: { enabled: true, sourceIds: ['acme/app'] } } }),
        ),
        http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, ({ request }) =>
          HttpResponse.json(largeCandidatePage(new URL(request.url).searchParams.has('label') ? 0 : ITEM_COUNT)),
        ),
      );
      await screen.findByRole('article', { name: 'Candidate 0' });
      if (layout === 'board') await saveKanbanView(userEvent.setup());
      expect(screen.getAllByTestId('candidate-card').length).toBeLessThan(35);

      fireEvent.scroll(viewport(), { target: { scrollTop: 6000 } });
      await waitFor(() => expect(screen.queryByRole('article', { name: 'Candidate 0' })).not.toBeInTheDocument());
      expect(screen.getAllByTestId('candidate-card').length).toBeLessThan(35);
    },
  );
});
