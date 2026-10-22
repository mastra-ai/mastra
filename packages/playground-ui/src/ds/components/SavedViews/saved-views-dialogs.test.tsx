// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { SavedViewEditor } from './saved-view-editor';
import { parseSavedViews } from './saved-view-schema';
import { SavedViewTabs } from './saved-view-tabs';
import { useSavedViews } from './use-saved-views';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@/ds/components/FilterBar/types';

const STORAGE_KEY = 'saved-views-dialogs-test';
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
  return (
    <>
      <SavedViewTabs
        views={views}
        fields={FIELDS}
        operators={OPERATORS}
        defaultLabel="All"
        newViewSettings={{ layout: 'board' }}
        confirmDelete
        confirmUnsavedSwitch
      />
      <SavedViewEditor views={views}>
        <button type="button" onClick={() => views.change({ filters: [ERRORS] })}>
          Filter errors
        </button>
        <button type="button" onClick={() => views.change({ filters: [], settings: { layout: 'list' } })}>
          Clear draft filters
        </button>
      </SavedViewEditor>
      <output data-testid="applied">{views.applied ? JSON.stringify(views.applied) : 'page'}</output>
    </>
  );
}

const stored = () => parseSavedViews(localStorage.getItem(STORAGE_KEY), settingsSchema);
const applied = () => screen.getByTestId('applied').textContent;
const tabs = () => screen.getByRole('group', { name: 'Views' });
const tab = (name: string) => within(tabs()).getByRole('button', { name });

function createErrorsView() {
  fireEvent.click(screen.getByRole('button', { name: 'New view' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rename view' }));
  const input = screen.getByRole('textbox', { name: 'View name' });
  fireEvent.change(input, { target: { value: 'Errors' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('SavedViewTabs with confirmations', () => {
  describe('when another tab is picked while the active view has unsaved changes', () => {
    const switchWithChanges = () => {
      render(<Page />);
      createErrorsView();
      fireEvent.click(screen.getByRole('button', { name: 'Clear draft filters' }));
      fireEvent.click(tab('All'));
      return screen.findByRole('alertdialog', { name: 'Unsaved changes to “Errors”' });
    };

    it('asks first, and stays on the view with its changes on Cancel', async () => {
      const dialog = await switchWithChanges();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(tab('Errors').getAttribute('aria-pressed')).toBe('true');
      expect(JSON.parse(applied() ?? '')).toMatchObject({ filters: [], settings: { layout: 'list' } });
    });

    it('drops the changes and switches on Discard changes', async () => {
      const dialog = await switchWithChanges();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

      await waitFor(() => expect(tab('All').getAttribute('aria-pressed')).toBe('true'));
      expect(applied()).toBe('page');
      expect(stored()).toMatchObject([{ name: 'Errors', filters: [ERRORS], settings: { layout: 'board' } }]);
    });

    it('saves the changes to the view, then switches, on Save changes', async () => {
      const dialog = await switchWithChanges();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(tab('All').getAttribute('aria-pressed')).toBe('true'));
      expect(stored()).toMatchObject([{ name: 'Errors', filters: [], settings: { layout: 'list' } }]);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('stays on the view with its changes when the save fails', async () => {
      const dialog = await switchWithChanges();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Storage full', 'QuotaExceededError');
      });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

      expect((await within(dialog).findByRole('alert')).textContent).toContain('Could not save changes');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(tab('Errors').getAttribute('aria-pressed')).toBe('true');
      expect(JSON.parse(applied() ?? '')).toMatchObject({ filters: [], settings: { layout: 'list' } });
      expect(stored()).toMatchObject([{ filters: [ERRORS], settings: { layout: 'board' } }]);
    });

    it('switches without asking when nothing changed', () => {
      render(<Page />);
      createErrorsView();

      fireEvent.click(tab('All'));

      expect(tab('All').getAttribute('aria-pressed')).toBe('true');
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  describe('when another tab is picked while a new view was not saved yet', () => {
    it('asks before dropping it', async () => {
      render(<Page />);
      fireEvent.click(screen.getByRole('button', { name: 'New view' }));
      fireEvent.click(screen.getByRole('button', { name: 'Filter errors' }));

      fireEvent.click(tab('All'));
      const dialog = await screen.findByRole('alertdialog', { name: 'Unsaved changes to “Untitled view”' });
      expect(within(dialog).getByRole('button', { name: 'Save view' })).toBeTruthy();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' }));

      await waitFor(() => expect(tab('All').getAttribute('aria-pressed')).toBe('true'));
      expect(applied()).toBe('page');
      expect(stored()).toEqual([]);
    });
  });

  describe('when the active view is deleted', () => {
    it('asks first, then falls back to the default tab without changing the page', async () => {
      render(<Page />);
      createErrorsView();

      fireEvent.contextMenu(tab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete view…' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(stored()).toHaveLength(1);

      fireEvent.contextMenu(tab('Errors'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete view…' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Delete view?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete view' }));

      await waitFor(() => expect(within(tabs()).queryByRole('button', { name: 'Errors' })).toBeNull());
      expect(stored()).toEqual([]);
      expect(tab('All').getAttribute('aria-pressed')).toBe('true');
      expect(applied()).toBe('page');
    });
  });
});
