import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { ChatLayout } from '../ChatLayout';

function StatefulRightPanel() {
  const [label, setLabel] = useState('closed');

  return (
    <button type="button" onClick={() => setLabel('opened')}>
      right-panel-{label}
    </button>
  );
}

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

    it('uses the shipped compact and expanded widths', () => {
      const { rerender } = render(
        <ChatLayout sidebar={<div />} content={<div />} rightPanel={<div>right-panel-content</div>} />,
      );
      const panelContent = screen.getByText('right-panel-content');
      const panelFrame = panelContent.parentElement;
      if (!panelFrame) throw new Error('Right panel frame was not rendered');
      expect(panelFrame).toHaveStyle({ width: '320px' });

      rerender(
        <ChatLayout
          sidebar={<div />}
          content={<div />}
          rightPanel={<div>right-panel-content</div>}
          rightPanelExpanded
        />,
      );

      expect(panelFrame).toHaveStyle({ width: '720px' });
    });
  });

  describe('given the right panel is available but closed', () => {
    it('uses the existing Files reopen copy by default', () => {
      render(<ChatLayout sidebar={<div />} content={<div />} rightPanelAvailable />);

      expect(screen.getByRole('button', { name: 'Open workspace files' })).toHaveTextContent('Files');
    });

    it('supports contextual reopen copy without changing the trigger behavior', async () => {
      const user = userEvent.setup();
      let opened = 0;
      render(
        <ChatLayout
          sidebar={<div />}
          content={<div />}
          rightPanelAvailable
          rightPanelOpenLabel="Context"
          rightPanelOpenAriaLabel="Open task and workspace context"
          onRightPanelOpen={() => {
            opened += 1;
          }}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Open task and workspace context' }));

      expect(screen.getByRole('button', { name: 'Open task and workspace context' })).toHaveTextContent('Context');
      expect(opened).toBe(1);
    });
  });
});
