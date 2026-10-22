// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../Button';
import { Dialog, DialogContent, DialogTitle } from '../Dialog';
import { AlertDialog } from './alert-dialog';

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

  it('keeps Cancel usable while an enclosing Dialog is pending', () => {
    render(
      <Dialog open pending>
        <DialogContent>
          <DialogTitle>Outer</DialogTitle>
          <AlertDialog open>
            <AlertDialog.Content>
              <AlertDialog.Title>Inner</AlertDialog.Title>
              <AlertDialog.Footer>
                <AlertDialog.Cancel>Keep</AlertDialog.Cancel>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('button', { name: 'Keep' }).hasAttribute('disabled')).toBe(false);
  });

  it('opens the alert dialog when the trigger is clicked', () => {
    render(
      <AlertDialog>
        <AlertDialog.Trigger render={<Button>Open alert</Button>} />
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

describe('AlertDialog on a phone viewport', () => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      query =>
        ({
          matches: query === '(max-width: 639px)',
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) satisfies MediaQueryList,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens as a bottom drawer that still announces an alert and closes from Cancel', () => {
    const onOpenChange = vi.fn();
    render(
      <AlertDialog open onOpenChange={onOpenChange}>
        <AlertDialog.Content>
          <AlertDialog.Title>Delete dataset?</AlertDialog.Title>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Keep</AlertDialog.Cancel>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>,
    );

    const popup = screen.getByRole('alertdialog', { name: 'Delete dataset?' });
    expect(popup.classList.contains('drawer-popup')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});
