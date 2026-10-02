// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { SavedViewEditor } from './saved-view-editor';
import { parseSavedViews } from './saved-view-schema';
import { SavedViewTabs } from './saved-view-tabs';
import { useSavedViews } from './use-saved-views';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@/ds/components/FilterBar/types';

const STORAGE_KEY = 'saved-views-test';
const settingsSchema = z.object({ layout: z.enum(['list', 'board']) });
type Settings = z.infer<typeof settingsSchema>;

const FIELDS: FilterBarField[] = [{ id: 'status', label: 'Status', operators: ['is'] }];
const OPERATORS: FilterBarOperator[] = [{ id: 'is', label: 'is' }];
const ERRORS: FilterBarItem = { id: 'status', fieldId: 'status', operatorId: 'is', value: 'error' };

function Page() {
  const [activeViewId, setActiveViewId] = useState<string>();
  const views = useSavedViews<Settings>({
    storageKey: STORAGE_KEY,
    settingsSchema,
    activeViewId,
    onActiveViewChange: setActiveViewId,
  });
  const applied = views.applied;
  return (
    <>
      <SavedViewTabs
        views={views}
        fields={FIELDS}
        operators={OPERATORS}
        defaultLabel="All"
        newViewSettings={{ layout: 'board' }}
      />
      <SavedViewEditor views={views}>
        <button type="button" onClick={() => views.change({ filters: [ERRORS] })}>
          Filter errors
        </button>
        <button type="button" onClick={() => views.change({ filters: [], settings: { layout: 'list' } })}>
          Clear draft filters
        </button>
      </SavedViewEditor>
      <output data-testid="applied">{applied ? JSON.stringify(applied) : 'page'}</output>
    </>
  );
}

const stored = () => parseSavedViews(localStorage.getItem(STORAGE_KEY), settingsSchema);
const applied = () => screen.getByTestId('applied').textContent;
const tab = (name: string) => within(screen.getByRole('group', { name: 'Views' })).getByRole('button', { name });

async function createView(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'New view' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rename view' }));
  const input = screen.getByRole('textbox', { name: 'View name' });
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('parseSavedViews', () => {
  it('drops only the views that no longer parse', () => {
    const raw = JSON.stringify({
      version: 1,
      views: [
        { id: 'a', name: 'Kept', filters: [ERRORS], settings: { layout: 'list' } },
        { id: 'b', name: 'Bad settings', filters: [], settings: { layout: 'grid' } },
        { id: 'c', name: '   ', filters: [], settings: { layout: 'list' } },
        { id: 'd', name: 'Bad filter', filters: [{ id: 'x' }], settings: { layout: 'list' } },
      ],
    });
    expect(parseSavedViews(raw, settingsSchema).map(view => view.id)).toEqual(['a']);
  });

  it('reads nothing from another storage version or from corrupt JSON', () => {
    expect(parseSavedViews(JSON.stringify({ version: 2, views: [] }), settingsSchema)).toEqual([]);
    expect(parseSavedViews('{not json', settingsSchema)).toEqual([]);
  });
});

describe('SavedViews', () => {
  it('starts a new view without filters, saves it and brings it back after a reload', async () => {
    const page = render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'New view' }));
    expect(JSON.parse(applied() ?? '')).toMatchObject({ filters: [], settings: { layout: 'board' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await createView('Errors');

    expect(stored()).toMatchObject([{ name: 'Errors', filters: [ERRORS], settings: { layout: 'board' } }]);
    expect(tab('Errors').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Save view' })).toBeNull();

    page.unmount();
    render(<Page />);
    expect(applied()).toBe('page');
    fireEvent.click(tab('Errors'));
    expect(JSON.parse(applied() ?? '')).toMatchObject({ filters: [ERRORS], settings: { layout: 'board' } });
  });

  it('applies edits live and drops them on cancel', async () => {
    render(<Page />);
    await createView('Errors');

    fireEvent.contextMenu(tab('Errors'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear draft filters' }));
    expect(JSON.parse(applied() ?? '')).toMatchObject({ filters: [], settings: { layout: 'list' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(JSON.parse(applied() ?? '')).toMatchObject({ filters: [ERRORS], settings: { layout: 'board' } });
    expect(stored()[0]?.filters).toEqual([ERRORS]);
  });

  it('keeps an edit only once saved', async () => {
    render(<Page />);
    await createView('Errors');

    fireEvent.contextMenu(tab('Errors'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear draft filters' }));
    expect(stored()[0]?.filters).toEqual([ERRORS]);
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));

    expect(stored()).toMatchObject([{ name: 'Errors', filters: [], settings: { layout: 'list' } }]);
  });

  it('previews another view on hover and opens the active view menu on click', async () => {
    render(<Page />);
    await createView('Errors');

    fireEvent.click(tab('Errors'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit view' }));
    expect(screen.getByRole('button', { name: 'Save view' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(tab('All'));
    fireEvent.mouseEnter(tab('Errors'));
    fireEvent.mouseMove(tab('Errors'));
    expect(await screen.findByText('Status', undefined, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit view' })).toBeNull();
  });

  it('renames from the context menu and restores the name on Escape', async () => {
    render(<Page />);
    await createView('Errors');

    fireEvent.contextMenu(tab('Errors'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    let input = screen.getByRole('textbox', { name: 'View name' });
    fireEvent.change(input, { target: { value: 'Ignored' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(stored()[0]?.name).toBe('Errors');

    fireEvent.contextMenu(tab('Errors'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    input = screen.getByRole('textbox', { name: 'View name' });
    fireEvent.change(input, { target: { value: 'Failures' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(stored()[0]?.name).toBe('Failures');
  });

  it('falls back to the page when the active view is deleted', async () => {
    render(<Page />);
    await createView('Errors');

    fireEvent.contextMenu(tab('Errors'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete view' }));

    expect(stored()).toEqual([]);
    expect(applied()).toBe('page');
    expect(tab('All').getAttribute('aria-pressed')).toBe('true');
  });

  it('follows views written by another tab', () => {
    render(<Page />);
    act(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, views: [{ id: 'v', name: 'Shared', filters: [], settings: { layout: 'list' } }] }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });
    expect(tab('Shared').textContent).toBe('Shared');
  });
});
