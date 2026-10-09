import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';

import { useComposerAutofocus } from '../use-composer-autofocus';

const Harness = ({ threadId, disabled }: { threadId?: string; disabled?: boolean }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useComposerAutofocus(ref, { threadId, disabled });
  return <textarea ref={ref} aria-label="composer" defaultValue="draft" disabled={disabled} />;
};

describe('useComposerAutofocus', () => {
  describe('when mounted enabled', () => {
    it('focuses the textarea with the caret at the end', () => {
      render(<Harness threadId="t1" />);
      const textarea = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'composer' });
      expect(document.activeElement).toBe(textarea);
      expect(textarea.selectionStart).toBe('draft'.length);
    });
  });

  describe('when threadId changes', () => {
    it('refocuses the textarea', () => {
      const { rerender } = render(<Harness threadId="t1" />);
      const textarea = screen.getByRole('textbox', { name: 'composer' });
      textarea.blur();
      rerender(<Harness threadId="t2" />);
      expect(document.activeElement).toBe(textarea);
    });
  });

  describe('when disabled', () => {
    it('does not focus the textarea', () => {
      render(<Harness threadId="t1" disabled />);
      expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'composer' }));
    });
  });

  describe('when disabled becomes false', () => {
    it('focuses the textarea', () => {
      const { rerender } = render(<Harness threadId="t1" disabled />);
      rerender(<Harness threadId="t1" disabled={false} />);
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'composer' }));
    });
  });
});
