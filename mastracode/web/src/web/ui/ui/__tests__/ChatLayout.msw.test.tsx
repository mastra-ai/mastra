import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatLayout } from '../ChatLayout';

afterEach(() => {
  delete window.mastracodeDesktop;
});

function getBackdrop(container: HTMLElement) {
  const backdrop = container.querySelector('div[aria-hidden="true"]');
  expect(backdrop).not.toBeNull();
  return backdrop as HTMLDivElement;
}

describe('ChatLayout', () => {
  describe('given all slots are provided', () => {
    it('renders the sidebar, header, content, and footer slots', () => {
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

  describe('given header and footer are omitted', () => {
    it('still renders the required sidebar and content slots', () => {
      render(<ChatLayout sidebar={<div>sidebar-slot</div>} content={<div>content-slot</div>} />);

      expect(screen.getByText('sidebar-slot')).toBeInTheDocument();
      expect(screen.getByText('content-slot')).toBeInTheDocument();
      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    });
  });

  describe('given the sidebar is open on mobile', () => {
    it('shows a backdrop that closes the sidebar on click', async () => {
      const onSidebarClose = vi.fn();
      const { container } = render(
        <ChatLayout sidebar={<div />} content={<div />} sidebarOpen onSidebarClose={onSidebarClose} />,
      );

      const backdrop = getBackdrop(container);
      expect(backdrop.className).toContain('opacity-100');

      await userEvent.click(backdrop);
      expect(onSidebarClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('given the sidebar is closed', () => {
    it('keeps the backdrop invisible and inert', () => {
      const { container } = render(<ChatLayout sidebar={<div />} content={<div />} />);

      const backdrop = getBackdrop(container);
      expect(backdrop.className).toContain('opacity-0');
      expect(backdrop.className).toContain('pointer-events-none');
    });
  });

  describe('given the UI is hosted by the desktop app', () => {
    it('reserves the macOS window controls and exposes a native drag region', () => {
      window.mastracodeDesktop = {
        getAppInfo: vi.fn(async () => ({
          name: 'MastraCode Desktop Alpha',
          version: 'test',
          platform: 'darwin' as const,
        })),
        selectProjectDirectory: vi.fn(async () => ({ canceled: true })),
      };

      const { container } = render(<ChatLayout sidebar={<div />} content={<div />} />);
      const layout = container.firstElementChild;

      expect(layout).toHaveClass('pt-10');
      expect(container.querySelector('.mastracode-desktop-drag-region')).toBeInTheDocument();
    });
  });
});
