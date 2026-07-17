// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DropdownMenu } from './dropdown-menu';

afterEach(() => {
  cleanup();
});

describe('DropdownMenu', () => {
  it('renders Label standalone without throwing (no Group ancestor required)', () => {
    expect(() => render(<DropdownMenu.Label>Heading</DropdownMenu.Label>)).not.toThrow();
  });

  it('mounts every menu part inside an open menu without throwing', () => {
    expect(() =>
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
          <DropdownMenu.Content
            alignOffset={4}
            collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
            collisionBoundary={document.body}
            collisionPadding={8}
            positionMethod="fixed"
            sticky
          >
            <DropdownMenu.Label>Top-level label</DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.Label>Group label</DropdownMenu.Label>
              <DropdownMenu.Item>Default item</DropdownMenu.Item>
              <DropdownMenu.Item disabled>Disabled item</DropdownMenu.Item>
              <DropdownMenu.Item variant="destructive">Destructive item</DropdownMenu.Item>
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.CheckboxItem checked>Checkbox</DropdownMenu.CheckboxItem>
            <DropdownMenu.RadioGroup value="a">
              <DropdownMenu.RadioItem value="a">Radio A</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="b">Radio B</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator />
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>Submenu</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent
                alignOffset={-2}
                arrowPadding={6}
                collisionBoundary={document.body}
                disableAnchorTracking
                positionMethod="fixed"
              >
                <DropdownMenu.Item>Sub item</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <DropdownMenu.Item>
              <span>Item</span>
              <DropdownMenu.Shortcut>Ctrl+K</DropdownMenu.Shortcut>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>,
      ),
    ).not.toThrow();
  });

  it('accepts Base UI positioning props on menu content', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content
          anchor={document.body}
          arrowPadding={6}
          collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
          collisionBoundary={document.body}
          collisionPadding={8}
          positionMethod="fixed"
          sticky
        >
          <DropdownMenu.Item>Positioned action</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>,
    );

    expect(screen.getByRole('menuitem', { name: 'Positioned action' })).toBeTruthy();
  });

  it('fires the onSelect handler when an item is clicked', () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onSelect={onSelect}>Run action</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Run action' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('fires the onClick handler when an item is clicked', () => {
    const onClick = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onClick={onClick}>Run action</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Run action' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
