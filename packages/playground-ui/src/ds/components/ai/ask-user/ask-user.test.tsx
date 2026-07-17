// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AskUser } from './ask-user';
import type { AskUserPayload } from './ask-user';

const renderAskUser = (payload: AskUserPayload, overrides: Partial<ComponentProps<typeof AskUser>> = {}) => {
  const onSubmit = vi.fn();
  render(<AskUser payload={payload} onSubmit={onSubmit} {...overrides} />);
  return { onSubmit };
};

afterEach(cleanup);

describe('AskUser', () => {
  describe('when free text is requested', () => {
    it('submits trimmed text with Enter or the submit button', () => {
      const { onSubmit } = renderAskUser({ question: 'What is your name?' });
      const input = screen.getByRole('textbox', { name: 'What is your name?' });

      fireEvent.change(input, { target: { value: '  Ada  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onSubmit).toHaveBeenLastCalledWith('Ada');

      fireEvent.change(input, { target: { value: 'Grace' } });
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
      expect(onSubmit).toHaveBeenLastCalledWith('Grace');
    });

    it('does not submit empty text', () => {
      const { onSubmit } = renderAskUser({ question: 'What is your name?' });
      const input = screen.getByRole('textbox');
      const submit = screen.getByRole('button', { name: 'Submit answer' });

      expect((submit as HTMLButtonElement).disabled).toBe(true);
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when single selection is requested', () => {
    it('renders descriptions and immediately submits the chosen label', () => {
      const { onSubmit } = renderAskUser({
        question: 'Pick a fruit',
        options: [{ label: 'Apple', description: 'A red fruit' }, { label: 'Banana' }],
        selectionMode: 'single_select',
      });

      expect(screen.getByText('A red fruit')).toBeTruthy();
      fireEvent.click(screen.getByRole('radio', { name: /Apple/ }));
      expect(onSubmit).toHaveBeenCalledOnce();
      expect(onSubmit).toHaveBeenCalledWith('Apple');
    });
  });

  describe('when multiple selection is requested', () => {
    it('submits selected labels only after confirmation', () => {
      const { onSubmit } = renderAskUser({
        question: 'Pick toppings',
        options: [{ label: 'Cheese' }, { label: 'Olives' }],
        selectionMode: 'multi_select',
      });
      const group = screen.getByRole('group', { name: 'Pick toppings' });
      const submit = within(group).getByRole('button', { name: 'Submit answer' });

      expect((submit as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(within(group).getByRole('checkbox', { name: 'Cheese' }));
      fireEvent.click(within(group).getByRole('checkbox', { name: 'Olives' }));
      expect(onSubmit).not.toHaveBeenCalled();
      fireEvent.click(submit);
      expect(onSubmit).toHaveBeenCalledWith(['Cheese', 'Olives']);
    });
  });

  describe('when submission is pending', () => {
    it('disables controls and announces the pending state', () => {
      renderAskUser(
        { question: 'Pick a fruit', options: [{ label: 'Apple' }], selectionMode: 'single_select' },
        { isSubmitting: true },
      );

      expect((screen.getByRole('radio', { name: 'Apple' }) as HTMLInputElement).disabled).toBe(true);
      expect(screen.getByText('Submitting…')).toBeTruthy();
    });
  });

  describe('when an answer result exists', () => {
    it('shows answered and error output without interactive controls', () => {
      const { rerender } = render(
        <AskUser
          payload={{ question: 'Pick a fruit', options: [{ label: 'Apple' }] }}
          result={{ content: 'User answered: Apple', isError: false }}
          onSubmit={vi.fn()}
        />,
      );

      expect(screen.getByText('Answered')).toBeTruthy();
      expect(screen.getByText('User answered: Apple')).toBeTruthy();
      expect(screen.queryByRole('radio')).toBeNull();

      rerender(
        <AskUser
          payload={{ question: 'Pick a fruit' }}
          result={{ content: 'Unable to resume', isError: true }}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.getByText('Error')).toBeTruthy();
      expect(screen.getByRole('alert').textContent).toContain('Unable to resume');
    });
  });

  describe('when optional payload data is absent or malformed', () => {
    it('falls back to free text for absent or empty options and ignores malformed options', () => {
      const { rerender } = render(<AskUser payload={{ question: 'Answer me', options: [] }} onSubmit={vi.fn()} />);
      expect(screen.getByRole('textbox')).toBeTruthy();

      rerender(
        <AskUser
          payload={{ question: 'Answer me', options: [{ label: '' }, null] as unknown as AskUserPayload['options'] }}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.getByRole('textbox')).toBeTruthy();
    });
  });
});
