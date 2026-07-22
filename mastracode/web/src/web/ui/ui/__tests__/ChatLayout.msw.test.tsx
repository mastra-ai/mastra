import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatLayout } from '../ChatLayout';

function StatefulRightPanel() {
  const [label, setLabel] = useState('closed');

  return (
    <button type="button" onClick={() => setLabel('opened')}>
      right-panel-{label}
    </button>
  );
}
function mockMobileViewport() {
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
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChatLayout', () => {
  describe('given all chat slots are provided', () => {
    it('renders the sidebar, header, content, and pinned footer', () => {
      render(
        <ChatLayout
          sidebar={<div>sidebar-slot</div>}
          header={<div>header-slot</div>}
          content={<div>content-slot</div>}
          footer={<div>footer-slot</div>}
        />,
      );

      expect(screen.getByText('sidebar-slot')).toBeInTheDocument();
      expect(screen.getByText('header-slot')).toBeInTheDocument();
      expect(screen.getByText('content-slot')).toBeInTheDocument();
      expect(screen.getByText('footer-slot')).toBeInTheDocument();
    });
  });

  describe('given a complete main slot', () => {
    it('uses it instead of the content and footer arrangement', () => {
      render(
        <ChatLayout
          sidebar={<div>sidebar-slot</div>}
          content={<div>content-slot</div>}
          footer={<div>footer-slot</div>}
          main={<div>main-slot</div>}
        />,
      );

      expect(screen.getByText('main-slot')).toBeInTheDocument();
      expect(screen.queryByText('content-slot')).not.toBeInTheDocument();
      expect(screen.queryByText('footer-slot')).not.toBeInTheDocument();
    });
  });

  describe('given the right panel changes between compact and expanded', () => {
    it('keeps the existing panel mounted so internal viewer state is preserved', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ChatLayout
          sidebar={<div />}
          content={<div />}
          rightPanel={<StatefulRightPanel />}
          rightPanelExpanded={false}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'right-panel-closed' }));
      expect(screen.getByRole('button', { name: 'right-panel-opened' })).toBeInTheDocument();

      rerender(
        <ChatLayout sidebar={<div />} content={<div />} rightPanel={<StatefulRightPanel />} rightPanelExpanded />,
      );

      expect(screen.getByRole('button', { name: 'right-panel-opened' })).toBeInTheDocument();
    });

    it('closes the panel from its top-right toggle', async () => {
      const onRightPanelClose = vi.fn();
      const user = userEvent.setup();
      render(
        <ChatLayout
          sidebar={<div />}
          content={<div />}
          rightPanel={<div>workspace-panel</div>}
          onRightPanelClose={onRightPanelClose}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Close workspace files' }));

      expect(onRightPanelClose).toHaveBeenCalledOnce();
    });

    it('can remove and restore the right panel repeatedly', () => {
      const { rerender } = render(
        <ChatLayout sidebar={<div />} content={<div />} rightPanel={<div>workspace-panel</div>} />,
      );

      rerender(<ChatLayout sidebar={<div />} content={<div />} />);
      rerender(<ChatLayout sidebar={<div />} content={<div />} rightPanel={<div>workspace-panel</div>} />);

      expect(screen.getByText('workspace-panel')).toBeInTheDocument();
    });
  });
  describe('given a workspace panel on mobile', () => {
    it('opens the panel from the top-right drawer trigger', async () => {
      mockMobileViewport();
      const user = userEvent.setup();

      render(
        <ChatLayout
          sidebar={<div />}
          content={<div>chat-content</div>}
          rightPanel={<div>workspace-panel</div>}
        />,
      );

      await user.click(await screen.findByRole('button', { name: 'Open workspace files' }));

      expect(screen.getByText('workspace-panel')).toBeVisible();
    });
  });

});
