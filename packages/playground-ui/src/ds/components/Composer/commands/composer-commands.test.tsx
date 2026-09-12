// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CommandComposer } from '../../../../../.storybook/fixtures/command-composer';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

function messageInput() {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
}

describe('Composer commands', () => {
  describe('when the user types a slash prefix', () => {
    it('filters commands and completes the selection without submitting', () => {
      render(<CommandComposer initialValue="" />);
      const input = messageInput();
      input.focus();
      fireEvent.change(input, { target: { value: '/rev' } });
      expect(screen.getAllByRole('option')).toHaveLength(1);
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input.value).toBe('/review ');
      expect(screen.getByRole('listbox', { name: '/review options' })).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('Ready');
      expect(document.activeElement).toBe(input);
    });

    it('wraps arrow navigation and exposes the active option to the textarea', () => {
      render(<CommandComposer />);
      const input = messageInput();
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      const selected = screen.getByRole('option', { selected: true });
      expect(selected.textContent).toContain('/summarize');
      expect(input.getAttribute('aria-activedescendant')).toBe(selected.id);
      expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByRole('option', { selected: true }).textContent).toContain('/review');
    });

    it('resets navigation when the query changes and when the menu is reopened', () => {
      render(<CommandComposer />);
      const input = messageInput();
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.change(input, { target: { value: '/r' } });
      expect(screen.getByRole('option', { selected: true }).textContent).toContain('/review');
      fireEvent.change(input, { target: { value: '/' } });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input.value).toBe('');
      expect(input.getAttribute('aria-activedescendant')).toBeNull();
      fireEvent.change(input, { target: { value: '/' } });
      expect(screen.getByRole('option', { selected: true }).textContent).toContain('/review');
    });
  });

  describe('when a command has options', () => {
    it('submits the selected option with the command name', () => {
      render(<CommandComposer initialValue="/review " />);
      const input = messageInput();
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(screen.getByRole('status').textContent).toBe('Submitted: /review attachments');
      expect(input.value).toBe('');
      expect(document.activeElement).toBe(input);
    });

    it('returns to commands with Escape and the back button', () => {
      render(<CommandComposer initialValue="/review " />);
      const input = messageInput();
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input.value).toBe('/review');
      fireEvent.keyDown(input, { key: 'Enter' });
      const back = screen.getByRole('button', { name: 'Back to slash commands' });
      back.focus();
      fireEvent.click(back);
      expect(input.value).toBe('/review');
      expect(document.activeElement).toBe(input);
    });

    it('supports pointer selection and filters options by their value', () => {
      render(<CommandComposer />);
      fireEvent.click(screen.getByRole('option', { name: /\/review / }));
      fireEvent.change(messageInput(), { target: { value: '/review att' } });
      expect(screen.getAllByRole('option')).toHaveLength(1);
      fireEvent.click(screen.getByRole('option', { name: /Attachment previews/ }));
      expect(screen.getByRole('status').textContent).toBe('Submitted: /review attachments');
      expect(document.activeElement).toBe(messageInput());
    });
  });

  describe('when the caller owns normal submission', () => {
    it.each(['/summarize', '/review custom arguments', '/unknown'])('preserves the submitted text %s', value => {
      render(<CommandComposer initialValue={value} />);
      fireEvent.keyDown(messageInput(), { key: 'Enter' });
      expect(screen.getByRole('status').textContent).toBe(`Submitted: ${value}`);
    });

    it('leaves Shift+Enter and Shift+Tab to the caller', () => {
      render(<CommandComposer />);
      expect(fireEvent.keyDown(messageInput(), { key: 'Enter', shiftKey: true })).toBe(true);
      expect(fireEvent.keyDown(messageInput(), { key: 'Tab', shiftKey: true })).toBe(true);
      expect(messageInput().value).toBe('/');
    });

    it.each([{ isComposing: true }, { keyCode: 229 }])('does not select or submit during IME composition %j', flags => {
      render(<CommandComposer initialValue="/review " />);
      fireEvent.keyDown(messageInput(), { key: 'Enter', ...flags });
      expect(messageInput().value).toBe('/review ');
      expect(screen.getByRole('status').textContent).toBe('Ready');
    });
  });

  describe('when command availability changes', () => {
    it('stops intercepting keys when disabled', () => {
      const { rerender } = render(<CommandComposer />);
      rerender(<CommandComposer enabled={false} />);
      expect(messageInput().getAttribute('aria-controls')).toBeNull();
      expect(fireEvent.keyDown(messageInput(), { key: 'Tab' })).toBe(true);
    });

    it('keeps selection valid when the command list shrinks', () => {
      const { rerender } = render(<CommandComposer />);
      fireEvent.keyDown(messageInput(), { key: 'ArrowDown' });
      rerender(<CommandComposer commands={[{ name: 'available', description: 'Available command' }]} />);
      fireEvent.keyDown(messageInput(), { key: 'Tab' });
      expect(messageInput().value).toBe('/available ');
      rerender(<CommandComposer commands={[]} />);
      expect(messageInput().getAttribute('aria-activedescendant')).toBeNull();
    });
  });
});
