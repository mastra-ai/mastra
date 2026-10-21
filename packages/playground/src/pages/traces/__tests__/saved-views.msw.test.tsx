import type { CreateSavedViewParams, SavedViewResponse, UpdateSavedViewParams } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorsView, productionOrStagingView, savedViewsList } from './fixtures/saved-views';
import { legacyTraceCapabilities } from './fixtures/trace-query';
import { registerTracesPageTestHooks, renderTracesPage, setTracePageHandlers } from './traces-page-harness';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const SAVED_VIEWS_URL = `${TEST_BASE_URL}/api/saved-views`;
const COLUMN_STORAGE_KEY = `mastra:traces:columns:${TEST_BASE_URL}:/api`;
const COLUMN_ORDER_STORAGE_KEY = 'mastra:data-list:column-order:all-traces';

const serveSavedViews = (...views: SavedViewResponse[]) =>
  server.use(http.get(SAVED_VIEWS_URL, () => HttpResponse.json(savedViewsList(...views))));

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

function readBody<T>(request: Request): Promise<T> {
  return request.json();
}

/** Serves saves to `view` and returns the spy that records each body sent. */
const capturePatches = (view: SavedViewResponse) => {
  const updated = vi.fn<(body: UpdateSavedViewParams) => void>();
  server.use(
    http.patch(`${SAVED_VIEWS_URL}/${view.id}`, async ({ request }) => {
      const body = await readBody<UpdateSavedViewParams>(request);
      updated(body);
      return HttpResponse.json({ ...view, ...body });
    }),
  );
  return updated;
};

registerTracesPageTestHooks();

