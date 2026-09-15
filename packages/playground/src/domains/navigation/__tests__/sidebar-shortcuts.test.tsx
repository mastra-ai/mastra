// @vitest-environment jsdom
import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarShortcuts } from '@/domains/navigation/components/sidebar-shortcuts';

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

const StateProbe = () => {
  const { state } = useMainSidebar();
  return <div data-testid="sidebar-state">{state}</div>;
};

const renderSidebar = () =>
  render(
    <KeyboardShortcutsProvider>
      <MainSidebarProvider>
        <SidebarShortcuts />
        <StateProbe />
        <textarea data-testid="composer" />
      </MainSidebarProvider>
    </KeyboardShortcutsProvider>,
  );

const sidebarState = () => screen.getByTestId('sidebar-state').textContent;

beforeEach(() => {
  window.localStorage.clear();
  mockMatchMedia(false); // desktop
});

afterEach(() => cleanup());

describe('SidebarShortcuts', () => {
  it('pressing [ collapses an open sidebar', () => {
    renderSidebar();
    expect(sidebarState()).toBe('default');

    fireEvent.keyDown(window, { key: '[' });

    expect(sidebarState()).toBe('collapsed');
  });

  it('pressing [ again re-expands it', () => {
    renderSidebar();

    fireEvent.keyDown(window, { key: '[' });
    expect(sidebarState()).toBe('collapsed');

    fireEvent.keyDown(window, { key: '[' });
    expect(sidebarState()).toBe('default');
  });

  it('[ typed inside a textarea does not toggle the sidebar', () => {
    renderSidebar();

    fireEvent.keyDown(screen.getByTestId('composer'), { key: '[' });

    expect(sidebarState()).toBe('default');
  });

  it('{ does not toggle the sidebar', () => {
    renderSidebar();

    fireEvent.keyDown(window, { key: '{', shiftKey: true });

    expect(sidebarState()).toBe('default');
  });
});
