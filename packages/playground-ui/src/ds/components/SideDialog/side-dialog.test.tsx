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
});
