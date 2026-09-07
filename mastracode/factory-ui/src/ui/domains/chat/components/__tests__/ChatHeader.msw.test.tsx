import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import { OverlaysProvider } from '../../../../lib/overlays';
import { SettingsHeader } from '../../../settings/components/SettingsHeader';
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
    <MemoryRouter initialEntries={['/settings/preferences']}>
      <MainSidebarProvider storageKey="chat-header-test" mobileBreakpoint={10_000}>
        <OverlaysProvider>
          <ChatHeader mobileContent={<SettingsHeader autoFocus placement="mobile" />} />
          <SidebarStateProbe />
        </OverlaysProvider>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

describe('ChatHeader', () => {
  it('renders and focuses the mobile content passed by the page', () => {
    renderMobileHeader();

    const mobileHeader = screen.getByRole('banner');
    expect(within(mobileHeader).getByRole('heading', { name: 'Preferences' })).toHaveFocus();
    // The mobile settings header intentionally has no close button — navigation happens through the drawer.
    expect(within(mobileHeader).queryByRole('button', { name: 'Close settings' })).not.toBeInTheDocument();
    expect(within(mobileHeader).getByRole('button', { name: 'Search and navigate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle sidebar' })).not.toBeInTheDocument();
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
        <OverlaysProvider>
          <ChatHeader />
          <DesktopSidebarStateProbe />
        </OverlaysProvider>
      </MainSidebarProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(screen.getByRole('button', { name: 'Search and navigate' })).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('desktop-sidebar-state')).toHaveTextContent('collapsed');
    expect(screen.queryByLabelText('Open navigation menu')).not.toBeInTheDocument();

    await userEvent.click(trigger);

    expect(screen.getByTestId('desktop-sidebar-state')).toHaveTextContent('default');
    expect(screen.queryByRole('button', { name: 'Toggle sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });
});
