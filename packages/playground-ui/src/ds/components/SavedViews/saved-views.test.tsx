// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { SavedViewEditor } from './saved-view-editor';
import { sameSavedViewState } from './saved-view-schema';
import { SavedViewSummary, SavedViewSummaryFilters, SavedViewSummaryRow } from './saved-view-summary';
import { SavedViewTabs } from './saved-view-tabs';
import { localStorageSavedViewsBackend } from './saved-views-backend';
import type { SavedViewsBackend } from './saved-views-backend';
import { useSavedViews } from './use-saved-views';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@/ds/components/FilterBar/types';

const STORAGE_KEY = 'saved-views-test';
const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const stateSchema = z.object({
  layout: z.enum(['list', 'board']),
  filters: z.array(
    z.object({
      id: z.string(),
      fieldId: z.string(),
      operatorId: z.string(),
      value: z.union([scalarSchema, z.array(scalarSchema)]),
    }),
  ),
});
type Layout = z.infer<typeof stateSchema>['layout'];

const FIELDS: FilterBarField[] = [{ id: 'status', label: 'Status', operators: ['is'] }];
const OPERATORS: FilterBarOperator[] = [{ id: 'is', label: 'is' }];
const ERRORS: FilterBarItem = { id: 'status', fieldId: 'status', operatorId: 'is', value: 'error' };

function Page({ backend = localStorageSavedViewsBackend(STORAGE_KEY) }: { backend?: SavedViewsBackend }) {
  const [activeViewId, setActiveViewId] = useState<string>();
  const [filters, setFilters] = useState<FilterBarItem[]>([]);
  const [layout, setLayout] = useState<Layout>('list');
  const views = useSavedViews({
    backend,
    schema: stateSchema,
    activeViewId,
    current: { filters, layout },
    onApply: view => {
      setActiveViewId(view?.id);
      setFilters(view?.state.filters ?? []);
      setLayout(view?.state.layout ?? 'list');
    },
    onActiveViewChange: setActiveViewId,
  });
  return (
    <>
      <SavedViewTabs
        views={views}
        defaultLabel="All"
        renderSummary={view => (
          <SavedViewSummary>
            <SavedViewSummaryFilters filters={view.state.filters} fields={FIELDS} operators={OPERATORS} />
            <SavedViewSummaryRow label="Layout" value={view.state.layout} />
          </SavedViewSummary>
        )}
      />
      <SavedViewEditor views={views}>
        <button type="button" onClick={() => setFilters([ERRORS])}>
          Filter errors
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters([]);
            setLayout('board');
          }}
        >
          Board without filters
        </button>
      </SavedViewEditor>
      <output data-testid="page">{JSON.stringify({ filters, layout })}</output>
    </>
  );
}

function renderPage(backend?: SavedViewsBackend) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Page backend={backend} />
    </QueryClientProvider>,
  );
}

function storedDocument(): unknown {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
}
const page = () => JSON.parse(screen.getByTestId('page').textContent ?? '');
const tabs = () => screen.getByRole('group', { name: 'Views' });
const tab = (name: string) => within(tabs()).getByRole('button', { name });
const findTab = (name: string) => within(tabs()).findByRole('button', { name });

async function createView(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Create new view…' }));
  const input = screen.getByRole('textbox', { name: 'View name' });
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await findTab(name);
}

function seedViews(views: unknown[], version = 2) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version, views }));
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('sameSavedViewState', () => {
  it('ignores the order a database returned object keys in', () => {
    expect(
      sameSavedViewState(
        { a: 1, nested: { x: 1, y: [1, 2] }, layout: 'list', sort: 'asc' },
        { sort: 'asc', nested: { y: [1, 2], x: 1 }, layout: 'list', a: 1 },
      ),
    ).toBe(true);
  });

  it('still tells arrays in another order apart', () => {
    expect(sameSavedViewState({ order: [1, 2] }, { order: [2, 1] })).toBe(false);
  });
});

