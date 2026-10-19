// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarSearchTrigger } from '../header/sidebar-search-trigger';
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
    expect(tooltip.textContent).toContain('Toggle Sidebar');
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
