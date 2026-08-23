// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainSidebar } from './main-sidebar';
import { MainSidebarProvider } from './main-sidebar-provider';

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => cleanup());

// jsdom has no PointerEvent constructor; the handlers only read MouseEvent
// fields plus `pointerId`, so a MouseEvent with `pointerId` patched on works.
const pointerEvent = (type: string, init: MouseEventInit & { pointerId: number }) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.assign(event, { pointerId: init.pointerId });
  return event;
};

describe('MainSidebar resize handle gesture', () => {
  const renderCollapsedSidebar = () => {
    mockMatchMedia(false);
    render(
      <MainSidebarProvider defaultState="collapsed">
        <MainSidebar>
          <MainSidebar.Nav>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents' }} />
            </MainSidebar.NavList>
          </MainSidebar.Nav>
        </MainSidebar>
      </MainSidebarProvider>,
    );
    const scope = document.querySelector('[data-sidebar-scope]');
    if (!scope) throw new Error('sidebar scope not rendered');
    return { scope, separator: screen.getByRole('separator') };
  };

  it('engages gesture-active on press, before any movement', () => {
    const { scope, separator } = renderCollapsedSidebar();

    fireEvent(separator, pointerEvent('pointerdown', { button: 0, pointerId: 1, clientX: 64 }));
    expect(scope.getAttribute('data-sidebar-gesture')).toBe('active');

    // Sub-threshold wiggle (≤ 5px) is still a held gesture, not a hover state.
    fireEvent(window, pointerEvent('pointermove', { pointerId: 1, clientX: 67 }));
    expect(scope.getAttribute('data-sidebar-gesture')).toBe('active');

    fireEvent(window, pointerEvent('pointerup', { pointerId: 1 }));
    expect(scope.getAttribute('data-sidebar-gesture')).toBeNull();
  });

  it('captures the pointer so the handle keeps its hover styles for the whole drag', () => {
    const { separator } = renderCollapsedSidebar();
    const setPointerCapture = vi.fn();
    separator.setPointerCapture = setPointerCapture;

    fireEvent(separator, pointerEvent('pointerdown', { button: 0, pointerId: 1, clientX: 64 }));
    expect(setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('keeps gesture-active for the whole collapsed drag, even far from the handle', () => {
    const { scope, separator } = renderCollapsedSidebar();

    fireEvent(separator, pointerEvent('pointerdown', { button: 0, pointerId: 1, clientX: 64 }));

    // Past the drag threshold but still inside the snap zone (< collapseBelow):
    // pointer is way off the 8px handle, sidebar stays collapsed.
    fireEvent(window, pointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
    expect(scope.getAttribute('data-sidebar-gesture')).toBe('active');

    // Crossing collapseBelow expands the sidebar (state change + re-render).
    fireEvent(window, pointerEvent('pointermove', { pointerId: 1, clientX: 250 }));
    expect(scope.getAttribute('data-sidebar-gesture')).toBe('active');

    // Back into the snap zone: collapses again mid-drag.
    fireEvent(window, pointerEvent('pointermove', { pointerId: 1, clientX: 120 }));
    expect(scope.getAttribute('data-sidebar-gesture')).toBe('active');

    fireEvent(window, pointerEvent('pointerup', { pointerId: 1 }));
    expect(scope.getAttribute('data-sidebar-gesture')).toBeNull();
  });
});

describe('MainSidebar keyboard behavior', () => {
  it('leaves Command+B available to the browser by default', () => {
    mockMatchMedia(false);
    render(
      <MainSidebarProvider>
        <MainSidebar>
          <MainSidebar.Nav />
        </MainSidebar>
      </MainSidebarProvider>,
    );
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyB',
      key: 'b',
      metaKey: true,
    });

    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.querySelector('[data-sidebar-scope]')?.getAttribute('data-sidebar-state')).toBe('default');
  });

  it('toggles the sidebar when a consumer explicitly opts in', () => {
    mockMatchMedia(false);
    render(
      <MainSidebarProvider disableKeyboardShortcut={false}>
        <MainSidebar>
          <MainSidebar.Nav />
        </MainSidebar>
      </MainSidebarProvider>,
    );
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyB',
      key: 'b',
      metaKey: true,
    });

    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector('[data-sidebar-scope]')?.getAttribute('data-sidebar-state')).toBe('collapsed');
  });
});

