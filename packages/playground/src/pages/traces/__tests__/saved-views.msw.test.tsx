import type { CreateSavedViewParams, SavedViewResponse, UpdateSavedViewParams } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation, useNavigate } from 'react-router';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorsView, productionOrStagingView, savedViewsList } from './fixtures/saved-views';
import { legacyTraceCapabilities } from './fixtures/trace-query';
import { renderTracesPage, setTracePageHandlers } from './traces-page-harness';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const SAVED_VIEWS_URL = `${TEST_BASE_URL}/api/saved-views`;
const COLUMN_STORAGE_KEY = `mastra:traces:columns:${TEST_BASE_URL}:/api`;
const COLUMN_ORDER_STORAGE_KEY = 'mastra:data-list:column-order:all-traces';
const SAVED_FILTERS_STORAGE_KEY = 'mastra:traces:saved-filters';

/** Serves `views` like the server does: a save changes what the list returns next. Returns the spy recording each save. */
const serveSavedViews = (...initial: SavedViewResponse[]) => {
  const views = [...initial];
  const updated = vi.fn<(body: UpdateSavedViewParams) => void>();
  server.use(
    http.get(SAVED_VIEWS_URL, () => HttpResponse.json(savedViewsList(...views))),
    http.patch(`${SAVED_VIEWS_URL}/:savedViewId`, async ({ params, request }) => {
      const body = await readBody<UpdateSavedViewParams>(request);
      const index = views.findIndex(view => view.id === params.savedViewId);
      const view = views[index];
      if (!view) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      updated(body);
      views[index] = { ...view, ...body };
      return HttpResponse.json(views[index]);
    }),
  );
  return { updated };
};

/** Stands in for the sidebar: a link off the traces page, and where the page is now. */
const LeavePageProbe = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <button type="button" data-pathname={pathname} onClick={() => navigate('/agents')}>
      Go to agents
    </button>
  );
};

const renderPage = (initialEntry = '/traces') => renderTracesPage(initialEntry, {}, <LeavePageProbe />);

const params = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');
const viewTabs = () => screen.findByRole('group', { name: 'Trace views' });
const viewTab = async (name: string) => within(await viewTabs()).findByRole('button', { name });
const chipTexts = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]'), chip => chip.textContent)
    // The first chip is the time range.
    .slice(1);
const tableHeader = () => document.querySelector('.data-list-top')?.textContent ?? '';
const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' });

function readBody<T>(request: Request): Promise<T> {
  return request.json();
}

/** Opens the Errors view, then removes its Status chip. */
const editErrorsView = async () => {
  setTracePageHandlers();
  const { updated } = serveSavedViews(errorsView);
  renderPage();
  fireEvent.click(await viewTab('Errors'));
  fireEvent.click(await screen.findByRole('button', { name: 'Remove Status filter' }));
  await screen.findByText('Unsaved changes');
  return { updated };
};

beforeEach(() => {
  window.localStorage.clear();
});

// `TracesListView` dispatches a synthetic `scroll` event on its scroll container to make the
// virtualizer re-read `scrollTop` once a query settles. The virtualizer answers scroll events
// through a trailing debounce of `isScrollingResetDelay` (150ms) that its `cleanup()` never
// cancels, so a test that finishes right after a render leaves that timer pending. Vitest tears
// the jsdom environment down when the file ends, and the timer then fires with the `window`
// global already gone — an unhandled `ReferenceError: window is not defined` that fails the
// whole run. Let the debounce expire while the environment is still alive.
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
});