beforeEach(() => {
  window.localStorage.clear();
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

    it("puts a view's filters, time range, sort and id in the URL", async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      renderPage();

      fireEvent.click(await viewTab('Errors'));

      await waitFor(() => expect(params().get('view')).toBe('view-errors'));
      expect(params().get('status')).toBe('error');
      expect(params().get('datePreset')).toBe('last-24h');
      expect(params().get('dir')).toBe('asc');
      expect(screen.queryByText('Unsaved changes')).toBeNull();
    });

    it("makes the view's columns and their order the table's", async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      renderPage();

      fireEvent.click(await viewTab('Errors'));

      await waitFor(() =>
        expect(JSON.parse(window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY) ?? '[]')).toEqual(
          errorsView.state.columnOrder,
        ),
      );
      expect(JSON.parse(window.localStorage.getItem(COLUMN_STORAGE_KEY) ?? '{}')).toMatchObject({
        visibleColumns: ['type', 'duration'],
      });
    });
  });

  describe('when the page filters are saved as a new view', () => {
    it('creates the view from them and makes it active', async () => {
      setTracePageHandlers();
      const stored: SavedViewResponse[] = [];
      const created = vi.fn<(body: CreateSavedViewParams) => void>();
      server.use(
        http.get(SAVED_VIEWS_URL, () => HttpResponse.json(savedViewsList(...stored))),
        http.post(SAVED_VIEWS_URL, async ({ request }) => {
          const body = await readBody<CreateSavedViewParams>(request);
          created(body);
          const view: SavedViewResponse = {
            ...errorsView,
            id: 'view-new',
            name: body.name,
            state: body.state,
          };
          stored.push(view);
          return HttpResponse.json(view);
        }),
      );
      renderPage('/traces?status=error&datePreset=last-24h');

      fireEvent.click(await screen.findByRole('button', { name: 'Create new view…' }));
      const input = screen.getByRole('textbox', { name: 'View name' });
      fireEvent.change(input, { target: { value: 'My errors' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => expect(params().get('view')).toBe('view-new'));
      expect(created).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 'traces',
          name: 'My errors',
          state: expect.objectContaining({
            version: 1,
            timeRange: { preset: 'last-24h' },
            filter: { logic: 'and', nodes: [{ fieldId: 'status', operatorId: 'is', value: 'error' }] },
            sort: { field: 'startedAt', direction: 'desc' },
          }),
        }),
      );
      expect((await viewTab('My errors')).getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe("when the active view's filters change", () => {
    it('saves them to the view', async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      const updated = capturePatches(errorsView);
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(params().get('status')).toBe('error'));

      fireEvent.click(await screen.findByRole('button', { name: 'Remove Status filter' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Save to this view' }));

      await waitFor(() => expect(updated).toHaveBeenCalled());
      expect(updated.mock.calls[0]?.[0].state).toMatchObject({
        version: 1,
        timeRange: { preset: 'last-24h' },
        filter: { logic: 'and', nodes: [] },
        sort: { field: 'startedAt', direction: 'asc' },
      });
    });

    it('puts the saved filters back on Reset changes', async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(params().get('status')).toBe('error'));

      fireEvent.click(await screen.findByRole('button', { name: 'Remove Status filter' }));
      await waitFor(() => expect(params().get('status')).toBeNull());
      fireEvent.click(await screen.findByRole('button', { name: 'Reset changes' }));

      await waitFor(() => expect(params().get('status')).toBe('error'));
      expect(screen.queryByText('Unsaved changes')).toBeNull();
    });
  });

  describe('when the page is left while the active view has unsaved changes', () => {
    const leavePage = () => screen.getByRole('button', { name: 'Go to agents' });
    const editErrorsViewAndLeave = async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(params().get('status')).toBe('error'));
      fireEvent.click(await screen.findByRole('button', { name: 'Remove Status filter' }));
      await screen.findByText('Unsaved changes');
      fireEvent.click(leavePage());
      return screen.findByRole('alertdialog', { name: 'Unsaved changes to “Errors”' });
    };

    it('asks first, and stays on the page on Cancel', async () => {
      const dialog = await editErrorsViewAndLeave();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(leavePage().dataset.pathname).toBe('/traces');
      expect(screen.getByText('Unsaved changes')).not.toBeNull();
    });

    it('leaves on Discard changes without saving', async () => {
      const updated = capturePatches(errorsView);
      const dialog = await editErrorsViewAndLeave();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

      await waitFor(() => expect(leavePage().dataset.pathname).toBe('/agents'));
      expect(updated).not.toHaveBeenCalled();
    });

    it('saves the view, then leaves, on Save to this view', async () => {
      const updated = capturePatches(errorsView);
      const dialog = await editErrorsViewAndLeave();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Save to this view' }));

      await waitFor(() => expect(leavePage().dataset.pathname).toBe('/agents'));
      expect(updated.mock.calls[0]?.[0].state).toMatchObject({ filter: { logic: 'and', nodes: [] } });
    });

    it('leaves without asking when nothing changed', async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(params().get('status')).toBe('error'));

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

      renderPage();

      expect(await screen.findByRole('combobox', { name: 'Add filter' })).not.toBeNull();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Create new view…' })).toBeNull());
      expect(screen.queryByRole('group', { name: 'Trace views' })).toBeNull();
    });
  });

  describe('when the server predates saved views', () => {
    it('shows the toolbar without view tabs', async () => {
      setTracePageHandlers();
      server.use(http.get(SAVED_VIEWS_URL, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })));

      renderPage();

      expect(await screen.findByRole('combobox', { name: 'Add filter' })).not.toBeNull();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Create new view…' })).toBeNull());
      expect(screen.queryByRole('group', { name: 'Trace views' })).toBeNull();
    });
  });

  describe("when a view has advanced filters the storage can't run", () => {
    const openOnLegacyStorage = async () => {
      setTracePageHandlers(legacyTraceCapabilities);
      serveSavedViews(productionOrStagingView);
      renderPage();
      fireEvent.click(await viewTab('Prod or staging'));
      await waitFor(() => expect(params().get('status')).toBe('success'));
    };

    it('shows them muted and keeps them on the page, without marking the view changed', async () => {
      await openOnLegacyStorage();

      expect(
        await screen.findByRole('group', { name: 'Advanced filter, 2 conditions, Not supported on this storage' }),
      ).not.toBeNull();
      expect(params().get('filterGroup')).not.toBeNull();
      expect(screen.queryByText('Unsaved changes')).toBeNull();
    });

    it('keeps them when the view is saved after another change', async () => {
      const updated = capturePatches(productionOrStagingView);
      await openOnLegacyStorage();

      fireEvent.click(await screen.findByRole('button', { name: 'Remove Status filter' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Save to this view' }));

      await waitFor(() => expect(updated).toHaveBeenCalled());
      expect(updated.mock.calls[0]?.[0].state).toMatchObject({
        filter: {
          logic: 'and',
          nodes: [
            {
              kind: 'group',
              logic: 'or',
              nodes: [
                { fieldId: 'environment', operatorId: 'is', value: 'production' },
                { fieldId: 'environment', operatorId: 'is', value: 'staging' },
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
      window.localStorage.setItem('mastra:traces:saved-filters', 'status=success');
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(params().get('status')).toBe('error'));

      fireEvent.click(await viewTab('All traces'));

      await waitFor(() => expect(params().get('view')).toBeNull());
      expect(params().get('status')).toBe('success');
      expect(params().get('datePreset')).toBeNull();
      expect(params().get('dir')).toBeNull();
    });
  });

  describe('when the active view is deleted', () => {
    it('asks first, then deletes it and leaves the view', async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      const deleted = vi.fn<() => void>();
      server.use(
        http.delete(`${SAVED_VIEWS_URL}/view-errors`, () => {
          deleted();
          return HttpResponse.json({ message: 'Saved view deleted' });
        }),
      );
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(params().get('view')).toBe('view-errors'));

      fireEvent.contextMenu(await viewTab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete view…' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Delete view' }));

      await waitFor(() => expect(deleted).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(params().get('view')).toBeNull());
      expect(params().get('status')).toBe('error');
    });

    it("doesn't make its filters the ones All traces brings back", async () => {
      setTracePageHandlers();
      serveSavedViews(errorsView);
      server.use(
        http.delete(`${SAVED_VIEWS_URL}/view-errors`, () => HttpResponse.json({ message: 'Saved view deleted' })),
      );
      window.localStorage.setItem('mastra:traces:saved-filters', 'status=success');
      renderPage();
      fireEvent.click(await viewTab('Errors'));
      await waitFor(() => expect(params().get('view')).toBe('view-errors'));

      fireEvent.contextMenu(await viewTab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete view…' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Delete view' }));

      await waitFor(() => expect(params().get('view')).toBeNull());
      expect(window.localStorage.getItem('mastra:traces:saved-filters')).toBe('status=success');
    });
  });
});
