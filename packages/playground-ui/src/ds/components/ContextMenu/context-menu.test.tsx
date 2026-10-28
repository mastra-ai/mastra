// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContextMenu } from './context-menu';

const setPlatform = (value: string) => {
  Object.defineProperty(navigator, 'platform', { value, configurable: true });
};

const originalPlatform = navigator.platform;

afterEach(() => {
  cleanup();
  setPlatform(originalPlatform);
});

function ControlledMenu() {
  const [open, setOpen] = useState(false);
  return (
    <ContextMenu open={open} onOpenChange={setOpen}>
      <ContextMenu.Trigger render={<a href="/session" />}>Session</ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item>Pin session</ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  );
}

describe('ContextMenu', () => {
  it.each(['controlled', 'uncontrolled'])('allows the next right-click to open the native menu (%s)', async mode => {
    if (mode === 'controlled') render(<ControlledMenu />);
    else {
      render(
        <ContextMenu>
          <ContextMenu.Trigger render={<a href="/session" />}>Session</ContextMenu.Trigger>
          <ContextMenu.Content>
            <ContextMenu.Item>Pin session</ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu>,
      );
    }
    const trigger = screen.getByRole('link', { name: 'Session' });
    expect(fireEvent.contextMenu(trigger)).toBe(false);
    await screen.findByRole('menuitem', { name: 'Pin session' });
    fireEvent.pointerDown(trigger, { button: 2 });
    expect(fireEvent.contextMenu(trigger)).toBe(true);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(fireEvent.contextMenu(trigger)).toBe(false);
    await screen.findByRole('menuitem', { name: 'Pin session' });
  });

  it('allows the next macOS Control-click to open the native menu', async () => {
    setPlatform('MacIntel');
    render(<ControlledMenu />);
    const trigger = screen.getByRole('link', { name: 'Session' });
    fireEvent.contextMenu(trigger);
    await screen.findByRole('menuitem', { name: 'Pin session' });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: true });
    expect(fireEvent.contextMenu(trigger)).toBe(true);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it.each([
    ['a left-click', 'MacIntel', { button: 0 }],
    ['a Windows Control-click', 'Win32', { button: 0, ctrlKey: true }],
  ])('keeps the app menu for a keyboard context menu after %s dismissed it', async (_press, platform, press) => {
    setPlatform(platform);
    render(<ControlledMenu />);
    const trigger = screen.getByRole('link', { name: 'Session' });
    fireEvent.contextMenu(trigger);
    await screen.findByRole('menuitem', { name: 'Pin session' });
    fireEvent.pointerDown(trigger, press);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    fireEvent.keyDown(trigger, { key: 'F10', shiftKey: true });
    expect(fireEvent.contextMenu(trigger)).toBe(false);
    await screen.findByRole('menuitem', { name: 'Pin session' });
  });

  it('allows a native menu on the popup and does not activate its action', async () => {
    const onClick = vi.fn();
    render(
      <ContextMenu>
        <ContextMenu.Trigger>Session</ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item onClick={onClick}>Delete session</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText('Session'));
    const item = await screen.findByRole('menuitem', { name: 'Delete session' });
    expect(fireEvent.contextMenu(item)).toBe(true);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders Label standalone without throwing (no Group ancestor required)', () => {
    expect(() => render(<ContextMenu.Label>Heading</ContextMenu.Label>)).not.toThrow();
  });

  it('mounts every menu part inside an open menu without throwing', () => {
    expect(() =>
      render(
        <ContextMenu defaultOpen>
          <ContextMenu.Trigger>Right click here</ContextMenu.Trigger>
          <ContextMenu.Content
            alignOffset={4}
            collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
            collisionBoundary={document.body}
            collisionPadding={8}
            positionMethod="fixed"
            sticky
          >
            <ContextMenu.Label>Top-level label</ContextMenu.Label>
            <ContextMenu.Separator />
            <ContextMenu.Group>
              <ContextMenu.Label>Group label</ContextMenu.Label>
              <ContextMenu.Item>Default item</ContextMenu.Item>
              <ContextMenu.Item disabled>Disabled item</ContextMenu.Item>
              <ContextMenu.Item variant="destructive">Destructive item</ContextMenu.Item>
            </ContextMenu.Group>
            <ContextMenu.Separator />
            <ContextMenu.CheckboxItem checked>Checkbox</ContextMenu.CheckboxItem>
            <ContextMenu.RadioGroup value="a">
              <ContextMenu.RadioItem value="a">Radio A</ContextMenu.RadioItem>
              <ContextMenu.RadioItem value="b">Radio B</ContextMenu.RadioItem>
            </ContextMenu.RadioGroup>
            <ContextMenu.Separator />
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger>Submenu</ContextMenu.SubTrigger>
              <ContextMenu.SubContent
                alignOffset={-2}
                arrowPadding={6}
                collisionBoundary={document.body}
                disableAnchorTracking
                positionMethod="fixed"
              >
                <ContextMenu.Item>Sub item</ContextMenu.Item>
              </ContextMenu.SubContent>
            </ContextMenu.Sub>
            <ContextMenu.Item>
              <span>Item</span>
              <ContextMenu.Shortcut>Ctrl+K</ContextMenu.Shortcut>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu>,
      ),
    ).not.toThrow();
  });

  it('accepts Base UI positioning props on menu content', () => {
    render(
      <ContextMenu defaultOpen>
        <ContextMenu.Trigger>Right click here</ContextMenu.Trigger>
        <ContextMenu.Content
          anchor={document.body}
          arrowPadding={6}
          collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
          collisionBoundary={document.body}
          collisionPadding={8}
          positionMethod="fixed"
          sticky
        >
          <ContextMenu.Item>Positioned action</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>,
    );

    expect(screen.getByRole('menuitem', { name: 'Positioned action' })).toBeTruthy();
  });

  it('fires the onSelect handler when an item is clicked', () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu defaultOpen>
        <ContextMenu.Trigger>Right click here</ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item onSelect={onSelect}>Run action</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Run action' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('fires the onClick handler when an item is clicked', () => {
    const onClick = vi.fn();
    render(
      <ContextMenu defaultOpen>
        <ContextMenu.Trigger>Right click here</ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item onClick={onClick}>Run action</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu>,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Run action' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
