// @vitest-environment jsdom
import type { SavedViewPage, SavedViewState } from '@mastra/core/storage';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { logsView, pages, spansView, tracesView } from '../../__tests__/fixtures/saved-view-pages';
import { applySavedView, savedViewFromSearchParams } from '../../saved-view-state';
import { ObservabilitySavedViews } from '../observability-saved-views';
import { SavedViewsProvider } from '../saved-views-provider';
import type { SavedViewRecord } from '../saved-views-source';
import { SAVED_VIEW_TOO_LARGE_MESSAGE } from '../use-hosted-saved-views';
import { createInMemorySavedViewsSource } from './fixtures/in-memory-source';
import type { InMemorySavedViewsSource } from './fixtures/in-memory-source';
import { LogsSavedViews } from '@/domains/logs/components/logs-saved-views';
import { useTraceColumnPreferences } from '@/domains/traces/hooks/use-trace-column-preferences';
import { applyTracePropertyFilterTokens } from '@/domains/traces/trace-filters';
import type { SetURLSearchParamsLike } from '@/lib/sort/use-url-sort';
import { renderWithProviders } from '@/test/render';
import { SearchParamsHost } from '@/test/search-params-host';

/** The bar as a page mounts it, with the traces column picker when the page has columns. */
function Page({
  page,
  initial,
  withColumns,
  defaultDatePreset,
}: {
  page: SavedViewPage;
  initial: string;
  withColumns: boolean;
  defaultDatePreset?: string;
}) {
  const columns = useTraceColumnPreferences();
  return (
    <SearchParamsHost initial={initial}>
      {urlState => (
        <>
          <ObservabilitySavedViews
            page={page}
            {...urlState}
            columns={withColumns ? columns : undefined}
            defaultDatePreset={defaultDatePreset}
          />
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
  canEdit,
  defaultDatePreset,
}: {
  page: SavedViewPage;
  initial: string;
  source: InMemorySavedViewsSource;
  withColumns?: boolean;
  canEdit?: (view: SavedViewRecord) => boolean;
  defaultDatePreset?: string;
}) =>
  renderWithProviders(
    <SavedViewsProvider source={source} queryKeyScope={['project', 'p1']} canEdit={canEdit}>
      <Page page={page} initial={initial} withColumns={withColumns} defaultDatePreset={defaultDatePreset} />
    </SavedViewsProvider>,
  );

const url = () => screen.getByTestId('search-params').textContent ?? '';
const columnsReadout = () => JSON.parse(screen.getByTestId('columns').textContent ?? '{}');
const picker = () => screen.getByLabelText(/^View: /);
const activeName = () =>
  picker()
    .getAttribute('aria-label')
    ?.replace(/^View: /, '')
    .replace(/, unsaved changes$/, '');
const pressed = (name: string) => activeName() === name;
/** The picker's options, once `last` (the last view the host lists) has loaded. */
const listedViews = async (last: string) => {
  fireEvent.click(await screen.findByLabelText(/^View: /));
  await screen.findByRole('option', { name: last });
  const options = screen.getAllByRole('option');
  const names = options.map(option => option.textContent);
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  return names;
};
const pickView = async (name: string) => {
  fireEvent.click(await screen.findByLabelText(/^View: /));
  // A shared view's option also reads "Shared".
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(`^${name}(Shared)?$`) }));
  await waitFor(() => expect(activeName()).toBe(name));
};

const nameNewView = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Save as new view' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'View name' }), { target: { value: name } });
};

const openViewMenu = async (name: string) => {
  if (!pressed(name)) await pickView(name);
  fireEvent.click(screen.getByRole('button', { name: 'View actions' }));
  return screen.findByRole('menu');
};

