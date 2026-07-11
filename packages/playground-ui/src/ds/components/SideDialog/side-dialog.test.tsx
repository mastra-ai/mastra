// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { SideDialog } from './side-dialog';

// Base UI's Select synthesizes PointerEvents on interaction, which jsdom does
// not implement. Polyfill it with the available MouseEvent constructor.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => cleanup());

describe('SideDialog', () => {
  it('renders an accessible dialog when open', () => {
    render(
      <SideDialog dialogTitle="Run details" dialogDescription="Review the selected run." isOpen>
        <SideDialog.Content>Dialog body</SideDialog.Content>
      </SideDialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Run details' })).toBeDefined();
    expect(screen.getByText('Dialog body')).toBeDefined();
    expect(document.querySelector('[data-slot="drawer-popup"]')?.getAttribute('data-swipe-direction')).toBe('right');
  });

  it('calls onClose from the built-in close button', () => {
    const onClose = vi.fn();

    render(
      <SideDialog dialogTitle="Run details" dialogDescription="Review the selected run." isOpen onClose={onClose}>
        <SideDialog.Content>Dialog body</SideDialog.Content>
      </SideDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the body as Base UI Drawer.Content so pointer drags select text instead of swiping', () => {
    render(
      <SideDialog dialogTitle="Run details" dialogDescription="Review the selected run." isOpen>
        <SideDialog.Content>
          <span>Selectable body</span>
        </SideDialog.Content>
      </SideDialog>,
    );

    const body = screen.getByText('Selectable body').closest('[data-drawer-content]');
    expect(body).not.toBeNull();
  });

  // Regression: a Select portaled to document.body lands outside Base UI's modal
  // FloatingFocusManager region and is unclickable. But portaling it merely inside
  // the drawer popup is not enough — outside a `data-drawer-content` region, a
  // pointerdown on an option starts a drawer swipe that captures the pointer, so
  // the click never commits. SideDialog advertises a swipe-exempt mount point.
  it('portals a nested Select into a swipe-exempt drawer-content region', async () => {
    render(
      <SideDialog dialogTitle="Save item" dialogDescription="Save data as a dataset item" isOpen>
        <SideDialog.Content>
          <Select defaultValue="apple">
            <SelectTrigger>
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
            </SelectContent>
          </Select>
        </SideDialog.Content>
      </SideDialog>,
    );

    fireEvent.click(screen.getByRole('combobox'));

    const option = await screen.findByRole('option', { name: 'Banana' });

    // Inside the drawer (the modal region)…
    expect(document.querySelector('[data-slot="drawer-popup"]')?.contains(option)).toBe(true);
    // …and inside a [data-drawer-content] region, so Base UI's Drawer skips
    // swipe-to-dismiss and the option's pointerdown/click commits the selection.
    expect(option.closest('[data-drawer-content]')).not.toBeNull();
  });

  it('leaves a standalone Select portaling to document.body (no SideDialog container)', async () => {
    render(
      <Select defaultValue="apple">
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );

    fireEvent.click(screen.getByRole('combobox'));

    const option = await screen.findByRole('option', { name: 'Banana' });
    await waitFor(() => expect(option.closest('[data-slot="drawer-popup"]')).toBeNull());
  });

  it('supports nested levels through Drawer stacking', () => {
    render(
      <SideDialog dialogTitle="Run details" dialogDescription="Review the selected run." isOpen level={1}>
        <SideDialog.Content>
          Parent body
          <SideDialog dialogTitle="Trace details" dialogDescription="Review the selected trace." isOpen level={2}>
            <SideDialog.Content>Nested body</SideDialog.Content>
          </SideDialog>
        </SideDialog.Content>
      </SideDialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Trace details' })).toBeDefined();

    const popups = document.querySelectorAll('[data-slot="drawer-popup"]');
    expect(popups).toHaveLength(2);
    expect(popups[0]?.hasAttribute('data-nested-drawer-open')).toBe(true);
  });
});
