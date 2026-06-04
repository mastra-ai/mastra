// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AlertDialog } from './alert-dialog';
import { Button } from '@/ds/components/Button';

afterEach(() => {
  cleanup();
});

describe('AlertDialog', () => {
  it('mounts every part inside an open alert dialog without throwing', () => {
    expect(() =>
      render(
        <AlertDialog open>
          <AlertDialog.Trigger>Open</AlertDialog.Trigger>
          <AlertDialog.Content>
            <AlertDialog.Header>
              <AlertDialog.Title>Title</AlertDialog.Title>
              <AlertDialog.Description>Description</AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Body>Body content</AlertDialog.Body>
            <AlertDialog.Footer>
              <AlertDialog.Action>Confirm</AlertDialog.Action>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog>,
      ),
    ).not.toThrow();

    expect(screen.getByRole('heading', { name: 'Title' })).toBeDefined();
    expect(screen.getByText('Body content')).toBeDefined();
  });

  it('renders an asChild Trigger as the child element without nesting buttons', () => {
    render(
      <AlertDialog>
        <AlertDialog.Trigger asChild>
          <Button>Open alert</Button>
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Title>Title</AlertDialog.Title>
        </AlertDialog.Content>
      </AlertDialog>,
    );

    const trigger = screen.getByRole('button', { name: 'Open alert' });
    expect(trigger.querySelector('button')).toBeNull();
  });

  it('opens the alert dialog when the trigger is clicked', () => {
    render(
      <AlertDialog>
        <AlertDialog.Trigger asChild>
          <Button>Open alert</Button>
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Title>Revealed title</AlertDialog.Title>
        </AlertDialog.Content>
      </AlertDialog>,
    );

    expect(screen.queryByText('Revealed title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open alert' }));
    expect(screen.getByText('Revealed title')).toBeDefined();
  });

  it('closes via Action and runs its onClick handler', () => {
    const onOpenChange = vi.fn();
    const onAction = vi.fn();
    render(
      <AlertDialog open onOpenChange={onOpenChange}>
        <AlertDialog.Content>
          <AlertDialog.Title>Title</AlertDialog.Title>
          <AlertDialog.Footer>
            <AlertDialog.Action onClick={onAction}>Confirm</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('closes via Cancel', () => {
    const onOpenChange = vi.fn();
    render(
      <AlertDialog open onOpenChange={onOpenChange}>
        <AlertDialog.Content>
          <AlertDialog.Title>Title</AlertDialog.Title>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});
