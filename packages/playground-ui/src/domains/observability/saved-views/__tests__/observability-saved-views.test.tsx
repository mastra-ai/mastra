// @vitest-environment jsdom
import type { SavedViewPage, SavedViewState } from '@mastra/core/storage';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { logsView, pages, spansView, tracesView } from '../../__tests__/fixtures/saved-view-pages';
import { applySavedView, savedViewFromSearchParams } from '../../saved-view-state';
import { ObservabilitySavedViews } from '../observability-saved-views';
import { SavedViewsProvider } from '../saved-views-provider';
import { SAVED_VIEW_TOO_LARGE_MESSAGE } from '../use-hosted-saved-views';
import { createInMemorySavedViewsSource } from './fixtures/in-memory-source';
import type { InMemorySavedViewsSource } from './fixtures/in-memory-source';
import { LogsSavedViews } from '@/domains/logs/components/logs-saved-views';
import { useTraceColumnPreferences } from '@/domains/traces/hooks/use-trace-column-preferences';
import { applyTracePropertyFilterTokens } from '@/domains/traces/trace-filters';
import { renderWithProviders } from '@/test/render';
import { SearchParamsHost } from '@/test/search-params-host';

/** The bar as a page mounts it, with the traces column picker when the page has columns. */
function Page({ page, initial, withColumns }: { page: SavedViewPage; initial: string; withColumns: boolean }) {
  const columns = useTraceColumnPreferences();
  return (
    <SearchParamsHost initial={initial}>
      {urlState => (
        <>
          <ObservabilitySavedViews page={page} {...urlState} columns={withColumns ? columns : undefined} />
          <button
            type="button"
            onClick={() =>
              // What adding the filter in the filter bar writes.
              urlState.setSearchParams(previous => {
                const current = savedViewFromSearchParams(page, previous);
                const filters = [...current.filters, { fieldId: 'status', value: 'error' }];
                return applySavedView({ ...current, filters }, previous).params;
              })
            }
          >
            Filter errors
          </button>
          <output data-testid="columns">{JSON.stringify(columns.preferences)}</output>
        </>
      )}
    </SearchParamsHost>
  );
}

const renderBar = ({
  page,
  initial,
  source,
  withColumns = false,
}: {
  page: SavedViewPage;
  initial: string;
  source: InMemorySavedViewsSource;
  withColumns?: boolean;
}) =>
  renderWithProviders(
    <SavedViewsProvider source={source} queryKeyScope={['project', 'p1']}>
      <Page page={page} initial={initial} withColumns={withColumns} />
    </SavedViewsProvider>,
  );

const url = () => screen.getByTestId('search-params').textContent ?? '';
const columnsReadout = () => JSON.parse(screen.getByTestId('columns').textContent ?? '{}');
const tabs = () => within(screen.getByRole('group', { name: 'Saved views' }));
const tab = (name: string) => tabs().getByRole('button', { name });
const pressed = (name: string) => tab(name).getAttribute('aria-pressed') === 'true';

const nameNewView = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'New view' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rename view' }));
  const input = screen.getByRole('textbox', { name: 'View name' });
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

const openViewMenu = async (name: string) => {
  fireEvent.contextMenu(tab(name));
  return screen.findByRole('menu');
};

