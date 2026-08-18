// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AskUser } from './ask-user';
import type { AskUserPayload } from './ask-user';

const renderAskUser = (payload: AskUserPayload, overrides: Partial<ComponentProps<typeof AskUser>> = {}) => {
  const onSubmit = vi.fn();
  const utils = render(<AskUser payload={payload} onSubmit={onSubmit} {...overrides} />);
  return { ...utils, onSubmit };
};

afterEach(cleanup);

describe('AskUser', () => {
  describe('when free text is submitted with Enter', () => {
    it('submits the trimmed answer', () => {
      const { onSubmit } = renderAskUser({ question: 'What is your name?' });
      const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'What is your name?' });

      fireEvent.change(input, { target: { value: '  Ada  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSubmit).toHaveBeenCalledWith('Ada');
    });
  });

  describe('when free text is submitted with the button', () => {
    it('submits the trimmed answer', () => {
      const { onSubmit } = renderAskUser({ question: 'What is your name?' });
      fireEvent.change(screen.getByRole<HTMLInputElement>('textbox'), { target: { value: '  Grace  ' } });

      fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }));

      expect(onSubmit).toHaveBeenCalledWith('Grace');
    });
  });

  describe('when free text is empty', () => {
    it('disables the submit button', () => {
      renderAskUser({ question: 'What is your name?' });

      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }).disabled).toBe(true);
    });

    it('does not submit with Enter', () => {
      const { onSubmit } = renderAskUser({ question: 'What is your name?' });
      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when the free-text payload changes', () => {
    it('clears text entered for the previous question', () => {
      const { rerender, onSubmit } = renderAskUser({ question: 'What is your name?' });
      fireEvent.change(screen.getByRole<HTMLInputElement>('textbox'), { target: { value: 'Ada' } });

      rerender(<AskUser payload={{ question: 'Where do you live?' }} onSubmit={onSubmit} />);

      expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Where do you live?' }).value).toBe('');
    });
  });

  describe('when single selection includes a description', () => {
    it('renders the option description', () => {
      renderAskUser({
        question: 'Pick a fruit',
        options: [{ label: 'Apple', description: 'A red fruit' }, { label: 'Banana' }],
        selectionMode: 'single_select',
      });

      expect(screen.getByText('A red fruit')).toBeTruthy();
    });
  });

  describe('when a single selection is chosen', () => {
    it('submits the chosen label immediately', () => {
      const { onSubmit } = renderAskUser({
        question: 'Pick a fruit',
        options: [{ label: 'Apple' }, { label: 'Banana' }],
        selectionMode: 'single_select',
      });

      fireEvent.click(screen.getByRole<HTMLInputElement>('radio', { name: 'Apple' }));

      expect(onSubmit).toHaveBeenCalledWith('Apple');
    });
  });

  describe('when no multiple-selection option is selected', () => {
    it('disables the confirmation button', () => {
      renderAskUser({
        question: 'Pick toppings',
        options: [{ label: 'Cheese' }, { label: 'Olives' }],
        selectionMode: 'multi_select',
      });

      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }).disabled).toBe(true);
    });
  });

  describe('when multiple selections are toggled', () => {
    it('does not submit before confirmation', () => {
      const { onSubmit } = renderAskUser({
        question: 'Pick toppings',
        options: [{ label: 'Cheese' }, { label: 'Olives' }],
        selectionMode: 'multi_select',
      });

      fireEvent.click(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Cheese' }));
      fireEvent.click(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Olives' }));

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when multiple selections are confirmed', () => {
    it('submits the selected labels', () => {
      const { onSubmit } = renderAskUser({
        question: 'Pick toppings',
        options: [{ label: 'Cheese' }, { label: 'Olives' }],
        selectionMode: 'multi_select',
      });
      const group = screen.getByRole('group', { name: 'Pick toppings' });
      fireEvent.click(within(group).getByRole<HTMLInputElement>('checkbox', { name: 'Cheese' }));
      fireEvent.click(within(group).getByRole<HTMLInputElement>('checkbox', { name: 'Olives' }));

      fireEvent.click(within(group).getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }));

      expect(onSubmit).toHaveBeenCalledWith(['Cheese', 'Olives']);
    });
  });

  describe('when submission is pending', () => {
    const payload: AskUserPayload = {
      question: 'Pick a fruit',
      options: [{ label: 'Apple' }],
      selectionMode: 'single_select',
    };

    it('disables the option controls', () => {
      renderAskUser(payload, { isSubmitting: true });

      expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Apple' }).disabled).toBe(true);
    });

    it('announces the pending state', () => {
      renderAskUser(payload, { isSubmitting: true });

      expect(screen.getByRole('status').textContent).toBe('Submitting…');
    });
  });

  describe('when an answer result exists', () => {
    it('renders the answer without option controls', () => {
      renderAskUser(
        { question: 'Pick a fruit', options: [{ label: 'Apple' }] },
        { result: { content: 'User answered: Apple', isError: false } },
      );

      expect(screen.queryByRole('radio')).toBeNull();
      expect(screen.getByRole('status').textContent).toContain('User answered: Apple');
    });
  });

  describe('when an error result exists', () => {
    it('renders the error as an alert', () => {
      renderAskUser({ question: 'Pick a fruit' }, { result: { content: 'Unable to resume', isError: true } });

      expect(screen.getByRole('alert').textContent).toContain('Unable to resume');
    });
  });

  describe('when options are absent', () => {
    it('renders a free-text control', () => {
      renderAskUser({ question: 'Answer me' });

      expect(screen.getByRole('textbox')).toBeTruthy();
    });
  });

  describe('when options are empty or have empty labels', () => {
    it('renders a free-text control', () => {
      renderAskUser({ question: 'Answer me', options: [{ label: '' }] });

      expect(screen.getByRole('textbox')).toBeTruthy();
    });
  });
});
