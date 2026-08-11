// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Route, Search } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandEmpty, CommandGroup } from '../Command';
import {
  CommandPaletteBody,
  CommandPaletteDialog,
  CommandPaletteFooter,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteRail,
  CommandPaletteResults,
  CommandPaletteScope,
} from './command-palette';

class TestResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords = (): ResizeObserverEntry[] => [];
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Spacing between the parts of a composed accessible name is not stable across environments
const ITEM_NAME = /Settings\s*Path\s*Application navigation\s*\/settings/;
const SCOPE_NAME = /Navigation\s*2/;

function renderPalette() {
  const selectScope = vi.fn();
  const selectItem = vi.fn();

  render(
    <CommandPaletteDialog
      open
      onOpenChange={() => {}}
      title="Application search"
      description="Search application resources"
      commandLabel="Search resources"
    >
      <CommandPaletteInput placeholder="Search resources" />
      <CommandPaletteBody>
        <CommandPaletteRail aria-label="Search categories">
          <CommandPaletteScope icon={<Search />} label="All" count={4} active={false} onSelect={() => {}} />
          <CommandPaletteScope icon={<Route />} label="Navigation" count={2} active onSelect={selectScope} />
        </CommandPaletteRail>
        <CommandPaletteResults aria-label="Search results" footer={<CommandPaletteFooter label="Application search" />}>
          <CommandEmpty>No matching results.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandPaletteItem
              icon={<Route />}
              title="Settings"
              subtitle="Application navigation"
              path="/settings"
              badge="Path"
              value="settings application navigation"
              onSelect={selectItem}
            />
          </CommandGroup>
        </CommandPaletteResults>
      </CommandPaletteBody>
    </CommandPaletteDialog>,
  );

  return { selectScope, selectItem };
}

describe('CommandPalette', () => {
  it('labels the input, rail, and results so each region is reachable by name', () => {
    renderPalette();

    expect(screen.getByRole('combobox', { name: 'Search resources' })).toBeDefined();
    expect(screen.getByRole('complementary', { name: 'Search categories' })).toBeDefined();
    const results = screen.getByRole('region', { name: 'Search results' });
    expect(within(results).getByText('Application search')).toBeDefined();
    expect(screen.getByRole('option', { name: ITEM_NAME })).toBeDefined();
  });

  it('marks the active scope pressed and reports scope and item selection to the application', () => {
    const { selectScope, selectItem } = renderPalette();

    expect(screen.getByRole('button', { name: SCOPE_NAME }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: SCOPE_NAME }));
    fireEvent.click(screen.getByRole('option', { name: ITEM_NAME }));

    expect(selectScope).toHaveBeenCalledOnce();
    expect(selectItem).toHaveBeenCalledOnce();
  });
});
