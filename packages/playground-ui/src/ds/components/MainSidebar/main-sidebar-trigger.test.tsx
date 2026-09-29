// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainSidebarProvider } from './main-sidebar-provider';
import { MainSidebarTrigger } from './main-sidebar-trigger';
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

describe('MainSidebarTrigger tooltip', () => {
  it('advertises the [ shortcut next to the label', async () => {
    render(
      <TooltipProvider delay={0}>
        <MainSidebarProvider>
          <MainSidebarTrigger />
        </MainSidebarProvider>
      </TooltipProvider>,
    );

    fireEvent.focus(screen.getByRole('button', { name: 'Toggle sidebar' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Toggle Sidebar');
    expect(tooltip.querySelector('kbd')?.textContent).toBe('[');
  });
});
