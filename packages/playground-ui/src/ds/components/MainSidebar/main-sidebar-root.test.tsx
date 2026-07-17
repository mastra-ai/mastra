// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainSidebar } from './main-sidebar';
import { MainSidebarProvider } from './main-sidebar-context';

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
