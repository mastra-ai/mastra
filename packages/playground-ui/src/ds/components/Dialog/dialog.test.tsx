// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormEvent } from 'react';
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
  DialogAction,
  DialogCancel,
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
              <DialogClose render={<Button>Cancel</Button>} />
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

    expect(document.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull();

    rerender(
      <Dialog defaultOpen>
        <DialogContent showOverlay={false}>
          <DialogTitle>No overlay</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
  });

  it('applies custom classes to the overlay', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent overlayClassName="custom-overlay bg-sidebar/40 backdrop-blur-none">
          <DialogTitle>Custom overlay</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay?.className).toContain('custom-overlay');
    expect(overlay?.className).toContain('bg-sidebar/40');
    expect(overlay?.className).toContain('backdrop-blur-none');
    expect(overlay?.className).not.toContain('backdrop-blur-xs');
  });

  it('opens the dialog when the trigger is clicked', () => {
    render(
      <Dialog>
        <DialogTrigger render={<Button>Open dialog</Button>} />
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

  it('omits the built-in close button when showCloseButton is false', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('fires onOpenChange when a rendered DialogClose is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog defaultOpen onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogFooter>
            <DialogClose render={<Button>Cancel</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});

describe('Dialog confirmation', () => {
  afterEach(() => vi.useRealTimers());

  describe('when a destructive confirmation is opened', () => {
    it('renders the consequence copy and named actions', () => {
      render(<ConfirmationFixture />);
      expect(screen.getByRole('alertdialog', { name: 'Delete workspace?' })).toBeDefined();
      expect(screen.getByText('Uncommitted changes will be lost.')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    });
  });

  describe('when a hold is released early', () => {
    it('does not confirm', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      const button = screen.getByRole('button', { name: 'Delete workspace' });
      fireEvent.keyDown(button, { key: ' ' });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.keyUp(button, { key: ' ' });
      act(() => vi.advanceTimersByTime(1500));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when a keyboard hold completes', () => {
    it('confirms exactly once despite repeated keydown events', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      const button = screen.getByRole('button', { name: 'Delete workspace' });
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyDown(button, { key: 'Enter', repeat: true });
      act(() => vi.advanceTimersByTime(1500));
      fireEvent.keyDown(button, { key: 'Enter', repeat: true });
      fireEvent.click(button, { detail: 1 });
      act(() => vi.advanceTimersByTime(1500));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a hold action receives a mouse click', () => {
    it('does not bypass the hold', () => {
      const onConfirm = vi.fn();
      render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete workspace' }), { detail: 1 });
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when assistive technology activates a hold action', () => {
    it('confirms on the second activation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      const button = screen.getByRole('button', { name: 'Delete workspace' });
      fireEvent.click(button, { detail: 0 });
      expect(onConfirm).not.toHaveBeenCalled();
      expect(screen.getByRole('status').textContent).toContain('Activate again');
      fireEvent.click(button, { detail: 0 });
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('disarms when the second activation is late', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      const button = screen.getByRole('button', { name: 'Delete workspace' });
      fireEvent.click(button, { detail: 0 });
      act(() => vi.advanceTimersByTime(5000));
      fireEvent.click(button, { detail: 0 });
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when the confirmation is pending', () => {
    it('disables both actions', () => {
      render(<ConfirmationFixture pending />);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Delete workspace' }).disabled).toBe(true);
    });
  });
});

function ConfirmationFixture({ onConfirm = () => {}, hold = false, pending = false, holdSeconds = 1.5 }) {
  return (
    <Dialog intent="destructive" defaultOpen pending={pending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete workspace?</DialogTitle>
          <DialogDescription>Uncommitted changes will be lost.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction holdSeconds={holdSeconds} onConfirm={onConfirm} confirmation={hold ? 'hold' : 'click'}>
            Delete workspace
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog hold cancellation', () => {
  afterEach(() => vi.useRealTimers());

  describe.each(['blur', 'pointerLeave', 'pointerCancel'])('when %s interrupts a hold', eventName => {
    it('cancels the pending confirmation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      const button = screen.getByRole('button', { name: 'Delete workspace' });
      fireEvent.keyDown(button, { key: ' ' });
      fireEvent[eventName](button);
      act(() => vi.advanceTimersByTime(1600));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when the window loses focus', () => {
    it('cancels the pending confirmation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Delete workspace' }), { key: ' ' });
      fireEvent(window, new Event('blur'));
      act(() => vi.advanceTimersByTime(1600));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when the hold action is unmounted', () => {
    it('clears its pending confirmation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      const { unmount } = render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Delete workspace' }), { key: ' ' });
      unmount();
      act(() => vi.advanceTimersByTime(1600));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when the action becomes disabled during a hold', () => {
    it('cancels the pending confirmation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      const { rerender } = render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Delete workspace' }), { key: ' ' });
      rerender(<ConfirmationFixture onConfirm={onConfirm} hold pending />);
      act(() => vi.advanceTimersByTime(1600));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when an unrelated key is pressed', () => {
    it('does not start confirmation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture onConfirm={onConfirm} hold />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Delete workspace' }), { key: 'a' });
      act(() => vi.advanceTimersByTime(1600));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when a regular action is confirmed', () => {
    it('leaves closing to its caller', () => {
      const onConfirm = vi.fn();
      render(<ConfirmationFixture onConfirm={onConfirm} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete workspace' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alertdialog')).toBeDefined();
    });
  });

  describe('when a pending dialog receives Escape', () => {
    it('rejects the dismissal', () => {
      const onOpenChange = vi.fn();
      render(
        <Dialog defaultOpen pending onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogTitle>Working</DialogTitle>
          </DialogContent>
        </Dialog>,
      );
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeDefined();
    });
  });
});

describe('Dialog hold duration', () => {
  afterEach(() => vi.useRealTimers());

  describe('when holdSeconds is 2.5', () => {
    it('confirms only after the configured duration', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture hold holdSeconds={2.5} onConfirm={onConfirm} />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Delete workspace' }), { key: ' ' });
      act(() => vi.advanceTimersByTime(2499));
      expect(onConfirm).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Dialog pointer confirmation', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe.each([
    { name: 'primary pointer', button: 0, primary: true, confirms: true },
    { name: 'secondary button', button: 2, primary: true, confirms: false },
    { name: 'non-primary pointer', button: 0, primary: false, confirms: false },
  ])('when a $name is held', ({ button, primary, confirms }) => {
    it('only confirms a primary left-button hold', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture hold onConfirm={onConfirm} />);
      const event = new MouseEvent('pointerdown', { bubbles: true, button });
      Object.defineProperty(event, 'isPrimary', { value: primary });
      fireEvent(screen.getByRole('button', { name: 'Delete workspace' }), event);
      act(() => vi.advanceTimersByTime(1500));
      expect(onConfirm).toHaveBeenCalledTimes(confirms ? 1 : 0);
    });
  });

  describe.each([true, false])('when document hidden becomes %s', hidden => {
    it('cancels only when the document is hidden', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture hold onConfirm={onConfirm} />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Delete workspace' }), { key: ' ' });
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);
      fireEvent(document, new Event('visibilitychange'));
      act(() => vi.advanceTimersByTime(1500));
      expect(onConfirm).toHaveBeenCalledTimes(hidden ? 0 : 1);
    });
  });

  describe('when the pointer is released before completion', () => {
    it('cancels confirmation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture hold onConfirm={onConfirm} />);
      const button = screen.getByRole('button', { name: 'Delete workspace' });
      const event = new MouseEvent('pointerdown', { bubbles: true, button: 0 });
      Object.defineProperty(event, 'isPrimary', { value: true });
      fireEvent(button, event);
      fireEvent.pointerUp(button);
      act(() => vi.advanceTimersByTime(1500));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when Enter is released before completion', () => {
    it('cancels confirmation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<ConfirmationFixture hold onConfirm={onConfirm} />);
      const button = screen.getByRole('button', { name: 'Delete workspace' });
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyUp(button, { key: 'Enter' });
      act(() => vi.advanceTimersByTime(1500));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when a custom keyboard handler prevents the hold', () => {
    it('does not confirm', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Confirm</DialogTitle>
            <DialogAction confirmation="hold" onConfirm={onConfirm} onKeyDown={event => event.preventDefault()}>
              Confirm
            </DialogAction>
          </DialogContent>
        </Dialog>,
      );
      fireEvent.keyDown(screen.getByRole('button', { name: 'Confirm' }), { key: ' ' });
      act(() => vi.advanceTimersByTime(1500));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when Cancel is clicked', () => {
    it('notifies the caller that the dialog closed', () => {
      const onOpenChange = vi.fn();
      render(
        <Dialog defaultOpen onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogTitle>Confirm</DialogTitle>
            <DialogCancel>Cancel</DialogCancel>
          </DialogContent>
        </Dialog>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    });
  });
});

describe('Dialog submit action', () => {
  function SubmitFixture({ onSubmit, pending = false }: { onSubmit: () => void; pending?: boolean }) {
    return (
      <Dialog defaultOpen pending={pending}>
        <DialogContent>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <DialogTitle>Rename</DialogTitle>
            <DialogFooter>
              <DialogAction type="submit">Save</DialogAction>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  describe('when the submit action is clicked', () => {
    it('submits the surrounding form and leaves the dialog open', () => {
      const onSubmit = vi.fn();
      render(<SubmitFixture onSubmit={onSubmit} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).toBeDefined();
    });
  });

  describe('when the dialog is pending', () => {
    it('disables the submit action', () => {
      render(<SubmitFixture onSubmit={vi.fn()} pending />);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(true);
    });
  });
});
