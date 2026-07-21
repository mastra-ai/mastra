import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PageLayoutMainViewProvider } from '../../../../ui/PageLayout';
import { ChatHeader } from '../ChatHeader';

function SidebarStateProbe() {
  const { openMobile } = useMainSidebar();
  return <output data-testid="sidebar-state">{openMobile ? 'open' : 'closed'}</output>;
}

function DesktopSidebarStateProbe() {
  const { desktopState } = useMainSidebar();
  return <output data-testid="desktop-sidebar-state">{desktopState}</output>;
}

function mockMobileViewport(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('ChatHeader', () => {
  describe('when the user clicks the sidebar toggle', () => {
    it('opens the design-system mobile sidebar', async () => {
      mockMobileViewport(true);

      render(
        <PageLayoutMainViewProvider mobileHeader={<h1>Settings</h1>}>
          <MainSidebarProvider storageKey="chat-header-test" mobileBreakpoint={10_000}>
            <ChatHeader />
            <SidebarStateProbe />
          </MainSidebarProvider>
        </PageLayoutMainViewProvider>,
      );

      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('closed');
      expect(within(screen.getByRole('banner')).getByRole('heading', { name: 'Settings' })).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Open navigation menu'));
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('open');
    });

    it('reopens a fully collapsed desktop sidebar from the top-left toggle', async () => {
      mockMobileViewport(false);

      render(
        <MainSidebarProvider
          defaultState="collapsed"
          storageKey="chat-header-desktop-test"
          collapsedWidth={0}
          mobileBreakpoint={768}
        >
          <ChatHeader />
          <DesktopSidebarStateProbe />
        </MainSidebarProvider>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle sidebar' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('desktop-sidebar-state')).toHaveTextContent('collapsed');

      await userEvent.click(trigger);

      expect(screen.getByTestId('desktop-sidebar-state')).toHaveTextContent('default');
      expect(screen.queryByRole('button', { name: 'Toggle sidebar' })).not.toBeInTheDocument();
    });
  });
});