describe('localStorageSavedViewsBackend', () => {
  describe('when the browser holds views from the first version of the kit', () => {
    it('reads their filters and settings back as one state', async () => {
      seedViews([{ id: 'a', name: 'Errors', filters: [ERRORS], settings: { layout: 'board' } }], 1);

      const views = await localStorageSavedViewsBackend(STORAGE_KEY).list();

      expect(views).toEqual([{ id: 'a', name: 'Errors', state: { filters: [ERRORS], layout: 'board' } }]);
    });
  });

  describe('when storage holds corrupt JSON or an unknown version', () => {
    it('lists nothing', async () => {
      localStorage.setItem(STORAGE_KEY, '{not json');
      expect(await localStorageSavedViewsBackend(STORAGE_KEY).list()).toEqual([]);
      seedViews([{ id: 'a', name: 'A', state: {} }], 3);
      expect(await localStorageSavedViewsBackend(STORAGE_KEY).list()).toEqual([]);
    });
  });

  describe('when a view no longer matches the page schemas', () => {
    it('keeps it in storage when another view is written', async () => {
      seedViews([{ id: 'old', name: 'Old', state: { filters: 'bad', layout: 'grid' } }]);

      await localStorageSavedViewsBackend(STORAGE_KEY).create({ name: 'New', state: {} });

      expect(storedDocument()).toMatchObject({ version: 2, views: [{ id: 'old' }, { name: 'New' }] });
    });
  });

  describe('when browser storage is full', () => {
    it('rejects with a message for people', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage full', 'QuotaExceededError');
      });

      await expect(localStorageSavedViewsBackend(STORAGE_KEY).create({ name: 'New', state: {} })).rejects.toThrow(
        'Could not save changes. Check your browser storage settings and try again.',
      );
    });
  });
});

