// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SideDialog } from './side-dialog';

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
