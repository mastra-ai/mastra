// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../Button';
import { DropdownMenu } from './dropdown-menu';

afterEach(() => {
  cleanup();
});

describe('DropdownMenu.Trigger', () => {
  it('renders a design-system Button by default', () => {
    render(
      <DropdownMenu>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('data-variant')).toBe('default');
  });

  it('forwards variant and size to the Button', () => {
    render(
      <DropdownMenu>
        <DropdownMenu.Trigger variant="ghost" size="sm" className="tabular-nums">
          Open
        </DropdownMenu.Trigger>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger.getAttribute('data-variant')).toBe('ghost');
    expect(trigger.className).toContain('tabular-nums');
  });

  it('lets a custom render element own the look', () => {
    render(
      <DropdownMenu>
        <DropdownMenu.Trigger variant="ghost" render={<Button variant="primary">Open</Button>} />
      </DropdownMenu>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('data-variant')).toBe('primary');
  });

  it('still supports the legacy asChild prop', () => {
    render(
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button variant="primary">Open</Button>
        </DropdownMenu.Trigger>
      </DropdownMenu>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('data-variant')).toBe('primary');
  });

  it('uses tooltip as the accessible name of an icon-only trigger', () => {
    render(
      <DropdownMenu>
        <DropdownMenu.Trigger size="icon-sm" tooltip="More actions">
          <svg />
        </DropdownMenu.Trigger>
      </DropdownMenu>,
    );

    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
  });
});

describe('DropdownMenu', () => {
  describe('when a compact menu action is selected', () => {
    it('runs the action and keeps sizing props off the DOM', () => {
      const onSelect = vi.fn();
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
          <DropdownMenu.Content size="sm">
            <DropdownMenu.Item size="sm" onSelect={onSelect}>
              Download CSV
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>,
      );
      const item = screen.getByRole('menuitem', { name: 'Download CSV' });
      expect(screen.getByRole('menu').hasAttribute('size')).toBe(false);
      expect(item.hasAttribute('size')).toBe(false);
      fireEvent.click(item);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

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

  it('names a RadioSub row after its selected option and checks it in the submenu', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: 'mine' | 'all') => void>();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.RadioSub label="Owner" options={ownerOptions} value="mine" onValueChange={onValueChange} />
        </DropdownMenu.Content>
      </DropdownMenu>,
    );

    await openSubmenuByKeyboard(user, /^Owner\s*Mine$/);
    expect((await screen.findByRole('menuitemradio', { name: 'Mine' })).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: 'Everyone' }).getAttribute('aria-checked')).toBe('false');

    await user.click(screen.getByRole('menuitemradio', { name: 'Everyone' }));

    expect(onValueChange).toHaveBeenCalledWith('all');
  });

  it('shows no hint for an unknown RadioSub value and still reports the picked option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: string) => void>();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.RadioSub
            label="Owner"
            options={ownerOptions}
            value="former-member"
            onValueChange={onValueChange}
          />
        </DropdownMenu.Content>
      </DropdownMenu>,
    );

    await openSubmenuByKeyboard(user, 'Owner');
    await user.click(await screen.findByRole('menuitemradio', { name: 'Everyone' }));

    expect(onValueChange).toHaveBeenCalledWith('all');
  });

  it('checks the selected RadioOptions item and reports a pick with the option value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: 'newest' | 'oldest') => void>();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.RadioOptions
            options={[
              { value: 'newest', label: 'Newest' },
              { value: 'oldest', label: 'Oldest' },
            ]}
            value="newest"
            onValueChange={onValueChange}
          />
        </DropdownMenu.Content>
      </DropdownMenu>,
    );

    expect(screen.getByRole('menuitemradio', { name: 'Newest' }).getAttribute('aria-checked')).toBe('true');

    await user.click(screen.getByRole('menuitemradio', { name: 'Oldest' }));

    expect(onValueChange).toHaveBeenCalledWith('oldest');
  });
});

const ownerOptions = [
  { value: 'mine', label: 'Mine' },
  { value: 'all', label: 'Everyone' },
] as const;

async function openSubmenuByKeyboard(user: UserEvent, subTriggerName: string | RegExp) {
  act(() => screen.getByRole('menuitem', { name: subTriggerName }).focus());
  await user.keyboard('{ArrowRight}');
}
