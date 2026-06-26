// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContextMenu } from './context-menu';

afterEach(() => {
  cleanup();
});

describe('ContextMenu', () => {
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