describe('ObservabilitySavedViews', () => {
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders nothing without a SavedViewsProvider', () => {
    renderWithProviders(
      <SearchParamsHost initial="">
        {urlState => <ObservabilitySavedViews page="traces" {...urlState} />}
      </SearchParamsHost>,
    );
    expect(screen.queryByRole('group', { name: 'Saved views' })).toBeNull();
  });

  it('LogsSavedViews lists only the logs views', async () => {
    const source = createInMemorySavedViewsSource([
      { name: 'Errors', state: logsView },
      { name: 'Slow spans', state: spansView },
    ]);
    renderWithProviders(
      <SavedViewsProvider source={source} queryKeyScope={['test']}>
        <SearchParamsHost initial="">{urlState => <LogsSavedViews {...urlState} />}</SearchParamsHost>
      </SavedViewsProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Errors' })).toBeTruthy();
    expect(tab('All logs')).toBeTruthy();
    expect(tabs().queryByRole('button', { name: 'Slow spans' })).toBeNull();
  });

  describe.each(pages)('on the $page page', ({ page, url: urlByHand, base, view, ...rest }) => {
    const withColumns = 'columns' in rest;

    it('saves the current URL as the view the page would build from it', async () => {
      const source = createInMemorySavedViewsSource();
      renderBar({ page, initial: urlByHand().toString(), source, withColumns });
      await screen.findByRole('group', { name: 'Saved views' });

      nameNewView('Mine');
      fireEvent.click(screen.getByRole('button', { name: 'Save view' }));

      await waitFor(() => expect(source.records()).toHaveLength(1));
      const expected = savedViewFromSearchParams(page, urlByHand(), {
        columns: withColumns ? columnsReadout() : undefined,
      });
      expect(source.records()[0]).toMatchObject({ name: 'Mine', state: expected });
      await waitFor(() => expect(pressed('Mine')).toBe(true));
      expect(screen.queryByRole('button', { name: 'Save view' })).toBeNull();
    });

    it('applying a view gives the URL the user gets by setting it by hand', async () => {
      const source = createInMemorySavedViewsSource([{ name: 'Mine', state: view }]);
      renderBar({ page, initial: base, source, withColumns });

      fireEvent.click(await screen.findByRole('button', { name: 'Mine' }));

      await waitFor(() => expect(url()).toBe(urlByHand().toString()));
      expect(pressed('Mine')).toBe(true);
      if (withColumns) expect(columnsReadout()).toEqual(applySavedView(view, new URLSearchParams()).columns);
      // The URL matches the view, so it has nothing to save.
      expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    });

    it('after a reload, the view matching the URL is the active tab', async () => {
      const source = createInMemorySavedViewsSource([{ name: 'Mine', state: view }]);
      const first = renderBar({ page, initial: base, source, withColumns });
      fireEvent.click(await screen.findByRole('button', { name: 'Mine' }));
      await waitFor(() => expect(url()).toBe(urlByHand().toString()));
      first.unmount();

      // Columns persist on their own; the URL comes back from the address bar.
      renderBar({ page, initial: urlByHand().toString(), source, withColumns });

      await waitFor(() => expect(pressed('Mine')).toBe(true));
    });
  });

  it('applies the valid parts of a stale view and drops the rest', async () => {
    const stale: SavedViewState = {
      schemaVersion: 1,
      page: 'traces',
      filters: [
        { fieldId: 'status', value: 'error' },
        { fieldId: 'removedField', value: 'x' },
        { fieldId: 'entityName', value: 'Weather Agent', operatorId: 'removedOperator' },
      ],
      sort: { field: 'removedSortField', direction: 'asc' },
      columns: [
        { id: 'input', visible: true },
        { id: 'removedColumn', visible: true },
      ],
    };
    const source = createInMemorySavedViewsSource([{ name: 'Old', state: stale }]);
    renderBar({ page: 'traces', initial: '', source, withColumns: true });

    fireEvent.click(await screen.findByRole('button', { name: 'Old' }));

    const byHand = new URLSearchParams();
    applyTracePropertyFilterTokens(byHand, [{ fieldId: 'status', value: 'error' }]);
    await waitFor(() => expect(url()).toBe(byHand.toString()));
    expect(columnsReadout().visibleColumns).toContain('input');
    expect(columnsReadout().visibleColumns).not.toContain('removedColumn');
  });

  it('applies a fixed date range as saved', async () => {
    const source = createInMemorySavedViewsSource([{ name: 'Incident', state: tracesView }]);
    renderBar({ page: 'traces', initial: '', source, withColumns: true });

    fireEvent.click(await screen.findByRole('button', { name: 'Incident' }));

    await waitFor(() => {
      const params = new URLSearchParams(url());
      expect(params.get('datePreset')).toBe('custom');
      expect(params.get('dateFrom')).toBe('2026-10-01T00:00:00.000Z');
      expect(params.get('dateTo')).toBe('2026-10-02T12:30:00.000Z');
    });
  });

  describe('changing views', () => {
    const empty: SavedViewState = { schemaVersion: 1, page: 'spans', filters: [] };
    const setup = async () => {
      const source = createInMemorySavedViewsSource([
        { name: 'Errors', state: { ...empty, filters: [{ fieldId: 'status', value: 'error' }] } },
        { name: 'Slow', state: { ...empty, filters: [{ fieldId: 'durationMs', value: '1000', operatorId: 'gt' }] } },
      ]);
      renderBar({ page: 'spans', initial: '', source });
      await screen.findByRole('button', { name: 'Errors' });
      return source;
    };

    it('saves changes to the active view', async () => {
      const source = await setup();
      fireEvent.click(tab('Slow'));
      await waitFor(() => expect(pressed('Slow')).toBe(true));

      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(source.calls.some(call => call.method === 'update')).toBe(true));
      const slow = source.records().find(record => record.name === 'Slow');
      expect(slow?.state).toEqual(savedViewFromSearchParams('spans', new URLSearchParams(url())));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull());
      expect(pressed('Slow')).toBe(true);
    });

    it('resets the active view to what was saved', async () => {
      await setup();
      fireEvent.click(tab('Slow'));
      await waitFor(() => expect(pressed('Slow')).toBe(true));
      const saved = url();

      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Reset' }));

      await waitFor(() => expect(url()).toBe(saved));
    });

    it('renames a view', async () => {
      const source = await setup();
      fireEvent.click(within(await openViewMenu('Errors')).getByRole('menuitem', { name: 'Rename' }));
      const input = screen.getByRole('textbox', { name: 'View name' });
      fireEvent.change(input, { target: { value: 'All errors' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(await screen.findByRole('button', { name: 'All errors' })).toBeTruthy();
      expect(source.records().map(record => record.name)).toContain('All errors');
    });

    it('duplicates a view and applies the copy', async () => {
      const source = await setup();
      fireEvent.click(within(await openViewMenu('Errors')).getByRole('menuitem', { name: 'Duplicate' }));

      await waitFor(() => expect(pressed('Errors copy')).toBe(true));
      const copy = source.records().find(record => record.name === 'Errors copy');
      expect(copy?.state).toEqual(source.records().find(record => record.name === 'Errors')?.state);
      expect(new URLSearchParams(url()).toString()).not.toBe('');
    });

    it('deleting the active view goes back to the default tab', async () => {
      const source = await setup();
      fireEvent.click(tab('Errors'));
      await waitFor(() => expect(pressed('Errors')).toBe(true));

      fireEvent.click(within(await openViewMenu('Errors')).getByRole('menuitem', { name: 'Delete view' }));

      await waitFor(() => expect(tabs().queryByRole('button', { name: 'Errors' })).toBeNull());
      expect(pressed('All spans')).toBe(true);
      expect(source.records().map(record => record.name)).toEqual(['Slow']);
    });

    it('shows a name clash on create and keeps the draft', async () => {
      const source = await setup();
      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      nameNewView('errors');
      fireEvent.click(screen.getByRole('button', { name: 'Save view' }));

      expect((await screen.findByRole('alert')).textContent).toBe('A view named "errors" already exists.');
      expect(screen.getByRole('button', { name: 'Save view' })).toBeTruthy();
      expect(source.records()).toHaveLength(2);
      expect(url()).not.toBe('');
    });

    it('shows a name clash on rename and keeps the old name', async () => {
      await setup();
      fireEvent.click(within(await openViewMenu('Slow')).getByRole('menuitem', { name: 'Rename' }));
      const input = screen.getByRole('textbox', { name: 'View name' });
      fireEvent.change(input, { target: { value: 'Errors' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect((await screen.findByRole('alert')).textContent).toBe('A view named "Errors" already exists.');
      expect(tab('Slow')).toBeTruthy();
    });

    it('shows a failed save and keeps the draft', async () => {
      const source = await setup();
      source.create = async () => {
        throw new Error('network down');
      };
      nameNewView('Mine');
      fireEvent.click(screen.getByRole('button', { name: 'Save view' }));

      expect((await screen.findByRole('alert')).textContent).toBe('Could not save the view. Try again.');
      expect(screen.getByRole('button', { name: 'Save view' })).toBeTruthy();
    });
  });

  it('does not send a view over 16 KiB', async () => {
    const source = createInMemorySavedViewsSource();
    const huge = new URLSearchParams();
    applyTracePropertyFilterTokens(huge, [{ fieldId: 'metadata.note', value: 'x'.repeat(17 * 1024) }]);
    renderBar({ page: 'traces', initial: huge.toString(), source });
    await screen.findByRole('group', { name: 'Saved views' });

    nameNewView('Huge');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    });

    expect(screen.getByRole('alert').textContent).toBe(SAVED_VIEW_TOO_LARGE_MESSAGE);
    expect(source.calls.filter(call => call.method !== 'list')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Save view' })).toBeTruthy();
  });
});
