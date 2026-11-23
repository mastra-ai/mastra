// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarSearchTrigger } from '../header/sidebar-search-trigger';
import { useSidebar } from './sidebar-context';
import { SidebarProvider } from './sidebar-provider';
import { SidebarTrigger } from './sidebar-trigger';
import { TooltipProvider } from '@/ds/components/Tooltip';

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
  mockMatchMedia(false);
});

afterEach(() => cleanup());

describe('SidebarTrigger tooltip', () => {
  it('advertises the [ shortcut next to the label', async () => {
    render(
      <TooltipProvider delay={0}>
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      </TooltipProvider>,
    );

    fireEvent.focus(screen.getByRole('button', { name: 'Toggle sidebar' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Toggle sidebar');
    expect(tooltip.querySelector('kbd')?.textContent).toBe('[');
  });
});

describe('SidebarSearchTrigger tooltip', () => {
  it('shows the shortcut in the tooltip instead of beside the icon', async () => {
    render(
      <TooltipProvider delay={0}>
        <SidebarSearchTrigger shortcut="⌘ K" />
      </TooltipProvider>,
    );

    const button = screen.getByRole('button', { name: 'Search' });
    expect(button.querySelector('kbd')).toBeNull();

    fireEvent.focus(button);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Search');
    expect(tooltip.querySelector('kbd')?.textContent).toBe('⌘ K');
  });
});

describe('SidebarProvider on a phone', () => {
  it('knows it is on a phone from the first render, so phone-only controls never pop in', () => {
    mockMatchMedia(true);
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useSidebar().isMobile);
      return null;
    }

    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    );

    expect(seen[0]).toBe(true);
  });

  it('hydrates server HTML on a phone without a mismatch, then switches to the phone layout', async () => {
    const tree = (
      <TooltipProvider>
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      </TooltipProvider>
    );
    mockMatchMedia(false);
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);
    mockMatchMedia(true);
    const hydrationErrors: unknown[] = [];

    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError: error => hydrationErrors.push(error) });
    });

    expect(hydrationErrors).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Toggle sidebar' })).toBeNull();
    container.remove();
  });
});
