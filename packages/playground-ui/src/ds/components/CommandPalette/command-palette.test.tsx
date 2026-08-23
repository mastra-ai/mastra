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

describe('CommandPaletteScope', () => {
  const renderScope = (props: Partial<Parameters<typeof CommandPaletteScope>[0]> = {}) =>
    render(
      <CommandPaletteScope
        icon={<Search data-testid="scope-icon" />}
        label="Navigation"
        count={2}
        active={false}
        onSelect={() => {}}
        {...props}
      />,
    );

  it('shows its icon, name and how many it holds', () => {
    renderScope();

    const scope = screen.getByRole('button');
    expect(within(scope).getByTestId('scope-icon')).toBeTruthy();
    expect(scope.textContent).toContain('Navigation');
    expect(scope.textContent).toContain('2');
  });

  it('shows a count of none rather than nothing', () => {
    renderScope({ count: 0 });

    expect(screen.getByRole('button').textContent).toContain('0');
  });

  it('says whether it is the one being searched', () => {
    renderScope({ active: false });
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button').getAttribute('data-active')).toBe('false');

    cleanup();

    renderScope({ active: true });
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button').getAttribute('data-active')).toBe('true');
  });

  it('reports being chosen', () => {
    const onSelect = vi.fn();
    renderScope({ onSelect });

    fireEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('CommandPaletteItem', () => {
  // cmdk items need the Command root the dialog provides.
  const renderItem = (props: Partial<Parameters<typeof CommandPaletteItem>[0]> = {}) =>
    render(
      <CommandPaletteDialog
        open
        onOpenChange={() => {}}
        title="Application search"
        description="Search application resources"
        commandLabel="Search resources"
      >
        <CommandPaletteResults aria-label="Search results">
          <CommandGroup heading="Navigation">
            <CommandPaletteItem icon={<Route data-testid="item-icon" />} title="Settings" value="settings" {...props} />
          </CommandGroup>
        </CommandPaletteResults>
      </CommandPaletteDialog>,
    );

  // The item is an icon, a column of text and an optional shortcut. The column
  // is a title row and, when there is anything for it, a second line.
  const itemElement = () => screen.getByRole('option');
  const textColumn = () => itemElement().children[1];
  const titleRow = () => textColumn()?.children[0];
  const secondLine = () => textColumn()?.children[1];

  it('shows its icon and title with nothing else attached', () => {
    renderItem();

    const item = itemElement();
    expect(within(item).getByTestId('item-icon')).toBeTruthy();
    expect(item.textContent).toBe('Settings');
    // Icon and text column, no shortcut.
    expect(item.childElementCount).toBe(2);
    expect(titleRow()?.childElementCount).toBe(1);
    expect(secondLine()).toBeUndefined();
  });

  it('adds a subtitle when there is one', () => {
    renderItem({ subtitle: 'Application navigation' });

    expect(screen.getByText('Application navigation')).toBeTruthy();
    expect(secondLine()?.childElementCount).toBe(1);
  });

  it('adds the path it would take you to', () => {
    renderItem({ path: '/settings' });

    expect(screen.getByText('/settings')).toBeTruthy();
    expect(secondLine()?.childElementCount).toBe(1);
  });

  it('puts a subtitle and a path on the same second line', () => {
    renderItem({ subtitle: 'Application navigation', path: '/settings' });

    expect(secondLine()?.childElementCount).toBe(2);
  });

  it('adds a badge naming what kind of result it is', () => {
    renderItem({ badge: 'Path' });

    expect(screen.getByText('Path')).toBeTruthy();
    expect(titleRow()?.childElementCount).toBe(2);
  });

  it('adds the shortcut that would reach it', () => {
    renderItem({ shortcut: '⌘K' });

    expect(screen.getByText('⌘K')).toBeTruthy();
    expect(itemElement().childElementCount).toBe(3);
  });

  it('leaves out the second line entirely with neither a subtitle nor a path', () => {
    renderItem({ badge: 'Path' });

    // Title row and nothing under it.
    expect(textColumn()?.childElementCount).toBe(1);
  });

  it('keeps a caller class alongside its own', () => {
    renderItem({ className: 'my-own-class' });

    const item = screen.getByRole('option');
    expect(item.classList.contains('my-own-class')).toBe(true);
    expect(item.classList.contains('rounded-xl')).toBe(true);
  });
});

describe('CommandPaletteDialog', () => {
  const renderDialog = (props: { showOverlay?: boolean } = {}) =>
    render(
      <CommandPaletteDialog
        open
        onOpenChange={() => {}}
        title="Application search"
        description="Search application resources"
        commandLabel="Search resources"
        {...props}
      >
        <CommandPaletteResults aria-label="Search results" />
      </CommandPaletteDialog>,
    );

  it('dims the page behind it', () => {
    renderDialog();

    expect(document.querySelector('.dialog-overlay-anim')).toBeTruthy();
  });

  it('leaves the page alone when the caller asks', () => {
    renderDialog({ showOverlay: false });

    expect(document.querySelector('.dialog-overlay-anim')).toBeNull();
  });
});

describe('CommandPaletteFooter', () => {
  it('names what is being searched and the keys that drive it', () => {
    render(<CommandPaletteFooter label="Application search" />);

    expect(screen.getByText('Application search')).toBeTruthy();
    for (const key of ['↑', '↓', '↵', 'Esc']) {
      expect(screen.getByText(key)).toBeTruthy();
    }
  });

  it('stays out of the way of the results behind it', () => {
    const { container } = render(<CommandPaletteFooter label="Application search" />);

    expect((container.firstElementChild as HTMLElement).classList.contains('pointer-events-none')).toBe(true);
  });
});
