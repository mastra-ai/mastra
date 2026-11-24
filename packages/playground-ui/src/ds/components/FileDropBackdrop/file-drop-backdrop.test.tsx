// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileDropBackdrop } from './file-drop-backdrop';

afterEach(() => {
  cleanup();
});

type DragEventType = 'dragenter' | 'dragover' | 'dragleave' | 'drop';

const dragEvent = (
  type: DragEventType,
  { files = [], types = ['Files'] }: { files?: File[]; types?: string[] } = {},
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { types, files } });
  return event;
};

const fire = (event: Event) => {
  act(() => {
    fireEvent(window, event);
  });
  return event;
};

const file = (name: string, type: string) => new File(['content'], name, { type });

const renderBackdrop = (props: Partial<Parameters<typeof FileDropBackdrop>[0]> = {}) => {
  const onFilesDrop = vi.fn();
  const utils = render(
    <FileDropBackdrop onFilesDrop={onFilesDrop} {...props}>
      <input aria-label="Message" />
    </FileDropBackdrop>,
  );
  return { ...utils, onFilesDrop };
};

describe('FileDropBackdrop', () => {
  describe('given a wrapped field', () => {
    it('when nothing is being dragged then renders the field without a backdrop', () => {
      renderBackdrop();

      expect(screen.getByRole('textbox', { name: 'Message' })).toBeTruthy();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('when a file enters the window then shows a full-page backdrop portaled to the body', () => {
      const { container } = renderBackdrop();

      fire(dragEvent('dragenter'));

      const backdrop = screen.getByRole('status');
      expect(backdrop.textContent).toContain('Drop to upload');
      expect(container.contains(backdrop)).toBe(false);
      expect(document.body.contains(backdrop)).toBe(true);
    });

    it('when text (not a file) is dragged then does not show the backdrop', () => {
      renderBackdrop();

      fire(dragEvent('dragenter', { types: ['text/plain'] }));

      expect(screen.queryByRole('status')).toBeNull();
    });

    it('when the file leaves the window then hides the backdrop', () => {
      renderBackdrop();

      fire(dragEvent('dragenter'));
      fire(dragEvent('dragleave'));

      expect(screen.queryByRole('status')).toBeNull();
    });

    it('when dragging over nested elements (two enters, one leave) then keeps the backdrop visible', () => {
      renderBackdrop();

      fire(dragEvent('dragenter'));
      fire(dragEvent('dragenter'));
      fire(dragEvent('dragleave'));

      expect(screen.getByRole('status')).toBeTruthy();
    });

    it('when the file is dropped then calls onFilesDrop with the files and hides the backdrop', () => {
      const { onFilesDrop } = renderBackdrop();
      const dropped = [file('notes.txt', 'text/plain')];

      fire(dragEvent('dragenter'));
      const over = fire(dragEvent('dragover'));
      const drop = fire(dragEvent('drop', { files: dropped }));

      expect(onFilesDrop).toHaveBeenCalledWith(dropped);
      expect(screen.queryByRole('status')).toBeNull();
      expect(over.defaultPrevented).toBe(true);
      expect(drop.defaultPrevented).toBe(true);
    });

    it('when the file is dropped then fades the backdrop out before removing it, without delaying onFilesDrop', () => {
      vi.useFakeTimers();
      try {
        const { onFilesDrop } = renderBackdrop();
        const dropped = [file('notes.txt', 'text/plain')];

        fire(dragEvent('dragenter'));
        fire(dragEvent('drop', { files: dropped }));

        expect(onFilesDrop).toHaveBeenCalledTimes(1);
        const closing = document.querySelector('[data-slot="file-drop-backdrop"]');
        expect(closing?.getAttribute('data-state')).toBe('closed');

        act(() => {
          vi.runAllTimers();
        });
        expect(document.querySelector('[data-slot="file-drop-backdrop"]')).toBeNull();
        expect(onFilesDrop).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('given an accept filter', () => {
    it('when mixed files are dropped then only forwards matching files', () => {
      const { onFilesDrop } = renderBackdrop({ accept: 'image/*,.pdf' });
      const png = file('a.png', 'image/png');
      const pdf = file('b.pdf', 'application/pdf');
      const txt = file('c.txt', 'text/plain');

      fire(dragEvent('dragenter'));
      fire(dragEvent('drop', { files: [png, pdf, txt] }));

      expect(onFilesDrop).toHaveBeenCalledWith([png, pdf]);
    });

    it('when no dropped file matches then does not call onFilesDrop', () => {
      const { onFilesDrop } = renderBackdrop({ accept: 'image/*' });

      fire(dragEvent('dragenter'));
      fire(dragEvent('drop', { files: [file('c.txt', 'text/plain')] }));

      expect(onFilesDrop).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  describe('given a custom label', () => {
    it('when a file is dragged then shows the custom label', () => {
      renderBackdrop({ label: 'Drop images here' });

      fire(dragEvent('dragenter'));

      expect(screen.getByRole('status').textContent).toContain('Drop images here');
    });
  });

  describe('given no description', () => {
    it('when a file is dragged then explains what happens on release', () => {
      renderBackdrop();

      fire(dragEvent('dragenter'));

      expect(screen.getByRole('status').textContent).toContain('Release to attach your files.');
    });
  });

  describe('given a custom description', () => {
    it('when a file is dragged then shows the custom description', () => {
      renderBackdrop({ description: 'Only images are accepted.' });

      fire(dragEvent('dragenter'));

      expect(screen.getByRole('status').textContent).toContain('Only images are accepted.');
    });
  });

  describe('given disabled', () => {
    it('when a file is dragged and dropped then shows nothing and does not call onFilesDrop', () => {
      const { onFilesDrop } = renderBackdrop({ disabled: true });

      fire(dragEvent('dragenter'));
      expect(screen.queryByRole('status')).toBeNull();

      fire(dragEvent('drop', { files: [file('notes.txt', 'text/plain')] }));
      expect(onFilesDrop).not.toHaveBeenCalled();
    });
  });

  describe('given an unmounted component', () => {
    it('when a file is dragged then no listener reacts', () => {
      const { unmount, onFilesDrop } = renderBackdrop();
      unmount();

      fire(dragEvent('dragenter'));
      fire(dragEvent('drop', { files: [file('notes.txt', 'text/plain')] }));

      expect(screen.queryByRole('status')).toBeNull();
      expect(onFilesDrop).not.toHaveBeenCalled();
    });
  });
});
