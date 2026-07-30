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

describe('CommandPalette', () => {
  describe('when it renders application-owned scopes and results', () => {
    it('provides the shared accessible shell without owning domain state', () => {
      const selectNavigation = vi.fn();
      const selectResult = vi.fn();

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
              <CommandPaletteScope icon={<Route />} label="Navigation" count={2} active onSelect={selectNavigation} />
            </CommandPaletteRail>
            <CommandPaletteResults
              aria-label="Search results"
              footer={<CommandPaletteFooter label="Application search" />}
            >
              <CommandEmpty>No matching results.</CommandEmpty>
              <CommandGroup heading="Navigation">
                <CommandPaletteItem
                  icon={<Route />}
                  title="Settings"
                  subtitle="Application navigation"
                  path="/settings"
                  badge="Path"
                  value="settings application navigation"
                  onSelect={selectResult}
                />
              </CommandGroup>
            </CommandPaletteResults>
          </CommandPaletteBody>
        </CommandPaletteDialog>,
      );

      expect(screen.getByRole('combobox', { name: 'Search resources' })).toBeDefined();
      expect(screen.getByRole('complementary', { name: 'Search categories' })).toBeDefined();
      const results = screen.getByRole('region', { name: 'Search results' });
      expect(results).toBeDefined();
      expect(screen.getByRole('button', { name: 'Navigation 2' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('option', { name: 'Settings Path Application navigation /settings' })).toBeDefined();
      expect(within(results).getByText('Application search')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Navigation 2' }));
      fireEvent.click(screen.getByRole('option', { name: 'Settings Path Application navigation /settings' }));

      expect(selectNavigation).toHaveBeenCalledOnce();
      expect(selectResult).toHaveBeenCalledOnce();
    });
  });
});
