import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvatarRail } from './index';

function renderRail(select: () => void) {
  render(
    <AvatarRail aria-label="Organizations">
      <AvatarRail.Item aria-label="Mastra" current onClick={select}>
        M
      </AvatarRail.Item>
      <AvatarRail.Item aria-label="Unavailable" disabled>
        U
      </AvatarRail.Item>
      <AvatarRail.Item aria-label="Acme" onClick={select}>
        A
      </AvatarRail.Item>
      <AvatarRail.Item aria-label="Create an organization">+</AvatarRail.Item>
    </AvatarRail>,
  );
  return userEvent.setup();
}

describe('AvatarRail', () => {
  describe('when it renders', () => {
    it('names the toolbar and marks only the current organization', () => {
      renderRail(vi.fn());
      expect(screen.getByRole('toolbar', { name: 'Organizations' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Mastra' }).getAttribute('aria-current')).toBe('true');
      expect(screen.getByRole('button', { name: 'Acme' }).hasAttribute('aria-current')).toBe(false);
    });
  });

  describe('when an organization is clicked', () => {
    it('activates it', async () => {
      const select = vi.fn();
      const user = renderRail(select);
      await user.click(screen.getByRole('button', { name: 'Acme' }));
      expect(select).toHaveBeenCalledOnce();
    });
  });

  describe('when arrow keys move focus', () => {
    it('skips disabled items without activating anything', async () => {
      const select = vi.fn();
      const user = renderRail(select);
      await user.tab();
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Acme' }));
      expect(select).not.toHaveBeenCalled();
    });

    it('activates the focused item with Enter', async () => {
      const select = vi.fn();
      const user = renderRail(select);
      await user.tab();
      await user.keyboard('{ArrowDown}{Enter}');
      expect(select).toHaveBeenCalledOnce();
    });
  });
});
