// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DialogNew } from '../DialogNew';
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

describe('DialogNew', () => {
  afterEach(() => vi.useRealTimers());

  describe('when a destructive confirmation is opened', () => {
    it('renders the consequence copy and named actions', () => {
      render(<DialogNewFixture />);
      expect(screen.getByRole('alertdialog', { name: 'Delete workspace?' })).toBeDefined();
      expect(screen.getByText('Uncommitted changes will be lost.')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    });
  });

  describe('when a hold is released early', () => {
    it('does not confirm', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<DialogNewFixture onConfirm={onConfirm} hold />);
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
      render(<DialogNewFixture onConfirm={onConfirm} hold />);
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
      render(<DialogNewFixture onConfirm={onConfirm} hold />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete workspace' }), { detail: 1 });
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when assistive technology activates a hold action', () => {
    it('confirms on the second activation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<DialogNewFixture onConfirm={onConfirm} hold />);
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
      render(<DialogNewFixture onConfirm={onConfirm} hold />);
      const button = screen.getByRole('button', { name: 'Delete workspace' });
      fireEvent.click(button, { detail: 0 });
      act(() => vi.advanceTimersByTime(5000));
      fireEvent.click(button, { detail: 0 });
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when the confirmation is pending', () => {
    it('disables both actions', () => {
      render(<DialogNewFixture pending />);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Delete workspace' }).disabled).toBe(true);
    });
  });
});

function DialogNewFixture({ onConfirm = () => {}, hold = false, pending = false, holdSeconds = 1.5 }) {
  return (
    <DialogNew defaultOpen variant="destructive" pending={pending}>
      <DialogNew.Content>
        <DialogNew.Header>
          <DialogNew.Title>Delete workspace?</DialogNew.Title>
          <DialogNew.Description>Uncommitted changes will be lost.</DialogNew.Description>
        </DialogNew.Header>
        <DialogNew.Footer>
          <DialogNew.Cancel>Cancel</DialogNew.Cancel>
          <DialogNew.Action holdSeconds={holdSeconds} onConfirm={onConfirm} confirmation={hold ? 'hold' : 'click'}>
            Delete workspace
          </DialogNew.Action>
        </DialogNew.Footer>
      </DialogNew.Content>
    </DialogNew>
  );
}

describe('DialogNew hold cancellation', () => {
  afterEach(() => vi.useRealTimers());

  describe.each(['blur', 'pointerLeave', 'pointerCancel'])('when %s interrupts a hold', eventName => {
    it('cancels the pending confirmation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<DialogNewFixture onConfirm={onConfirm} hold />);
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
      render(<DialogNewFixture onConfirm={onConfirm} hold />);
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
      const { unmount } = render(<DialogNewFixture onConfirm={onConfirm} hold />);
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
      const { rerender } = render(<DialogNewFixture onConfirm={onConfirm} hold />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Delete workspace' }), { key: ' ' });
      rerender(<DialogNewFixture onConfirm={onConfirm} hold pending />);
      act(() => vi.advanceTimersByTime(1600));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when an unrelated key is pressed', () => {
    it('does not start confirmation', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<DialogNewFixture onConfirm={onConfirm} hold />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Delete workspace' }), { key: 'a' });
      act(() => vi.advanceTimersByTime(1600));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when a regular action is confirmed', () => {
    it('leaves closing to its caller', () => {
      const onConfirm = vi.fn();
      render(<DialogNewFixture onConfirm={onConfirm} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete workspace' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alertdialog')).toBeDefined();
    });
  });

  describe('when a pending dialog receives Escape', () => {
    it('rejects the dismissal', () => {
      const onOpenChange = vi.fn();
      render(
        <DialogNew defaultOpen pending onOpenChange={onOpenChange}>
          <DialogNew.Content>
            <DialogNew.Title>Working</DialogNew.Title>
          </DialogNew.Content>
        </DialogNew>,
      );
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeDefined();
    });
  });
});

describe('DialogNew hold duration', () => {
  afterEach(() => vi.useRealTimers());

  describe('when holdSeconds is 2.5', () => {
    it('confirms only after the configured duration', () => {
      vi.useFakeTimers();
      const onConfirm = vi.fn();
      render(<DialogNewFixture hold holdSeconds={2.5} onConfirm={onConfirm} />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Delete workspace' }), { key: ' ' });
      act(() => vi.advanceTimersByTime(2499));
      expect(onConfirm).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});

describe('DialogNew pointer confirmation', () => {
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
      render(<DialogNewFixture hold onConfirm={onConfirm} />);
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
      render(<DialogNewFixture hold onConfirm={onConfirm} />);
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
      render(<DialogNewFixture hold onConfirm={onConfirm} />);
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
      render(<DialogNewFixture hold onConfirm={onConfirm} />);
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
        <DialogNew defaultOpen>
          <DialogNew.Content>
            <DialogNew.Title>Confirm</DialogNew.Title>
            <DialogNew.Action confirmation="hold" onConfirm={onConfirm} onKeyDown={event => event.preventDefault()}>
              Confirm
            </DialogNew.Action>
          </DialogNew.Content>
        </DialogNew>,
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
        <DialogNew defaultOpen onOpenChange={onOpenChange}>
          <DialogNew.Content>
            <DialogNew.Title>Confirm</DialogNew.Title>
            <DialogNew.Cancel>Cancel</DialogNew.Cancel>
          </DialogNew.Content>
        </DialogNew>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    });
  });
});
