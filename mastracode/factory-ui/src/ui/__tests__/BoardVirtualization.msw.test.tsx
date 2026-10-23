import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { createAppRoutes } from '../router';
import type { GithubIssueDetail } from '../domains/factory/services/factory';
import { saveKanbanView } from './boardLayoutQueries';
import { largeBoard, largeCandidatePage } from './fixtures/largeBoard';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

const ITEM_COUNT = 250;

function viewport() {
  const element = screen.getByTestId('board-column-triage').closest<HTMLElement>('.overflow-auto');
  if (!element) throw new Error('Missing board scroll container');
  return element;
}

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
  beforeEach(() => {
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

  it('given a handled deep link, a sort that moves the target does not scroll the board back to it', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    onTestFinished(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });
    const { router } = renderBoard('?item=large-100');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Details for Large task 100' })).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fireEvent.scroll(viewport(), { target: { scrollTop: 0 } });
    const scrollTo = vi.spyOn(viewport(), 'scrollTo');
    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?item=large-100&sort=created-oldest`));

    expect(await screen.findByLabelText('Large task 0')).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(viewport().scrollTop).toBe(0);
  });

  it('given an offscreen issue, finds it by searching the full dataset', async () => {
    const { router } = renderBoard();
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
    const { router } = renderBoard();
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

  it('given an open comment draft, a refresh crossing the virtualization threshold keeps the draft both ways', async () => {
    const { client } = renderBoard('', 30);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Details for Large task 29' }));
    const details = await screen.findByRole('dialog', { name: 'Large task 29' });
    const comment = await within(details).findByRole('textbox', { name: 'Comment' });
    await user.type(comment, 'Keep this draft across refreshes');

    serveWorkItems(31);
    await act(() => client.invalidateQueries());
    expect(await screen.findByLabelText('Large task 30')).toBeInTheDocument();
    expect(details).toBeInTheDocument();
    expect(comment).toHaveValue('Keep this draft across refreshes');

    serveWorkItems(30);
    await act(() => client.invalidateQueries());
    await waitFor(() => expect(screen.queryByLabelText('Large task 30')).not.toBeInTheDocument());
    expect(details).toBeInTheDocument();
    expect(comment).toHaveValue('Keep this draft across refreshes');
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
    'given 30 candidates in %s layout, when another query page arrives, preserves an open prompt and bounds mounted cards',
    async layout => {
      const { client } = renderBoard();
      const requestedPages: number[] = [];
      let releasePage = () => {};
      const nextPage = new Promise<void>(resolve => {
        releasePage = resolve;
      });
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
          HttpResponse.json({ workItems: [] }),
        ),
        http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
          HttpResponse.json({ config: { github: { enabled: true, sourceIds: ['acme/app'] } } }),
        ),
        http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, async ({ request }) => {
          const params = new URL(request.url).searchParams;
          if (params.has('label')) return HttpResponse.json(largeCandidatePage(0));
          const page = Number(params.get('page') ?? 1);
          requestedPages.push(page);
          if (page === 2) await nextPage;
          return HttpResponse.json({
            ...largeCandidatePage(page === 1 ? 30 : 100, page === 1 ? 0 : 30),
            nextPage: page === 1 ? 2 : null,
          });
        }),
        http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues/1`, () =>
          HttpResponse.json({
            ...largeCandidatePage(1).issues[0],
            description: 'Candidate description',
          } satisfies GithubIssueDetail),
        ),
      );
      const user = userEvent.setup();
      await screen.findByRole('article', { name: 'Candidate 0' });
      if (layout === 'board') await saveKanbanView(user);
      await user.click(screen.getByRole('button', { name: 'Load more candidates' }));
      await screen.findByRole('status', { name: 'Loading more candidates' });
      await user.click(screen.getByRole('button', { name: 'Details for Candidate 0' }));
      const details = await screen.findByRole('dialog', { name: 'Candidate 0' });
      await user.click(within(details).getByRole('button', { name: 'Custom prompt…' }));
      const prompt = await screen.findByRole('textbox', { name: 'Prompt for Candidate 0' });
      await user.type(prompt, 'Keep this guidance while loading more');

      releasePage();
      await waitForMutationsIdle(client);

      expect(details).toBeInTheDocument();
      expect(prompt).toHaveValue('Keep this guidance while loading more');
      expect(prompt).toHaveFocus();
      expect(screen.getAllByTestId('candidate-card').length).toBeLessThan(35);
      expect(screen.queryByRole('button', { name: 'Load more candidates' })).not.toBeInTheDocument();
      fireEvent.scroll(viewport(), { target: { scrollTop: 6000 } });
      await waitFor(() => expect(screen.queryByRole('article', { name: 'Candidate 1' })).not.toBeInTheDocument());
      expect(prompt).toHaveValue('Keep this guidance while loading more');
      expect(screen.getAllByTestId('candidate-card').length).toBeLessThan(35);
      expect(requestedPages).toEqual([1, 2]);

      await act(() => client.refetchQueries({ queryKey: queryKeys.githubIssues(['repo-1']) }));
      expect(requestedPages).toEqual([1, 2, 1, 2]);
      expect(prompt).toBeInTheDocument();
      expect(prompt).toHaveValue('Keep this guidance while loading more');
      expect(screen.getAllByTestId('candidate-card').length).toBeLessThan(35);
    },
  );

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