describe('MainSidebar mobile drawer', () => {
  it('opens as an accessible dialog on mobile', () => {
    mockMatchMedia(true);
    render(
      <MainSidebarProvider>
        <MainSidebar.MobileTrigger />
        <MainSidebar>
          <MainSidebar.Nav>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents' }} />
            </MainSidebar.NavList>
          </MainSidebar.Nav>
        </MainSidebar>
      </MainSidebarProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeDefined();
    expect(document.querySelector('[data-slot="drawer-popup"]')?.getAttribute('data-swipe-direction')).toBe('left');
    expect(screen.getByRole('link', { name: 'Agents' })).toBeDefined();
  });
});

describe('MainSidebar resize handle keyboard', () => {
  const renderSidebar = (props: { defaultState?: 'default' | 'collapsed' } = {}) => {
    mockMatchMedia(false);
    render(
      <MainSidebarProvider
        defaultState={props.defaultState ?? 'default'}
        defaultWidth={300}
        minWidth={200}
        maxWidth={480}
      >
        <MainSidebar>
          <MainSidebar.Nav>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents' }} />
            </MainSidebar.NavList>
          </MainSidebar.Nav>
        </MainSidebar>
      </MainSidebarProvider>,
    );
    const scope = document.querySelector('[data-sidebar-scope]') as HTMLElement;
    return { scope, separator: screen.getByRole('separator') };
  };

  const widthOf = (scope: HTMLElement) => scope.style.getPropertyValue('--sidebar-width');

  it('narrows the sidebar a step at a time', () => {
    const { scope, separator } = renderSidebar();
    expect(widthOf(scope)).toBe('300px');

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });

    expect(widthOf(scope)).toBe('290px');
  });

  it('widens the sidebar a step at a time', () => {
    const { scope, separator } = renderSidebar();

    fireEvent.keyDown(separator, { key: 'ArrowRight' });

    expect(widthOf(scope)).toBe('310px');
  });

  it('has nothing to narrow while collapsed', () => {
    const { scope, separator } = renderSidebar({ defaultState: 'collapsed' });
    const before = widthOf(scope);

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });

    expect(widthOf(scope)).toBe(before);
    expect(scope.getAttribute('data-sidebar-state')).toBe('collapsed');
  });

  it('opens a collapsed sidebar rather than widening it', () => {
    const { scope, separator } = renderSidebar({ defaultState: 'collapsed' });

    fireEvent.keyDown(separator, { key: 'ArrowRight' });

    expect(scope.getAttribute('data-sidebar-state')).toBe('default');
    expect(widthOf(scope)).toBe('300px');
  });

  it('jumps to the narrowest width', () => {
    const { scope, separator } = renderSidebar();

    fireEvent.keyDown(separator, { key: 'Home' });

    expect(widthOf(scope)).toBe('200px');
  });

  it('jumps to the widest width', () => {
    const { scope, separator } = renderSidebar();

    fireEvent.keyDown(separator, { key: 'End' });

    expect(widthOf(scope)).toBe('480px');
  });

  it('opens a collapsed sidebar when jumping to either end', () => {
    const collapsed = renderSidebar({ defaultState: 'collapsed' });
    fireEvent.keyDown(collapsed.separator, { key: 'Home' });
    expect(collapsed.scope.getAttribute('data-sidebar-state')).toBe('default');

    cleanup();

    const stillCollapsed = renderSidebar({ defaultState: 'collapsed' });
    fireEvent.keyDown(stillCollapsed.separator, { key: 'End' });
    expect(stillCollapsed.scope.getAttribute('data-sidebar-state')).toBe('default');
  });

  it.each(['Enter', ' '])('collapses and reopens on %s', key => {
    const { scope, separator } = renderSidebar();
    expect(scope.getAttribute('data-sidebar-state')).toBe('default');

    fireEvent.keyDown(separator, { key });
    expect(scope.getAttribute('data-sidebar-state')).toBe('collapsed');

    fireEvent.keyDown(separator, { key });
    expect(scope.getAttribute('data-sidebar-state')).toBe('default');
  });

  it('leaves any other key to the browser', () => {
    const { scope, separator } = renderSidebar();
    const before = widthOf(scope);

    fireEvent.keyDown(separator, { key: 'a' });

    expect(widthOf(scope)).toBe(before);
    expect(scope.getAttribute('data-sidebar-state')).toBe('default');
  });

  it('toggles on a click that was not a drag', () => {
    const { scope, separator } = renderSidebar();

    fireEvent.click(separator);

    expect(scope.getAttribute('data-sidebar-state')).toBe('collapsed');
  });
});

