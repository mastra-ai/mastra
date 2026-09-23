import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import { OverlaysProvider } from '../../../../lib/overlays';
import { ChatPageLayout } from '../ChatPageLayout';

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

describe('ChatPageLayout', () => {
  it('renders no header on mobile — AppLayout owns the mobile trigger and search', () => {
    mockMobileViewport(true);
    render(
      <MemoryRouter initialEntries={['/settings/preferences']}>
        <MainSidebarProvider storageKey="chat-header-test" mobileBreakpoint={10_000}>
          <OverlaysProvider>
            <ChatPageLayout>body</ChatPageLayout>
          </OverlaysProvider>
        </MainSidebarProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle sidebar' })).not.toBeInTheDocument();
  });

  it('renders page content without shell controls while the desktop sidebar is open', () => {
    mockMobileViewport(false);
    render(
      <MainSidebarProvider storageKey="chat-header-desktop-test" collapsedWidth={0} mobileBreakpoint={768}>
        <OverlaysProvider>
          <ChatPageLayout crumbs={<li>Page title</li>}>body</ChatPageLayout>
        </OverlaysProvider>
      </MainSidebarProvider>,
    );

    const header = screen.getByRole('banner');
    expect(within(header).getByText('Page title')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search and navigate' })).not.toBeInTheDocument();
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
          <ChatPageLayout>body</ChatPageLayout>
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
