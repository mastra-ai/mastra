// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Button } from '@/ds/components/Button';

afterEach(() => {
  cleanup();
});

describe('Dialog', () => {
  it('mounts every dialog part inside an open dialog without throwing', () => {
    expect(() =>
      render(
        <Dialog defaultOpen>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Title</DialogTitle>
              <DialogDescription>Description</DialogDescription>
            </DialogHeader>
            <DialogBody>Body content</DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      ),
    ).not.toThrow();

    expect(screen.getByRole('heading', { name: 'Title' })).toBeDefined();
    expect(screen.getByText('Body content')).toBeDefined();
  });

  it('renders the overlay by default and allows it to be disabled', () => {
    const { rerender } = render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>With overlay</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(document.querySelector('.dialog-overlay-anim')).not.toBeNull();

    rerender(
      <Dialog defaultOpen>
        <DialogContent showOverlay={false}>
          <DialogTitle>No overlay</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(document.querySelector('.dialog-overlay-anim')).toBeNull();
  });

  it('applies custom classes to the overlay', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent overlayClassName="custom-overlay bg-surface1/40 backdrop-blur-none">
          <DialogTitle>Custom overlay</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const overlay = document.querySelector('.dialog-overlay-anim');
    expect(overlay?.className).toContain('custom-overlay');
    expect(overlay?.className).toContain('bg-surface1/40');
    expect(overlay?.className).toContain('backdrop-blur-none');
    expect(overlay?.className).not.toContain('backdrop-blur-xs');
  });

  it('renders an asChild Trigger as the child element without nesting buttons', () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    expect(trigger.querySelector('button')).toBeNull();
  });

  it('opens the dialog when the trigger is clicked', () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Revealed title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByText('Revealed title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByText('Revealed title')).toBeDefined();
  });

  it('fires onOpenChange when the built-in close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('fires onOpenChange when an asChild DialogClose is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});
