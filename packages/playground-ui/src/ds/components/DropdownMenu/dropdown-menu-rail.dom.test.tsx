import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvatarRail } from '../AvatarRail/index';
import { DropdownMenu } from './dropdown-menu';

function AccountMenu({ select }: { select: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenu.IdentityTrigger aria-label="Justin menu" aria-haspopup="dialog" avatar={<span>J</span>}>
        Justin Levine
      </DropdownMenu.IdentityTrigger>
      <DropdownMenu.Content
        aria-label="Account menu"
        rail={
          <AvatarRail aria-label="Organizations">
            <AvatarRail.Item aria-label="Mastra" current>
              M
            </AvatarRail.Item>
            <AvatarRail.Item aria-label="Acme" onClick={select}>
              A
            </AvatarRail.Item>
          </AvatarRail>
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

describe('DropdownMenu with an avatar rail', () => {
  it('preserves the trigger label on ordinary menus', async () => {
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

  it('keeps the account layout without a rail column when rail is null', async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger aria-haspopup="dialog">Account</DropdownMenu.Trigger>
        <DropdownMenu.Content aria-label="Account menu" rail={null}>
          <DropdownMenu.Group role="menu" aria-label="Actions">
            <DropdownMenu.Item>Sign out</DropdownMenu.Item>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu>,
    );
    const popup = await screen.findByRole('dialog', { name: 'Account menu' });
    expect(popup.className).toContain('w-87');
    expect(popup.querySelector('[data-slot=dropdown-menu-rail]')).toBeNull();
    expect(popup.querySelector('[data-slot=dropdown-menu-actions]')).not.toBeNull();
  });

  it('moves between the rail and actions and restores focus on Escape', async () => {
    const select = vi.fn();
    const user = userEvent.setup();
    render(<AccountMenu select={select} />);
    await user.click(screen.getByRole('button', { name: 'Justin menu' }));
    expect(await screen.findByRole('dialog', { name: 'Account menu' })).toBeDefined();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mastra' }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Acme' }));
    expect(select).not.toHaveBeenCalled();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Account settings' }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Sign out' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Justin menu' }));
  });

  it('paints the highlighted item itself without a moving surface across the rail', async () => {
    const select = vi.fn();
    const user = userEvent.setup();
    render(<AccountMenu select={select} />);
    await user.click(screen.getByRole('button', { name: 'Justin menu' }));
    const popup = await screen.findByRole('dialog', { name: 'Account menu' });
    const account = screen.getByRole('menuitem', { name: 'Account settings' });
    const signOut = screen.getByRole('menuitem', { name: 'Sign out' });
    await user.hover(account);
    expect(account.hasAttribute('data-highlighted')).toBe(true);
    expect(account.className).toContain('data-highlighted:bg-fill-subtle');
    expect(account.className).toContain('data-highlighted:text-foreground');
    await user.hover(signOut);
    expect(account.hasAttribute('data-highlighted')).toBe(false);
    expect(signOut.hasAttribute('data-highlighted')).toBe(true);
    expect(signOut.className).toContain('data-highlighted:bg-fill-subtle');
    await user.hover(screen.getByRole('button', { name: 'Acme' }));
    expect(popup.querySelector('[data-slot=fluid-hover-highlight]')).toBeNull();
    expect(popup.querySelector('[data-fluid-hover-active]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mastra' }).getAttribute('aria-current')).toBe('true');
    expect(select).not.toHaveBeenCalled();
  });
});
