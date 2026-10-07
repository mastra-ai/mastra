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

// Base UI's Radio synthesizes a PointerEvent on click, which jsdom does not
// implement. Polyfill it with the available MouseEvent constructor.

describe('AskUser', () => {
  describe('when Other is selected for a single-select question', () => {
    const payload: AskUserPayload = { question: 'Pick a fruit', options: [{ label: 'Apple' }, { label: 'Banana' }] };

    it('focuses the input inside the Other row without submitting the UI choice', () => {
      const { onSubmit } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('group', { name: 'Custom answer' }));

      const customAnswerRow = screen.getByRole('group', { name: 'Custom answer' });
      expect(document.activeElement).toBe(within(customAnswerRow).getByRole('textbox', { name: 'Your answer' }));
      expect(within(customAnswerRow).getByRole('radio', { name: 'Other…' })).toBeTruthy();
      expect(screen.queryByText('Your answer')).toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it.each(['Enter', 'button'])('submits trimmed custom text using %s', submissionMethod => {
      const { onSubmit } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('radio', { name: 'Other…' }));
      const input = screen.getByRole('textbox', { name: 'Your answer' });
      fireEvent.change(input, { target: { value: '  Pear, locally grown  ' } });

      if (submissionMethod === 'Enter') fireEvent.keyDown(input, { key: 'Enter' });
      else fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

      expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Pear, locally grown');
    });

    it('rejects whitespace-only custom text', () => {
      const { onSubmit } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('radio', { name: 'Other…' }));
      const input = screen.getByRole('textbox', { name: 'Your answer' });
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }).disabled).toBe(true);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits only the suggested option when the user switches back', () => {
      const { onSubmit } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('radio', { name: 'Other…' }));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pear' } });
      fireEvent.click(screen.getByRole('radio', { name: 'Apple' }));

      expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Apple');
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('retains the draft while blocking submission during a pending response', () => {
      const { onSubmit, rerender } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('radio', { name: 'Other…' }));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pear' } });
      rerender(<AskUser payload={payload} isSubmitting onSubmit={onSubmit} />);
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

      expect(screen.getByRole<HTMLInputElement>('textbox').disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }).disabled).toBe(true);
      expect(onSubmit).not.toHaveBeenCalled();

      rerender(<AskUser payload={payload} onSubmit={onSubmit} />);
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith('Pear');
    });

    it('resets the custom choice and draft when the question changes', () => {
      const { onSubmit, rerender } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('radio', { name: 'Other…' }));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pear' } });
      rerender(<AskUser payload={{ ...payload, question: 'Pick another fruit' }} onSubmit={onSubmit} />);
      expect(screen.queryByRole('textbox')).toBeNull();
      fireEvent.click(screen.getByRole('radio', { name: 'Other…' }));

      expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('');
    });

    it('does not submit an Enter key used to compose text', () => {
      const { onSubmit } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('radio', { name: 'Other…' }));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '梨' } });
      fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when an option label matches the internal custom choice', () => {
    it('submits the real label as an ordinary option', () => {
      const { onSubmit } = renderAskUser({ question: 'Choose a value', options: [{ label: 'custom' }] });
      fireEvent.click(screen.getByRole('radio', { name: 'custom' }));

      expect(onSubmit).toHaveBeenCalledExactlyOnceWith('custom');
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  describe('when Other is checked for a multi-select question', () => {
    const payload: AskUserPayload = {
      question: 'Pick toppings',
      options: [{ label: 'Cheese' }, { label: 'Olives' }],
      selectionMode: 'multi_select',
    };

    it.each(['Enter', 'button'])('submits selected labels plus trimmed custom text using %s', submissionMethod => {
      const { onSubmit } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Cheese' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Other…' }));
      const input = screen.getByRole('textbox', { name: 'Your answer' });
      fireEvent.change(input, { target: { value: '  Roasted peppers  ' } });
      expect(onSubmit).not.toHaveBeenCalled();

      if (submissionMethod === 'Enter') fireEvent.keyDown(input, { key: 'Enter' });
      else fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

      expect(onSubmit).toHaveBeenCalledExactlyOnceWith(['Cheese', 'Roasted peppers']);
    });

    it('allows a custom answer without suggested selections', () => {
      const { onSubmit } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Other…' }));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Roasted peppers' } });
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

      expect(onSubmit).toHaveBeenCalledExactlyOnceWith(['Roasted peppers']);
    });

    it('requires custom text when Other is checked even if an option is selected', () => {
      const { onSubmit } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Cheese' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Other…' }));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }).disabled).toBe(true);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('excludes the custom draft when Other is unchecked', () => {
      const { onSubmit } = renderAskUser(payload);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Cheese' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Other…' }));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Roasted peppers' } });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Other…' }));
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

      expect(onSubmit).toHaveBeenCalledExactlyOnceWith(['Cheese']);
    });

    it('keeps the checkbox mounted and restores the draft when Other is checked again', () => {
      renderAskUser(payload);
      const customAnswerCheckbox = screen.getByRole('checkbox', { name: 'Other…' });
      fireEvent.click(customAnswerCheckbox);
      const customAnswerRow = screen.getByRole('group', { name: 'Custom answer' });
      fireEvent.change(within(customAnswerRow).getByRole('textbox'), { target: { value: 'Roasted peppers' } });
      fireEvent.click(customAnswerCheckbox);

      expect(screen.getByRole('checkbox', { name: 'Other…' })).toBe(customAnswerCheckbox);
      expect(within(customAnswerRow).queryByRole('textbox')).toBeNull();
      fireEvent.click(customAnswerCheckbox);
      expect(within(customAnswerRow).getByRole<HTMLInputElement>('textbox').value).toBe('Roasted peppers');
      expect(document.activeElement).toBe(within(customAnswerRow).getByRole('textbox'));
    });
  });

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

  describe('when a single-select option is clicked', () => {
    it('submits the chosen label immediately', () => {
      const { onSubmit } = renderAskUser({
        question: 'Pick a fruit',
        options: [{ label: 'Apple' }, { label: 'Banana' }],
        selectionMode: 'single_select',
      });

      fireEvent.click(screen.getByRole('radio', { name: 'Apple' }));

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

      fireEvent.click(screen.getByRole('checkbox', { name: 'Cheese' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Olives' }));

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when a multiple selection is unticked', () => {
    it('submits only what is left ticked', () => {
      const { onSubmit } = renderAskUser({
        question: 'Pick toppings',
        options: [{ label: 'Cheese' }, { label: 'Olives' }],
        selectionMode: 'multi_select',
      });

      fireEvent.click(screen.getByRole('checkbox', { name: 'Cheese' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Olives' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Cheese' }));

      expect(screen.getByRole('checkbox', { name: 'Cheese' }).getAttribute('aria-checked')).toBe('false');
      expect(screen.getByRole('checkbox', { name: 'Olives' }).getAttribute('aria-checked')).toBe('true');

      fireEvent.click(screen.getByRole('button', { name: /confirm|submit/i }));

      expect(onSubmit).toHaveBeenCalledWith(['Olives']);
    });
  });

  describe('when a single-select option is clicked without an explicit selection mode', () => {
    it('shows the choice as made', () => {
      renderAskUser({ question: 'Pick a fruit', options: [{ label: 'Apple' }, { label: 'Pear' }] });

      fireEvent.click(screen.getByRole('radio', { name: /Apple/ }));

      expect(screen.getByRole('radio', { name: /Apple/ }).getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('when the options change under the same question', () => {
    it('starts the choice over', () => {
      const { rerender } = render(
        <AskUser
          payload={{ question: 'Pick a fruit', options: [{ label: 'Apple' }], selectionMode: 'multi_select' }}
          onSubmit={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('checkbox', { name: 'Apple' }));
      expect(screen.getByRole('checkbox', { name: 'Apple' }).getAttribute('aria-checked')).toBe('true');

      rerender(
        <AskUser
          payload={{ question: 'Pick a fruit', options: [{ label: 'Pear' }], selectionMode: 'multi_select' }}
          onSubmit={vi.fn()}
        />,
      );

      expect(screen.getByRole('checkbox', { name: 'Pear' }).getAttribute('aria-checked')).toBe('false');
    });
  });

  describe('when free text holds nothing but spaces', () => {
    it('keeps the submit button out of reach', () => {
      renderAskUser({ question: 'What is your name?' });
      const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'What is your name?' });

      fireEvent.change(input, { target: { value: '   ' } });

      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Submit answer' }).disabled).toBe(true);
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
      fireEvent.click(within(group).getByRole('checkbox', { name: 'Cheese' }));
      fireEvent.click(within(group).getByRole('checkbox', { name: 'Olives' }));

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

      expect(screen.getByRole('radio', { name: 'Apple' }).getAttribute('aria-disabled')).toBe('true');
    });

    it('announces the pending state', () => {
      renderAskUser(payload, { isSubmitting: true });

      expect(screen.getByRole('status').textContent).toBe('Submitting…');
    });
  });

  describe('when an answer result exists', () => {
    it('renders the answer without option controls', () => {
      const { container } = renderAskUser(
        { question: 'Pick a fruit', options: [{ label: 'Apple' }] },
        { result: { content: 'User answered: Apple', isError: false } },
      );

      const status = screen.getByRole('status');
      expect(screen.queryByRole('radio')).toBeNull();
      expect(status.textContent).toContain('User answered: Apple');
      expect(container.textContent).not.toContain('Error');
    });
  });

  describe('when an error result exists', () => {
    it('renders the error as an alert', () => {
      renderAskUser({ question: 'Pick a fruit' }, { result: { content: 'Unable to resume', isError: true } });

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('Unable to resume');
    });
  });

  describe('when an option is malformed', () => {
    it('keeps the ones that are usable and falls back when none are', () => {
      renderAskUser({
        question: 'Pick a fruit',
        options: [null as unknown as { label: string }, { label: 'Apple' }, { label: 42 as unknown as string }],
      });

      expect(screen.getAllByRole('radio')).toHaveLength(2);
      expect(screen.getByRole('radio', { name: /Apple/ })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Other…' })).toBeTruthy();
    });
  });

  describe('when a key other than Enter is pressed in free text', () => {
    it('leaves it to the input', () => {
      const { onSubmit } = renderAskUser({ question: 'What is your name?' });
      const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'What is your name?' });

      fireEvent.change(input, { target: { value: 'Ada' } });
      expect(fireEvent.keyDown(input, { key: 'a' })).toBe(true);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('takes Enter for itself', () => {
      const { onSubmit } = renderAskUser({ question: 'What is your name?' });
      const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'What is your name?' });

      fireEvent.change(input, { target: { value: 'Ada' } });

      expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
      expect(onSubmit).toHaveBeenCalledWith('Ada');
    });
  });

  describe('when a single selection is chosen while a submission is pending', () => {
    it('says nothing more', () => {
      const { onSubmit } = renderAskUser(
        { question: 'Pick a fruit', options: [{ label: 'Apple' }, { label: 'Pear' }] },
        { isSubmitting: true },
      );

      fireEvent.click(screen.getByRole('radio', { name: /Apple/ }));

      expect(onSubmit).not.toHaveBeenCalled();
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
