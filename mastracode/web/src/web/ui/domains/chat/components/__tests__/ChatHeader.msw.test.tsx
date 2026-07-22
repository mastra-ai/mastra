import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PageLayoutMainViewProvider } from '../../../../ui/PageLayout';
import { OverlaysProvider } from '../../../../lib/overlays';
import { SettingsHeader } from '../../../settings/components/SettingsHeader';
import { SettingsNavigationProvider } from '../../../settings/context/SettingsNavigationProvider';
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
  window.localStorage.removeItem('chat-header-test');
  window.localStorage.removeItem('chat-header-desktop-test');
});

function renderMobileHeader() {
  mockMobileViewport(true);
  render(
    <MainSidebarProvider storageKey="chat-header-test" mobileBreakpoint={10_000}>
      <OverlaysProvider>
        <SettingsNavigationProvider>
          <PageLayoutMainViewProvider mobileHeader={<SettingsHeader autoFocus placement="mobile" />}>
            <ChatHeader />
            <SidebarStateProbe />
          </PageLayoutMainViewProvider>
        </SettingsNavigationProvider>
      </OverlaysProvider>
    </MainSidebarProvider>,
  );
}

describe('ChatHeader', () => {
  it('renders and focuses the mobile settings header', () => {
    renderMobileHeader();

    const mobileHeader = screen.getByRole('banner');
    expect(within(mobileHeader).getByRole('heading', { name: 'General' })).toHaveFocus();
    expect(within(mobileHeader).getByRole('button', { name: 'Close settings' })).toBeInTheDocument();
  });

  it('opens the design-system mobile sidebar', async () => {
    renderMobileHeader();

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('closed');
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