describe('MainSidebar mobile drawer closing', () => {
  const openDrawer = (links: ReactNode) => {
    mockMatchMedia(true);
    render(
      <MainSidebarProvider>
        <MainSidebar.MobileTrigger />
        <MainSidebar>
          <MainSidebar.Nav>{links}</MainSidebar.Nav>
        </MainSidebar>
      </MainSidebarProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    return screen.getByRole('dialog', { name: 'Navigation' });
  };

  const navLinks = (
    <MainSidebar.NavList>
      <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents' }} />
    </MainSidebar.NavList>
  );

  const isClosed = async () => waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull());

  it('closes once the reader follows a link', async () => {
    openDrawer(navLinks);

    fireEvent.click(screen.getByRole('link', { name: 'Agents' }), { button: 0 });

    await isClosed();
  });

  it('stays open when the click was not on a link', () => {
    const drawer = openDrawer(
      <>
        {navLinks}
        <button type="button">Sign out</button>
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }), { button: 0 });

    expect(drawer).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy();
  });

  it.each([
    ['a middle click', { button: 1 }],
    ['a command-click', { button: 0, metaKey: true }],
    ['a control-click', { button: 0, ctrlKey: true }],
    ['a shift-click', { button: 0, shiftKey: true }],
    ['an alt-click', { button: 0, altKey: true }],
  ])('stays open for %s, which opens elsewhere', (_, init) => {
    openDrawer(navLinks);

    fireEvent.click(screen.getByRole('link', { name: 'Agents' }), init);

    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy();
  });

  it('stays open for a link that opens in a new tab', () => {
    mockMatchMedia(true);
    render(
      <MainSidebarProvider>
        <MainSidebar.MobileTrigger />
        <MainSidebar>
          <MainSidebar.Nav>
            <a href="https://mastra.ai/docs" target="_blank" rel="noreferrer">
              Docs
            </a>
          </MainSidebar.Nav>
        </MainSidebar>
      </MainSidebarProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    fireEvent.click(screen.getByRole('link', { name: 'Docs' }), { button: 0 });

    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy();
  });

  it('stays open for a download link', () => {
    mockMatchMedia(true);
    render(
      <MainSidebarProvider>
        <MainSidebar.MobileTrigger />
        <MainSidebar>
          <MainSidebar.Nav>
            <a href="/export.json" download>
              Export
            </a>
          </MainSidebar.Nav>
        </MainSidebar>
      </MainSidebarProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    fireEvent.click(screen.getByRole('link', { name: 'Export' }), { button: 0 });

    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy();
  });

  it('stays open for an anchor with nowhere to go', () => {
    mockMatchMedia(true);
    render(
      <MainSidebarProvider>
        <MainSidebar.MobileTrigger />
        <MainSidebar>
          <MainSidebar.Nav>
            {/* A placeholder anchor with nowhere to go is the case under test. */}
            <a data-testid="no-href">Coming soon</a>
          </MainSidebar.Nav>
        </MainSidebar>
      </MainSidebarProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    fireEvent.click(screen.getByTestId('no-href'), { button: 0 });

    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy();
  });
});
