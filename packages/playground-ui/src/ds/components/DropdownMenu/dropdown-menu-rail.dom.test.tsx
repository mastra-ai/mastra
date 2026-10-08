import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvatarRail } from '../AvatarRail/index';
import { DropdownMenu } from './dropdown-menu';

function AccountMenu({ select, withRail = true }: { select: () => void; withRail?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenu.IdentityTrigger aria-label="Justin menu" aria-haspopup="dialog" avatar={<span>J</span>}>
        Justin Levine
      </DropdownMenu.IdentityTrigger>
      <DropdownMenu.Content
        aria-label="Account menu"
        layout="account"
        rail={
          withRail && (
            <AvatarRail aria-label="Organizations">
              <AvatarRail.Item aria-label="Mastra" current>
                M
              </AvatarRail.Item>
              <AvatarRail.Item aria-label="Acme" onClick={select}>
                A
              </AvatarRail.Item>
            </AvatarRail>
          )
        }
      >
        <DropdownMenu.Group role="menu" aria-label="Actions">
          <DropdownMenu.Item>Account settings</DropdownMenu.Item>
          <DropdownMenu.Item>Sign out</DropdownMenu.Item>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

async function openAccountMenu(props: { select: () => void; withRail?: boolean }) {
  const user = userEvent.setup();
  render(<AccountMenu {...props} />);
  await user.click(screen.getByRole('button', { name: 'Justin menu' }));
  const popup = await screen.findByRole('dialog', { name: 'Account menu' });
  return { user, popup };
}

describe('DropdownMenu.Content', () => {
  describe('when it uses the default menu layout', () => {
    it('takes its name from the trigger', async () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenu.Trigger>Account</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Settings</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>,
      );
      expect(await screen.findByRole('menu', { name: 'Account' })).toBeDefined();
    });
  });

  describe('when the account layout has no rail', () => {
    it('renders the actions without an organizations toolbar', async () => {
      const { popup } = await openAccountMenu({ select: vi.fn(), withRail: false });
      expect(screen.queryByRole('toolbar')).toBeNull();
      expect(popup.querySelector('[data-slot=dropdown-menu-rail]')).toBeNull();
      expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeDefined();
    });
  });

  describe('when the account layout has a rail', () => {
    it('moves focus from the actions to the current organization with ArrowLeft', async () => {
      const { user } = await openAccountMenu({ select: vi.fn() });
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mastra' }));
    });

    it('roves the rail without selecting an organization', async () => {
      const select = vi.fn();
      const { user } = await openAccountMenu({ select });
      await user.keyboard('{ArrowLeft}');
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Acme' }));
      expect(select).not.toHaveBeenCalled();
    });

    it('moves from the rail back to the actions with ArrowRight', async () => {
      const { user } = await openAccountMenu({ select: vi.fn() });
      await user.keyboard('{ArrowLeft}');
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Sign out' }));
    });

    it('closes on Escape and restores focus to the trigger', async () => {
      const { user } = await openAccountMenu({ select: vi.fn() });
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Justin menu' }));
    });

    it('highlights only the hovered action without a moving surface', async () => {
      const select = vi.fn();
      const { user, popup } = await openAccountMenu({ select });
      const account = screen.getByRole('menuitem', { name: 'Account settings' });
      const signOut = screen.getByRole('menuitem', { name: 'Sign out' });
      await user.hover(account);
      await user.hover(signOut);
      expect(account.hasAttribute('data-highlighted')).toBe(false);
      expect(signOut.hasAttribute('data-highlighted')).toBe(true);
      await user.hover(screen.getByRole('button', { name: 'Acme' }));
      expect(popup.querySelector('[data-slot=fluid-hover-highlight]')).toBeNull();
      expect(screen.getByRole('button', { name: 'Mastra' }).getAttribute('aria-current')).toBe('true');
      expect(select).not.toHaveBeenCalled();
    });
  });
});
