// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu } from '@/ds/components/ContextMenu';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const setupUser = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

const openDropdown = async () => {
  render(
    <DropdownMenu>
      <DropdownMenu.Trigger>Account</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.CopyItem value="org_1">Copy organization ID</DropdownMenu.CopyItem>
        <DropdownMenu.Item>Settings</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>,
  );
  await setupUser().click(screen.getByRole('button', { name: 'Account' }));
};

const openContextMenu = async () => {
  render(
    <ContextMenu>
      <ContextMenu.Trigger>Acme</ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.CopyItem value="org_1">Copy organization ID</ContextMenu.CopyItem>
        <ContextMenu.Item>Settings</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>,
  );
  fireEvent.contextMenu(screen.getByText('Acme'));
};

const copyItem = () => screen.findByRole('menuitem', { name: 'Copy organization ID' });
const waitForClose = () => act(() => vi.advanceTimersByTimeAsync(1000));

describe.each([
  ['DropdownMenu', openDropdown],
  ['ContextMenu', openContextMenu],
])('%s.CopyItem', (_menu, openMenu) => {
  it('shows the copy on the item, then closes the menu', async () => {
    const user = setupUser();
    await openMenu();

    await user.click(await copyItem());

    expect(await screen.findByRole('menuitem', { name: 'Copied' })).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe('org_1');
    await waitForClose();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('stays open when the pointer has moved on to another item', async () => {
    const user = setupUser();
    await openMenu();
    await user.click(await copyItem());
    await screen.findByRole('menuitem', { name: 'Copied' });

    await user.hover(screen.getByRole('menuitem', { name: 'Settings' }));
    await waitForClose();

    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('stays open when a second press fails after the first one copied', async () => {
    const user = setupUser();
    await openMenu();
    let allowFirst = () => {};
    vi.spyOn(navigator.clipboard, 'writeText')
      .mockImplementationOnce(() => new Promise(resolve => (allowFirst = resolve)))
      .mockImplementationOnce(() => new Promise((_, reject) => setTimeout(reject, 200)));
    const item = await copyItem();

    await user.click(item);
    await user.click(item);
    allowFirst();

    expect(await screen.findByRole('menuitem', { name: 'Failed' })).toBeTruthy();
    await waitForClose();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('stays open and says so when the browser blocks the copy', async () => {
    const user = setupUser();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
    await openMenu();

    await user.click(await copyItem());

    expect(await screen.findByRole('menuitem', { name: 'Failed' })).toBeTruthy();
    await waitForClose();
    expect(screen.getByRole('menu')).toBeTruthy();
  });
});
