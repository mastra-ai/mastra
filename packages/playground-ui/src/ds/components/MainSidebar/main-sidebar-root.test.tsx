// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainSidebar } from './main-sidebar';
import { MainSidebarProvider } from './main-sidebar-context';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => cleanup());

describe('MainSidebar mobile drawer', () => {
  it('opens as an accessible dialog on mobile', () => {
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
    expect(screen.getByRole('link', { name: 'Agents' })).toBeDefined();
  });
});
