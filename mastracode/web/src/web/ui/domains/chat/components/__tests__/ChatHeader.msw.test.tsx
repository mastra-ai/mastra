import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChatHeader } from '../ChatHeader';

function SidebarStateProbe() {
  const { openMobile } = useMainSidebar();
  return <output data-testid="sidebar-state">{openMobile ? 'open' : 'closed'}</output>;
}

describe('ChatHeader', () => {
  describe('when the user clicks the sidebar toggle', () => {
    it('opens the design-system mobile sidebar', async () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(
        <MainSidebarProvider storageKey="chat-header-test" mobileBreakpoint={10_000}>
          <ChatHeader />
          <SidebarStateProbe />
        </MainSidebarProvider>,
      );

      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('closed');

      await userEvent.click(screen.getByLabelText('Open navigation menu'));
      expect(screen.getByTestId('sidebar-state')).toHaveTextContent('open');
    });
  });
});
