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

  it('keeps stepping from where the last step left it', () => {
    const { scope, separator } = renderSidebar();

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    fireEvent.keyDown(separator, { key: 'ArrowLeft' });

    expect(widthOf(scope)).toBe('280px');
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

  it.each(['Home', 'End'])('opens a collapsed sidebar when jumping with %s', key => {
    const { scope, separator } = renderSidebar({ defaultState: 'collapsed' });

    fireEvent.keyDown(separator, { key });

    expect(scope.getAttribute('data-sidebar-state')).toBe('default');
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

  it.each(['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'Home', 'End'])(
    'takes %s for itself rather than letting the page scroll',
    key => {
      const { separator } = renderSidebar();

      expect(fireEvent.keyDown(separator, { key })).toBe(false);
    },
  );

  it('remembers a width reached with the keyboard', () => {
    const { separator } = renderSidebar();

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });

    expect(window.localStorage.getItem('sidebar:width')).toBe('290');
  });

  it('remembers a sidebar opened with the keyboard, width and all', () => {
    const { separator } = renderSidebar({ defaultState: 'collapsed' });

    fireEvent.keyDown(separator, { key: 'ArrowRight' });

    expect(window.localStorage.getItem('sidebar:state')).toBe('default');
    expect(window.localStorage.getItem('sidebar:width')).toBe('300');
  });

  it('remembers a width the right arrow reached', () => {
    const { separator } = renderSidebar();

    fireEvent.keyDown(separator, { key: 'ArrowRight' });

    expect(window.localStorage.getItem('sidebar:width')).toBe('310');
  });

  it('says how wide it is, and what Enter would do', () => {
    const { separator } = renderSidebar();

    expect(separator.getAttribute('aria-valuetext')).toBe('300 pixels');
    expect(separator.getAttribute('aria-label')).toContain('Enter to collapse');

    fireEvent.keyDown(separator, { key: 'Enter' });

    expect(separator.getAttribute('aria-valuetext')).toBe('collapsed');
    expect(separator.getAttribute('aria-label')).toContain('Enter to expand');
  });

  it.each(['Home', 'End'])('remembers the width %s jumped to', key => {
    const { separator } = renderSidebar();

    fireEvent.keyDown(separator, { key });

    expect(window.localStorage.getItem('sidebar:width')).toBe(key === 'Home' ? '200' : '480');
  });

  it('toggles on a click that was not a drag', () => {
    const { scope, separator } = renderSidebar();

    fireEvent.click(separator);

    expect(scope.getAttribute('data-sidebar-state')).toBe('collapsed');
  });
});

describe('MainSidebar dragging the resize handle', () => {
  const renderSidebar = (props: { defaultState?: 'default' | 'collapsed'; collapsedWidth?: number } = {}) => {
    mockMatchMedia(false);
    const view = render(
      <MainSidebarProvider
        defaultState={props.defaultState ?? 'default'}
        defaultWidth={300}
        minWidth={200}
        maxWidth={480}
        collapsedWidth={props.collapsedWidth}
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
    return { ...view, scope, separator: screen.getByRole('separator') };
  };

  const widthOf = (scope: HTMLElement) => scope.style.getPropertyValue('--sidebar-width');
  const press = (separator: HTMLElement, clientX: number, pointerId = 1, button = 0) =>
    fireEvent(separator, pointerEvent('pointerdown', { button, pointerId, clientX }));
  const move = (clientX: number, pointerId = 1) =>
    fireEvent(window, pointerEvent('pointermove', { pointerId, clientX }));
  const release = (pointerId = 1) => fireEvent(window, pointerEvent('pointerup', { pointerId }));

  it('takes the press for itself so the page does not start selecting text', () => {
    const { separator } = renderSidebar();

    expect(press(separator, 300)).toBe(false);
  });

  it('ignores a press from any button but the primary one', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300, 1, 2);

    expect(scope.getAttribute('data-sidebar-gesture')).toBeNull();
  });

  it('resizes the sidebar to wherever the pointer went', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    move(350);

    expect(widthOf(scope)).toBe('350px');
  });

  it('measures the width from the sidebar’s own left edge', () => {
    const { scope, separator } = renderSidebar();
    const sidebar = separator.parentElement as HTMLElement;
    sidebar.getBoundingClientRect = () =>
      ({ left: 40, top: 0, right: 340, bottom: 0, width: 300, height: 0, x: 40, y: 0, toJSON: () => ({}) }) as DOMRect;

    press(separator, 300);
    move(350);

    expect(widthOf(scope)).toBe('310px');
  });

  it('needs more than a wiggle before it counts as a drag', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    // Exactly the threshold is still a wiggle.
    move(305);
    expect(widthOf(scope)).toBe('300px');

    move(306);
    expect(widthOf(scope)).toBe('306px');
  });

  it('is still a click when the pointer never really moved', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    move(303);
    release();
    fireEvent.click(separator);

    expect(scope.getAttribute('data-sidebar-state')).toBe('collapsed');
  });

  it('is not a click once it has been dragged', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    move(350);
    release();
    fireEvent.click(separator);

    expect(scope.getAttribute('data-sidebar-state')).toBe('default');
  });

  it('goes back to being a click after the drag it swallowed', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    move(350);
    release();
    fireEvent.click(separator);
    fireEvent.click(separator);

    expect(scope.getAttribute('data-sidebar-state')).toBe('collapsed');
  });

  it('ignores a move that belongs to another pointer', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    move(400, 2);

    expect(widthOf(scope)).toBe('300px');
  });

  it('ignores a release that belongs to another pointer', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    release(2);

    expect(scope.getAttribute('data-sidebar-gesture')).toBe('active');
  });

  it('collapses when dragged into the snap zone, but not on its edge', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    move(199);
    expect(scope.getAttribute('data-sidebar-state')).toBe('collapsed');

    move(200);
    expect(scope.getAttribute('data-sidebar-state')).toBe('default');
    expect(widthOf(scope)).toBe('200px');
  });

  it('takes over the cursor while dragging and hands it back', () => {
    const { separator } = renderSidebar();
    document.body.style.cursor = 'auto';
    document.body.style.userSelect = 'auto';

    press(separator, 300);
    move(350);
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    release();

    expect(document.body.style.cursor).toBe('auto');
    expect(document.body.style.userSelect).toBe('auto');
  });

  it('hands the cursor back even if the sidebar goes away mid-drag', () => {
    const { separator, unmount } = renderSidebar();
    document.body.style.cursor = 'auto';

    press(separator, 300);
    move(350);
    expect(document.body.style.cursor).toBe('col-resize');

    unmount();

    expect(document.body.style.cursor).toBe('auto');
  });

  it('stops following the pointer once the drag is over', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    move(350);
    release();
    move(420);

    expect(widthOf(scope)).toBe('350px');
  });

  it('remembers the width the drag settled on', () => {
    const { separator } = renderSidebar();

    press(separator, 300);
    move(350);
    release();

    expect(window.localStorage.getItem('sidebar:width')).toBe('350');
    expect(window.localStorage.getItem('sidebar:state')).toBe('default');
  });

  it('drops its border and hides its contents when it collapses to nothing at all', () => {
    const { scope } = renderSidebar({ defaultState: 'collapsed', collapsedWidth: 0 });
    const sidebar = scope.querySelector('.sidebar-layout');

    expect(sidebar?.classList.contains('border-r-0')).toBe(true);
    expect(sidebar?.firstElementChild?.classList.contains('opacity-0')).toBe(true);
  });

  it('keeps its contents in reach while it still has a collapsed strip', () => {
    const { scope } = renderSidebar({ defaultState: 'collapsed', collapsedWidth: 48 });
    const sidebar = scope.querySelector('.sidebar-layout');

    expect(sidebar?.firstElementChild?.classList.contains('opacity-0')).toBe(false);
  });

  it('ends the drag when the pointer gesture is cancelled', () => {
    const { scope, separator } = renderSidebar();
    document.body.style.cursor = 'auto';

    press(separator, 300);
    move(350);
    fireEvent(window, pointerEvent('pointercancel', { pointerId: 1 }));

    expect(scope.getAttribute('data-sidebar-gesture')).toBeNull();
    expect(document.body.style.cursor).toBe('auto');
  });

  it('lets go of the pointer for good once the drag is over', () => {
    const { separator } = renderSidebar();
    document.body.style.cursor = 'auto';

    press(separator, 300);
    move(350);
    release();

    // A stray release afterwards must not reach back into the finished drag.
    document.body.style.cursor = 'text';
    release();
    fireEvent(window, pointerEvent('pointercancel', { pointerId: 1 }));

    expect(document.body.style.cursor).toBe('text');
  });

  it('takes a new snap zone as soon as it is given one', () => {
    const panel = (collapseBelow: number) => (
      <MainSidebarProvider
        defaultState="default"
        defaultWidth={300}
        minWidth={200}
        maxWidth={480}
        collapseBelow={collapseBelow}
      >
        <MainSidebar>
          <MainSidebar.Nav>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents' }} />
            </MainSidebar.NavList>
          </MainSidebar.Nav>
        </MainSidebar>
      </MainSidebarProvider>
    );

    mockMatchMedia(false);
    const { rerender } = render(panel(100));
    const scope = document.querySelector('[data-sidebar-scope]') as HTMLElement;

    rerender(panel(280));

    press(screen.getByRole('separator'), 300);
    move(250);

    expect(scope.getAttribute('data-sidebar-state')).toBe('collapsed');
  });

  it('follows the pointer back towards where the drag started', () => {
    const { scope, separator } = renderSidebar();

    press(separator, 300);
    move(350);
    move(302);

    expect(widthOf(scope)).toBe('302px');
  });

  it('keeps its border while it still has a collapsed strip', () => {
    const { scope } = renderSidebar({ defaultState: 'collapsed', collapsedWidth: 48 });
    const sidebar = scope.querySelector('.sidebar-layout');

    expect(sidebar?.classList.contains('border-r-0')).toBe(false);
  });

  it('keeps its border while it is open', () => {
    const { scope } = renderSidebar({ collapsedWidth: 0 });
    const sidebar = scope.querySelector('.sidebar-layout');

    expect(sidebar?.classList.contains('border-r-0')).toBe(false);
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