describe('SavedViews', () => {
  describe('when the page has filters and no view is active', () => {
    it('saves them as a new view that comes back after a reload', async () => {
      const first = renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      await createView('Errors');

      expect(storedDocument()).toMatchObject({
        version: 2,
        views: [{ name: 'Errors', state: { filters: [ERRORS], layout: 'list' } }],
      });
      expect(tab('Errors').getAttribute('aria-pressed')).toBe('true');
      expect(screen.queryByText('Unsaved changes')).toBeNull();

      first.unmount();
      renderPage();
      fireEvent.click(await findTab('Errors'));
      expect(page()).toEqual({ filters: [ERRORS], layout: 'list' });
    });

    it('cancels a new view on Escape', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Create new view…' }));
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'View name' }), { key: 'Escape' });

      expect(screen.queryByRole('textbox', { name: 'View name' })).toBeNull();
      expect(await localStorageSavedViewsBackend(STORAGE_KEY).list()).toEqual([]);
    });
  });

  describe('when the page changes while a view is active', () => {
    it('marks the change and resets the page to the saved view', async () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      await createView('Errors');

      fireEvent.click(screen.getByRole('button', { name: 'Board without filters' }));
      expect(screen.getByText('Unsaved changes')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Reset changes' }));

      expect(page()).toEqual({ filters: [ERRORS], layout: 'list' });
      expect(screen.queryByText('Unsaved changes')).toBeNull();
    });

    it('saves the change to the view', async () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      await createView('Errors');

      fireEvent.click(screen.getByRole('button', { name: 'Board without filters' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save to this view' }));

      await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
      expect(storedDocument()).toMatchObject({ views: [{ state: { filters: [], layout: 'board' } }] });
    });

    it('offers the same save from the active view menu', async () => {
      renderPage();
      await createView('Errors');
      fireEvent.click(screen.getByRole('button', { name: 'Board without filters' }));

      fireEvent.click(tab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Save to this view' }));

      await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
      expect(storedDocument()).toMatchObject({ views: [{ state: { layout: 'board' } }] });
    });
  });

  describe('when another tab is picked while the active view has unsaved changes', () => {
    const unsavedDialog = () => screen.findByRole('alertdialog', { name: 'Unsaved changes to “Errors”' });
    const editErrorsView = async () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      await createView('Errors');
      fireEvent.click(screen.getByRole('button', { name: 'Board without filters' }));
      fireEvent.click(tab('All'));
      return unsavedDialog();
    };

    it('asks first, and stays on the view with its changes on Cancel', async () => {
      const dialog = await editErrorsView();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(tab('Errors').getAttribute('aria-pressed')).toBe('true');
      expect(page()).toEqual({ filters: [], layout: 'board' });
    });

    it('drops the changes and switches on Discard changes', async () => {
      const dialog = await editErrorsView();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

      await waitFor(() => expect(tab('All').getAttribute('aria-pressed')).toBe('true'));
      expect(page()).toEqual({ filters: [], layout: 'list' });
      expect(storedDocument()).toMatchObject({ views: [{ state: { filters: [ERRORS], layout: 'list' } }] });
    });

    it('saves the changes to the view, then switches, on Save to this view', async () => {
      const dialog = await editErrorsView();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Save to this view' }));

      await waitFor(() => expect(tab('All').getAttribute('aria-pressed')).toBe('true'));
      expect(storedDocument()).toMatchObject({ views: [{ state: { filters: [], layout: 'board' } }] });
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('switches without asking when nothing changed', async () => {
      renderPage();
      await createView('Errors');

      fireEvent.click(tab('All'));

      expect(tab('All').getAttribute('aria-pressed')).toBe('true');
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  describe('when another view is hovered', () => {
    it('previews its filters and settings as the view holds them', async () => {
      seedViews([{ id: 'a', name: 'Board errors', state: { filters: [ERRORS], layout: 'board' } }]);
      renderPage();

      const boardErrors = await findTab('Board errors');
      fireEvent.mouseEnter(boardErrors);
      fireEvent.mouseMove(boardErrors);

      expect(await screen.findByText('Status', undefined, { timeout: 2000 })).toBeTruthy();
      expect(screen.getByText('board')).toBeTruthy();
      expect(screen.queryByText('list')).toBeNull();
    });
  });

  describe('when a view is renamed', () => {
    it('restores the name on Escape and keeps it on Enter', async () => {
      renderPage();
      await createView('Errors');

      fireEvent.contextMenu(tab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
      let input = screen.getByRole('textbox', { name: 'View name' });
      fireEvent.change(input, { target: { value: 'Ignored' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(await findTab('Errors')).toBeTruthy();

      fireEvent.contextMenu(tab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
      input = screen.getByRole('textbox', { name: 'View name' });
      fireEvent.change(input, { target: { value: 'Failures' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(await findTab('Failures')).toBeTruthy();
      expect(storedDocument()).toMatchObject({ views: [{ name: 'Failures' }] });
    });
  });

  describe('when a view is duplicated', () => {
    it('shows the copy', async () => {
      seedViews([{ id: 'a', name: 'Errors', state: { filters: [ERRORS], layout: 'board' } }]);
      renderPage();

      fireEvent.contextMenu(await findTab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));

      expect((await findTab('Errors copy')).getAttribute('aria-pressed')).toBe('true');
      expect(page()).toEqual({ filters: [ERRORS], layout: 'board' });
    });
  });

  describe('when the active view is deleted', () => {
    it('asks first, then falls back to the default tab without changing the page', async () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      await createView('Errors');

      fireEvent.contextMenu(tab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete view…' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(tab('Errors')).toBeTruthy();

      fireEvent.contextMenu(tab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete view…' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Delete view' }));

      await waitFor(() => expect(within(tabs()).queryByRole('button', { name: 'Errors' })).toBeNull());
      expect(tab('All').getAttribute('aria-pressed')).toBe('true');
      expect(page()).toEqual({ filters: [ERRORS], layout: 'list' });
    });
  });

  describe('when the backend rejects a save', () => {
    it('shows its message and keeps the page as it was', async () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage full', 'QuotaExceededError');
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Create new view…' }));
      const input = screen.getByRole('textbox', { name: 'View name' });
      fireEvent.change(input, { target: { value: 'Errors' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect((await screen.findByRole('alert')).textContent).toContain('Could not save changes');
      expect(tab('All').getAttribute('aria-pressed')).toBe('true');
      expect(page()).toEqual({ filters: [ERRORS], layout: 'list' });
    });
  });

  describe('when the backend cannot list views', () => {
    it('says so and still shows the default tab', async () => {
      const backend: SavedViewsBackend = {
        queryKey: ['saved-views', 'failing'],
        list: () => Promise.reject(new Error('Not implemented')),
        create: () => Promise.reject(new Error('unused')),
        update: () => Promise.reject(new Error('unused')),
        remove: () => Promise.reject(new Error('unused')),
      };
      renderPage(backend);

      expect((await screen.findByRole('alert')).textContent).toBe('Could not load views.');
      expect(tab('All').getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('when another tab writes views', () => {
    it('follows them', async () => {
      renderPage();
      await screen.findByRole('button', { name: 'Create new view…' });

      act(() => {
        seedViews([{ id: 'v', name: 'Shared', state: { filters: [], layout: 'list' } }]);
        window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
      });

      expect((await findTab('Shared')).textContent).toBe('Shared');
    });
  });

  describe('when a tab becomes the active view', () => {
    it('keeps focus on it', async () => {
      seedViews([{ id: 'a', name: 'Errors', state: { filters: [ERRORS], layout: 'list' } }]);
      renderPage();

      const errors = await findTab('Errors');
      errors.focus();
      fireEvent.click(errors);

      expect(errors.getAttribute('aria-pressed')).toBe('true');
      expect(document.activeElement).toBe(errors);
    });
  });
});