describe('Traces page saved views', () => {
  describe('when the server has saved views', () => {
    it('shows them as tabs after All traces', async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView, productionOrStagingView);

      renderPage();

      const tabs = within(await viewTabs());
      expect(tabs.getByRole('button', { name: 'All traces' }).getAttribute('aria-pressed')).toBe('true');
      expect(await tabs.findByRole('button', { name: 'Errors' })).not.toBeNull();
      expect(tabs.getByRole('button', { name: 'Prod or staging' })).not.toBeNull();
    });

    it("shows a view's filters and sort, with only its id in the URL", async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      const onQuery = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
          onQuery(await request.json());
          return HttpResponse.json({ spans: [], pagination: { total: 0, page: 0, perPage: 25, hasMore: false } });
        }),
      );
      renderPage();

      fireEvent.click(await viewTab('Errors'));

      await waitFor(() => expect(chipTexts()).toEqual(['StatusisError']));
      await waitFor(() =>
        expect(JSON.stringify(onQuery.mock.calls.at(-1)?.[0])).toContain(
          '"orderBy":[{"field":"startedAt","direction":"asc"}]',
        ),
      );
      expect([...params().keys()]).toEqual(['view']);
      expect(params().get('view')).toBe('view-errors');
      expect(screen.queryByText('Unsaved changes')).toBeNull();
    });

    it("makes the view's columns the table's without touching the user's own", async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      renderPage();
      await waitFor(() => expect(tableHeader()).toContain('Input'));
      const ownColumns = window.localStorage.getItem(COLUMN_STORAGE_KEY);
      const ownOrder = window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);

      fireEvent.click(await viewTab('Errors'));

      await waitFor(() => expect(tableHeader()).not.toContain('Input'));
      expect(tableHeader()).toContain('Duration');
      expect(window.localStorage.getItem(COLUMN_STORAGE_KEY)).toBe(ownColumns);
      expect(window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)).toBe(ownOrder);
    });
  });

  describe('when a new view is made', () => {
    it('starts without filters, then saves the chips added to it as the active view', async () => {
      setTracePageHandlers();
      const stored: SavedViewResponse[] = [];
      const created = vi.fn<(body: CreateSavedViewParams) => void>();
      server.use(
        http.get(SAVED_VIEWS_URL, () => HttpResponse.json(savedViewsList(...stored))),
        http.post(SAVED_VIEWS_URL, async ({ request }) => {
          const body = await readBody<CreateSavedViewParams>(request);
          created(body);
          const view: SavedViewResponse = { ...errorsView, id: 'view-new', name: body.name, state: body.state };
          stored.push(view);
          return HttpResponse.json(view);
        }),
      );
      renderPage('/traces?status=success&datePreset=last-24h');
      await waitFor(() => expect(chipTexts()).toEqual(['StatusisSuccess']));

      fireEvent.click(await screen.findByRole('button', { name: 'New view' }));
      await waitFor(() => expect(chipTexts()).toEqual([]));
      act(() => getFilterInput().focus());
      fireEvent.change(getFilterInput(), { target: { value: 'Status' } });
      await screen.findByRole('option', { name: 'Status' });
      fireEvent.keyDown(getFilterInput(), { key: 'Enter' });
      await screen.findByRole('option', { name: 'is' });
      fireEvent.keyDown(getFilterInput(), { key: 'Enter' });
      fireEvent.click(await screen.findByRole('option', { name: 'Error' }));
      await waitFor(() => expect(chipTexts()).toEqual(['StatusisError']));
      fireEvent.keyDown(getFilterInput(), { key: 'Escape' });
      fireEvent.click(screen.getByRole('button', { name: 'Save view' }));

      await waitFor(() => expect(params().get('view')).toBe('view-new'));
      expect(created).toHaveBeenCalledWith({
        page: 'traces',
        name: 'Untitled view',
        state: {
          version: 1,
          filters: [{ id: 'status', fieldId: 'status', operatorId: 'is', value: 'error' }],
          settings: expect.objectContaining({ datePreset: 'last-24h', groups: [], sortDirection: 'desc' }),
        },
      });
      expect((await viewTab('Untitled view')).getAttribute('aria-pressed')).toBe('true');
      expect(params().get('status')).toBe('success');
    });
  });

  describe("when the active view's filters change", () => {
    it('saves them to the view on Save changes', async () => {
      const { updated } = await editErrorsView();

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(updated).toHaveBeenCalled());
      expect(updated.mock.calls[0]?.[0]).toMatchObject({
        name: 'Errors',
        state: { version: 1, filters: [], settings: { datePreset: 'last-24h', sortDirection: 'asc' } },
      });
      await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
      expect(chipTexts()).toEqual([]);
    });

    it('puts the saved filters back on Reset', async () => {
      await editErrorsView();

      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

      await waitFor(() => expect(chipTexts()).toEqual(['StatusisError']));
      expect(screen.queryByText('Unsaved changes')).toBeNull();
    });

    it('keeps the changes and says so when the save fails', async () => {
      await editErrorsView();
      server.use(
        http.patch(`${SAVED_VIEWS_URL}/${errorsView.id}`, () =>
          HttpResponse.json({ error: 'Storage is down' }, { status: 500 }),
        ),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      expect((await screen.findByRole('alert')).textContent).toBe('Could not save changes. Try again.');
      expect(screen.getByText('Unsaved changes')).not.toBeNull();
      expect(chipTexts()).toEqual([]);
    });

    it('asks before switching to another tab', async () => {
      await editErrorsView();

      fireEvent.click(await viewTab('All traces'));
      const dialog = await screen.findByRole('alertdialog', { name: 'Unsaved changes to “Errors”' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(params().get('view')).toBe('view-errors');
      expect(screen.getByText('Unsaved changes')).not.toBeNull();
    });
  });

  describe('when the page is left while the active view has unsaved changes', () => {
    const leavePage = () => screen.getByRole('button', { name: 'Go to agents' });
    const editErrorsViewAndLeave = async () => {
      const { updated } = await editErrorsView();
      fireEvent.click(leavePage());
      const dialog = await screen.findByRole('alertdialog', { name: 'Unsaved changes to “Errors”' });
      return { dialog, updated };
    };

    it('asks first, and stays on the page on Cancel', async () => {
      const { dialog } = await editErrorsViewAndLeave();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(leavePage().dataset.pathname).toBe('/traces');
      expect(screen.getByText('Unsaved changes')).not.toBeNull();
    });

    it('leaves on Discard changes without saving', async () => {
      const { dialog, updated } = await editErrorsViewAndLeave();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

      await waitFor(() => expect(leavePage().dataset.pathname).toBe('/agents'));
      expect(updated).not.toHaveBeenCalled();
    });

    it('saves the view, then leaves, on Save changes', async () => {
      const { dialog, updated } = await editErrorsViewAndLeave();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(leavePage().dataset.pathname).toBe('/agents'));
      expect(updated.mock.calls[0]?.[0].state).toMatchObject({ filters: [] });
    });

    it('leaves without asking when nothing changed', async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(chipTexts()).toEqual(['StatusisError']));

      fireEvent.click(leavePage());

      await waitFor(() => expect(leavePage().dataset.pathname).toBe('/agents'));
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  describe("when the server's storage has no saved views", () => {
    it('shows the toolbar without view tabs', async () => {
      setTracePageHandlers();
      server.use(
        http.get(SAVED_VIEWS_URL, () =>
          HttpResponse.json({ error: 'Saved views are not supported by this storage' }, { status: 501 }),
        ),
      );

      const { queryClient } = renderPage();

      expect(await screen.findByRole('combobox', { name: 'Add filter' })).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole('group', { name: 'Trace views' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'New view' })).toBeNull();
    });
  });

  describe('when the server predates saved views', () => {
    it('shows the toolbar without view tabs', async () => {
      setTracePageHandlers();
      server.use(http.get(SAVED_VIEWS_URL, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })));

      const { queryClient } = renderPage();

      expect(await screen.findByRole('combobox', { name: 'Add filter' })).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.queryByRole('group', { name: 'Trace views' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'New view' })).toBeNull();
    });
  });

  describe('when the page is scoped to an agent', () => {
    it('shows no view tabs and never asks for saved views', async () => {
      setTracePageHandlers();
      const onList = vi.fn<() => void>();
      server.use(
        http.get(SAVED_VIEWS_URL, () => {
          onList();
          return HttpResponse.json(savedViewsList(errorsView));
        }),
      );

      const { queryClient } = renderTracesPage('/agents/agent-a/traces', {
        scopedEntityId: 'agent-a',
        scopedEntityType: EntityType.AGENT,
      });

      expect(await screen.findByRole('combobox', { name: 'Add filter' })).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(onList).not.toHaveBeenCalled();
      expect(screen.queryByRole('group', { name: 'Trace views' })).toBeNull();
    });
  });

  describe("when a view has advanced filters the storage can't run", () => {
    const openOnLegacyStorage = async () => {
      setTracePageHandlers(legacyTraceCapabilities);
      const { updated } = serveSavedViews(productionOrStagingView);
      renderPage();
      fireEvent.click(await viewTab('Prod or staging'));
      return { updated };
    };

    it('shows them muted, without marking the view changed', async () => {
      await openOnLegacyStorage();

      expect(
        await screen.findByRole('group', { name: 'Advanced filter, 2 conditions, Not supported on this storage' }),
      ).not.toBeNull();
      expect(screen.queryByText('Unsaved changes')).toBeNull();
    });

    it('keeps them when the view is saved after another change', async () => {
      const { updated } = await openOnLegacyStorage();

      fireEvent.click(await screen.findByRole('button', { name: 'Remove Status filter' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(updated).toHaveBeenCalled());
      expect(updated.mock.calls[0]?.[0].state).toMatchObject({
        filters: [],
        settings: {
          groups: [
            {
              logic: 'or',
              nodes: [
                { fieldId: 'environment', value: 'production' },
                { fieldId: 'environment', value: 'staging' },
              ],
            },
          ],
        },
      });
    });
  });

  describe('when All traces is chosen after a view', () => {
    it('brings back the filters last chosen without a view', async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      window.localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, 'status=success');
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(chipTexts()).toEqual(['StatusisError']));

      fireEvent.click(await viewTab('All traces'));

      await waitFor(() => expect(params().get('view')).toBeNull());
      expect(params().get('status')).toBe('success');
      await waitFor(() => expect(chipTexts()).toEqual(['StatusisSuccess']));
    });
  });

  describe('when the active view is deleted', () => {
    it('asks first, then deletes it and falls back to All traces', async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      const deleted = vi.fn<() => void>();
      server.use(
        http.delete(`${SAVED_VIEWS_URL}/view-errors`, () => {
          deleted();
          return HttpResponse.json({ message: 'Saved view deleted' });
        }),
      );
      window.localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, 'status=success');
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(params().get('view')).toBe('view-errors'));

      fireEvent.contextMenu(await viewTab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete view…' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Delete view?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete view' }));

      await waitFor(() => expect(deleted).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(params().get('view')).toBeNull());
      expect(params().get('status')).toBe('success');
      expect(window.localStorage.getItem(SAVED_FILTERS_STORAGE_KEY)).toBe('status=success');
    });
  });
});