const renameTo = (name: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'View name' }), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
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

    expect(await listedViews('Errors')).toEqual(['All logs', 'Errors']);
  });

  describe.each(pages)('on the $page page', ({ page, url: urlByHand, base, view, ...rest }) => {
    const withColumns = 'columns' in rest;

    it('saves the current URL as the view the page would build from it', async () => {
      const source = createInMemorySavedViewsSource();
      renderBar({ page, initial: urlByHand().toString(), source, withColumns });
      await screen.findByLabelText(/^View: /);

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

      await pickView('Mine');

      await waitFor(() => expect(url()).toBe(urlByHand().toString()));
      expect(pressed('Mine')).toBe(true);
      if (withColumns) expect(columnsReadout()).toEqual(applySavedView(view, new URLSearchParams()).columns);
      // The URL matches the view, so it has nothing to save.
      expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    });

    it('after a reload, the view matching the URL is the active tab', async () => {
      const source = createInMemorySavedViewsSource([{ name: 'Mine', state: view }]);
      const first = renderBar({ page, initial: base, source, withColumns });
      await pickView('Mine');
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

    await pickView('Old');

    const byHand = new URLSearchParams();
    applyTracePropertyFilterTokens(byHand, [{ fieldId: 'status', value: 'error' }]);
    await waitFor(() => expect(url()).toBe(byHand.toString()));
    expect(columnsReadout().visibleColumns).toContain('input');
    expect(columnsReadout().visibleColumns).not.toContain('removedColumn');
  });

  it('picking a view never shows it as unsaved while the host catches up with the URL', async () => {
    // Like a data router (Studio's), this host renders a new URL a moment after the navigation that set it.
    function LateUrlPage() {
      const [searchParams, setParams] = useState(() => new URLSearchParams());
      const columns = useTraceColumnPreferences();
      const setSearchParams: SetURLSearchParamsLike = next => {
        setTimeout(() => setParams(previous => (typeof next === 'function' ? next(previous) : next)), 50);
      };
      return (
        <>
          <ObservabilitySavedViews
            page="traces"
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            columns={columns}
          />
          <output data-testid="search-params">{searchParams.toString()}</output>
        </>
      );
    }
    const source = createInMemorySavedViewsSource([{ name: 'Incident', state: tracesView }]);
    renderWithProviders(
      <SavedViewsProvider source={source} queryKeyScope={['project', 'p1']}>
        <LateUrlPage />
      </SavedViewsProvider>,
    );
    const trigger = await screen.findByLabelText(/^View: /);
    const labels: string[] = [];
    const observer = new MutationObserver(() => labels.push(trigger.getAttribute('aria-label') ?? ''));
    observer.observe(trigger, { attributes: true, attributeFilter: ['aria-label'] });

    await pickView('Incident');
    await waitFor(() => expect(url()).toBe(applySavedView(tracesView, new URLSearchParams()).params.toString()));
    observer.disconnect();

    expect(labels).toContain('View: Incident');
    expect(labels.filter(label => label.includes('unsaved'))).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('applies a fixed date range as saved', async () => {
    const source = createInMemorySavedViewsSource([{ name: 'Incident', state: tracesView }]);
    renderBar({ page: 'traces', initial: '', source, withColumns: true });

    await pickView('Incident');

    await waitFor(() => {
      const params = new URLSearchParams(url());
      expect(params.get('datePreset')).toBe('custom');
      expect(params.get('dateFrom')).toBe('2026-10-01T00:00:00.000Z');
      expect(params.get('dateTo')).toBe('2026-10-02T12:30:00.000Z');
    });
  });

  it('applies a read-only view but offers no way to change it', async () => {
    const source = createInMemorySavedViewsSource([{ name: 'Org errors', state: spansView, scope: 'org' }]);
    renderBar({ page: 'spans', initial: '', source, canEdit: view => view.scope !== 'org' });

    await pickView('Org errors');
    await waitFor(() => expect(url()).toBe(applySavedView(spansView, new URLSearchParams()).params.toString()));

    const menu = await openViewMenu('Org errors');
    expect(within(menu).queryByRole('menuitem', { name: 'Rename' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Delete view' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Duplicate' })).toBeTruthy();
    fireEvent.keyDown(menu, { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
    expect(await screen.findByRole('button', { name: 'Reset' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(source.calls.filter(call => call.method !== 'list')).toEqual([]);
  });

  describe('when the host defaults to another range', () => {
    const lastWeek: SavedViewState = { schemaVersion: 1, page: 'spans', filters: [], dateRange: { preset: 'last-7d' } };

    it('a view of the last 7 days reopens on the last 7 days', async () => {
      const source = createInMemorySavedViewsSource([{ name: 'Last week', state: lastWeek }]);
      renderBar({ page: 'spans', initial: '', source, defaultDatePreset: 'last-24h' });

      await pickView('Last week');

      await waitFor(() => expect(url()).toBe('datePreset=last-7d'));
      expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    });

    it('saves the last 7 days picked by hand and leaves the host default out', async () => {
      const source = createInMemorySavedViewsSource([
        { name: 'Today', state: { ...lastWeek, dateRange: { preset: 'last-24h' } } },
      ]);
      renderBar({ page: 'spans', initial: 'datePreset=last-7d', source, defaultDatePreset: 'last-24h' });
      await screen.findByLabelText(/^View: /);

      nameNewView('Last week');
      fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
      await waitFor(() => expect(source.records()).toHaveLength(2));
      expect(source.records().find(record => record.name === 'Last week')?.state).toEqual(lastWeek);

      await pickView('Today');
      await waitFor(() => expect(url()).toBe(''));
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
      expect(await listedViews('Errors')).toEqual(['All spans', 'Slow', 'Errors']);
      return source;
    };

    it('saves changes to the active view', async () => {
      const source = await setup();
      await pickView('Slow');

      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      expect((await screen.findByLabelText(/^View: /)).getAttribute('aria-label')).toBe('View: Slow, unsaved changes');
      fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(source.calls.some(call => call.method === 'update')).toBe(true));
      const slow = source.records().find(record => record.name === 'Slow');
      expect(slow?.state).toEqual(savedViewFromSearchParams('spans', new URLSearchParams(url())));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull());
      expect(pressed('Slow')).toBe(true);
    });

    it('resets the active view to what was saved', async () => {
      await setup();
      await pickView('Slow');
      const saved = url();

      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Reset' }));

      await waitFor(() => expect(url()).toBe(saved));
    });

    it('renames a view', async () => {
      const source = await setup();
      fireEvent.click(within(await openViewMenu('Errors')).getByRole('menuitem', { name: 'Rename' }));
      renameTo('All errors');

      await waitFor(() => expect(activeName()).toBe('All errors'));
      expect(source.records().map(record => record.name)).toContain('All errors');
    });

    it('duplicates a view and applies the copy', async () => {
      const source = await setup();
      fireEvent.click(within(await openViewMenu('Errors')).getByRole('menuitem', { name: 'Duplicate' }));

      await waitFor(() => expect(pressed('Errors copy')).toBe(true));
      const original = source.records().find(record => record.name === 'Errors');
      const copy = source.records().find(record => record.name === 'Errors copy');
      expect(copy?.state).toEqual(original?.state);
      const errorsUrl = applySavedView(
        { ...empty, filters: [{ fieldId: 'status', value: 'error' }] },
        new URLSearchParams(),
      );
      await waitFor(() => expect(url()).toBe(errorsUrl.params.toString()));
    });

    it('a duplicate that lands after the user picked another view keeps that view', async () => {
      const source = await setup();
      const create = source.create;
      let release = () => {};
      source.create = input =>
        new Promise(resolve => {
          release = () => resolve(create(input));
        });
      fireEvent.click(within(await openViewMenu('Errors')).getByRole('menuitem', { name: 'Duplicate' }));
      await pickView('Slow');
      const slowUrl = url();

      await act(async () => release());

      await waitFor(() => expect(source.records().map(record => record.name)).toContain('Errors copy'));
      await act(async () => {});
      expect(activeName()).toBe('Slow');
      expect(url()).toBe(slowUrl);
    });

    it('deleting the active view goes back to the default tab', async () => {
      const source = await setup();
      await pickView('Errors');

      fireEvent.click(within(await openViewMenu('Errors')).getByRole('menuitem', { name: 'Delete view' }));

      await waitFor(() => expect(pressed('All spans')).toBe(true));
      expect(await listedViews('Slow')).toEqual(['All spans', 'Slow']);
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

      fireEvent.change(screen.getByRole('textbox', { name: 'View name' }), { target: { value: 'errors 2' } });
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows a name clash on rename and keeps the old name', async () => {
      await setup();
      fireEvent.click(within(await openViewMenu('Slow')).getByRole('menuitem', { name: 'Rename' }));
      renameTo('Errors');

      expect((await screen.findByRole('alert')).textContent).toBe('A view named "Errors" already exists.');
      expect(activeName()).toBe('Slow');
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
    await screen.findByLabelText(/^View: /);

    nameNewView('Huge');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    });

    expect(screen.getByRole('alert').textContent).toBe(SAVED_VIEW_TOO_LARGE_MESSAGE);
    expect(source.calls.filter(call => call.method !== 'list')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Save view' })).toBeTruthy();
  });
});
